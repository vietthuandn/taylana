-- Tài chính · Phần 2: phân loại, mặt hàng, nhập nguyên liệu, công thức giá vốn, ghép sản phẩm Shopee, cài đặt (đóng gói…).
-- Ghi thẳng từ trình duyệt. CHỈ admin đọc / ghi (RLS is_admin()). Các view dùng security_invoker → vẫn theo RLS của bảng gốc.
-- Chạy SAU supabase/migration_finance_shopee.sql.

-- ---------- cài đặt tài chính (riêng, không công khai như site_settings) ----------
create table if not exists public.finance_settings (
  key text primary key,          -- packaging · avg_mode · profit_start
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
-- đóng gói mỗi đơn: { "mode": "fixed" | "recipe", "fixed": 3000, "items": [{ "item_id": "...", "qty": 1 }] }
insert into public.finance_settings (key, value) values ('packaging', '{"mode":"fixed","fixed":0,"items":[]}'::jsonb) on conflict (key) do nothing;
-- giá đơn vị dùng: "12m" = bình quân gia quyền 12 tháng gần nhất · "last" = lần mua gần nhất
insert into public.finance_settings (key, value) values ('avg_mode', '{"mode":"12m"}'::jsonb) on conflict (key) do nothing;

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
insert into public.finance_categories (name, sort_order) values ('CD', 1), ('Ảnh', 2), ('Đóng gói', 3), ('Vật tư in', 4) on conflict (name) do nothing;

create table if not exists public.finance_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category_id uuid references public.finance_categories(id) on delete set null,
  unit text not null default 'cái',                 -- đơn vị dùng: tờ, cái, lần in, mét…
  kind text not null default 'material' check (kind in ('material', 'consumable', 'resale')), -- Nguyên liệu · Vật tư theo lần dùng · Hàng bán lại
  uses_per_unit numeric,                            -- vật tư theo lần dùng: 1 đơn vị dùng được bao nhiêu lần
  cost_per_use numeric,                             -- hoặc nhập thẳng chi phí mỗi lần
  sale_price numeric,                               -- hàng bán lại: giá bán dự kiến
  created_at timestamptz not null default now()
);

create table if not exists public.finance_purchases (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.finance_items(id) on delete cascade,
  category_id uuid references public.finance_categories(id) on delete set null,
  qty numeric not null check (qty > 0),             -- số lượng mua
  buy_unit text,                                    -- đơn vị mua: xấp, hộp, bình…
  conv numeric not null default 1 check (conv > 0), -- 1 đơn vị mua = conv đơn vị dùng
  total numeric not null default 0,                 -- tổng tiền
  bought_on date not null default ((now() at time zone 'Asia/Ho_Chi_Minh')::date),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists finance_purchases_item_idx on public.finance_purchases (item_id, bought_on desc);

create table if not exists public.finance_recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  source text not null default 'custom' check (source in ('cd', 'print', 'custom')), -- Loại sản phẩm CD · món in lẻ · tự đặt tên
  category_id uuid references public.finance_categories(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.finance_recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.finance_recipes(id) on delete cascade,
  item_id uuid not null references public.finance_items(id) on delete cascade,
  qty numeric not null default 1,
  sort_order int not null default 0
);
create index if not exists finance_recipe_items_recipe_idx on public.finance_recipe_items (recipe_id);

-- quy tắc ghép dòng sản phẩm Shopee → công thức + phân loại (ô trống = không xét; cần ít nhất 1 ô)
create table if not exists public.finance_product_map (
  id uuid primary key default gen_random_uuid(),
  match_name text,          -- cụm chữ trong tên sản phẩm
  match_variation text,     -- cụm chữ trong tên phân loại hàng
  match_product_id text,    -- mã sản phẩm (Income)
  match_sku text,           -- SKU phân loại
  recipe_id uuid references public.finance_recipes(id) on delete set null,
  category_id uuid references public.finance_categories(id) on delete set null,
  priority int not null default 0,
  created_at timestamptz not null default now()
);

-- công thức + quy tắc mẫu (thành phần để trống — admin tự thêm)
insert into public.finance_recipes (name, source, category_id)
select n, s, (select id from public.finance_categories where name = 'CD')
from (values ('CD lẻ', 'cd'), ('Combo + Booklet 4 trang', 'cd'), ('Combo + Booklet 8 trang', 'cd'), ('Combo + Booklet 12 trang', 'cd'), ('Bìa trước 2 mặt', 'print'), ('Giá đỡ', 'custom')) v(n, s)
on conflict (name) do nothing;
insert into public.finance_product_map (match_variation, recipe_id, category_id, priority)
select v, (select id from public.finance_recipes where name = r), (select id from public.finance_categories where name = 'CD'), p
from (values ('CD (in)', 'CD lẻ', 1), ('Combo + Booklet 4tr', 'Combo + Booklet 4 trang', 5), ('8tr', 'Combo + Booklet 8 trang', 4), ('12tr', 'Combo + Booklet 12 trang', 4), ('Bìa Trước 2 mặt', 'Bìa trước 2 mặt', 3), ('Giá Đỡ', 'Giá đỡ', 2)) x(v, r, p)
where not exists (select 1 from public.finance_product_map);

-- ---------- RLS: chỉ admin ----------
do $$
declare t text;
begin
  foreach t in array array['finance_settings','finance_categories','finance_items','finance_purchases','finance_recipes','finance_recipe_items','finance_product_map'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s admin all" on public.%I', t, t);
    execute format('create policy "%s admin all" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- ---------- giá đơn vị dùng của mỗi mặt hàng ----------
-- unit_price = bình quân gia quyền (tổng tiền / tổng đơn vị dùng) các lần mua 12 tháng gần nhất (không có thì lần mua gần nhất),
--              hoặc lần mua gần nhất (cài đặt avg_mode = last)
-- cost = chi phí 1 đơn vị trong công thức: vật tư theo lần dùng = cost_per_use hoặc unit_price / uses_per_unit
create or replace view public.finance_item_cost with (security_invoker = true) as
with p as (
  select item_id, total, qty * conv as units, bought_on, created_at from public.finance_purchases where qty * conv > 0
), w as (
  select item_id, sum(total) / nullif(sum(units), 0) as avg12, sum(total) as spent12, count(*) as n12
  from p where bought_on >= ((now() at time zone 'Asia/Ho_Chi_Minh')::date - interval '12 months') group by item_id
), l as (
  select distinct on (item_id) item_id, total / units as last_price, bought_on as last_on from p order by item_id, bought_on desc, created_at desc
), m as (
  select coalesce((select value->>'mode' from public.finance_settings where key = 'avg_mode'), '12m') as mode
), u as (
  select i.*, case when m.mode = 'last' then l.last_price else coalesce(w.avg12, l.last_price) end as unit_price, l.last_price, l.last_on, w.n12
  from public.finance_items i cross join m left join w on w.item_id = i.id left join l on l.item_id = i.id
)
select id as item_id, unit_price, last_price, last_on, coalesce(n12, 0) as purchases_12m,
  case when kind = 'consumable' then coalesce(cost_per_use, unit_price / nullif(uses_per_unit, 0), unit_price) else unit_price end as cost
from u;

-- giá vốn ước tính của công thức = Σ lượng dùng × cost (missing = có thành phần chưa có giá)
create or replace view public.finance_recipe_cost with (security_invoker = true) as
select r.id as recipe_id, coalesce(sum(ri.qty * c.cost), 0) as cost, coalesce(bool_or(ri.id is not null and c.cost is null), false) as missing, count(ri.id) as parts
from public.finance_recipes r
left join public.finance_recipe_items ri on ri.recipe_id = r.id
left join public.finance_item_cost c on c.item_id = ri.item_id
group by r.id;

-- chi phí đóng gói mỗi đơn (theo cài đặt)
create or replace function public.finance_packaging_cost() returns numeric language sql stable security invoker set search_path = public as $$
  select case when coalesce(v->>'mode', 'fixed') = 'fixed' then coalesce(nullif(v->>'fixed', '')::numeric, 0)
    else coalesce((select sum(nullif(e->>'qty', '')::numeric * c.cost) from jsonb_array_elements(coalesce(v->'items', '[]'::jsonb)) e
                   join public.finance_item_cost c on c.item_id = (e->>'item_id')::uuid), 0) end
  from (select coalesce((select value from public.finance_settings where key = 'packaging'), '{}'::jsonb) as v) s;
$$;
revoke all on function public.finance_packaging_cost() from public, anon;
grant execute on function public.finance_packaging_cost() to authenticated;

-- ---------- dòng sản phẩm Shopee + ghép quy tắc ----------
-- ưu tiên file xuất đơn (có tên phân loại, số lượng); đơn chưa có file xuất đơn → dòng Sku của Income (mã sản phẩm, SL 1)
create or replace view public.finance_shopee_lines with (security_invoker = true) as
select l.order_sn, l.seq, l.product_name, l.variation, l.variation_sku as sku, null::text as product_id, coalesce(l.qty, 1) as qty
from public.shopee_order_lines l
union all
select i.order_sn, i.seq, i.product_name, null, null, nullif(i.product_id, ''), 1
from public.shopee_order_items i
where not exists (select 1 from public.shopee_order_lines l where l.order_sn = i.order_sn);

create or replace view public.finance_shopee_line_match with (security_invoker = true) as
select x.*, m.id as rule_id, m.recipe_id, coalesce(m.category_id, r.category_id) as category_id
from public.finance_shopee_lines x
left join lateral (
  select pm.* from public.finance_product_map pm
  where (coalesce(pm.match_name, '') = '' or x.product_name ilike '%' || pm.match_name || '%')
    and (coalesce(pm.match_variation, '') = '' or x.variation ilike '%' || pm.match_variation || '%')
    and (coalesce(pm.match_product_id, '') = '' or x.product_id = pm.match_product_id)
    and (coalesce(pm.match_sku, '') = '' or x.sku = pm.match_sku)
    and (coalesce(pm.match_name, '') <> '' or coalesce(pm.match_variation, '') <> '' or coalesce(pm.match_product_id, '') <> '' or coalesce(pm.match_sku, '') <> '')
  order by pm.priority desc, length(coalesce(pm.match_variation, '')) + length(coalesce(pm.match_name, '')) + length(coalesce(pm.match_product_id, '')) + length(coalesce(pm.match_sku, '')) desc, pm.created_at
  limit 1
) m on true
left join public.finance_recipes r on r.id = m.recipe_id;
