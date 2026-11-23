-- Tài chính · Phần 3: thu nhập từ đơn ngoài sàn (Facebook, Zalo, khách quen…). CHỈ admin đọc / ghi.
-- Chạy SAU supabase/migration_finance_costs.sql (dùng công thức giá vốn + cài đặt đóng gói).

create table if not exists public.offline_orders (
  id uuid primary key default gen_random_uuid(),
  order_date date not null default ((now() at time zone 'Asia/Ho_Chi_Minh')::date),
  channel text not null default 'Facebook',        -- Facebook, Zalo, Instagram, Trực tiếp, Khác…
  customer text,                                    -- tên khách (không bắt buộc)
  mode text not null default 'quick' check (mode in ('quick', 'detail')), -- Nhập nhanh · Nhập chi tiết
  amount numeric not null default 0,                -- số tiền nhận được (đã trừ phí ship)
  category_id uuid references public.finance_categories(id) on delete set null, -- nhập nhanh: phân loại · chi tiết: phân loại dòng đầu
  packaging boolean not null default true,          -- cộng chi phí đóng gói (tắt cho đơn giao tận tay…)
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists offline_orders_date_idx on public.offline_orders (order_date);

create table if not exists public.offline_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.offline_orders(id) on delete cascade,
  recipe_id uuid references public.finance_recipes(id) on delete set null, -- công thức giá vốn (nếu có)
  label text,                                       -- tên sản phẩm (khi không có công thức)
  category_id uuid references public.finance_categories(id) on delete set null,
  qty numeric not null default 1,
  amount numeric not null default 0,                -- thành tiền
  sort_order int not null default 0
);
create index if not exists offline_order_lines_order_idx on public.offline_order_lines (order_id);

do $$
declare t text;
begin
  foreach t in array array['offline_orders','offline_order_lines'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s admin all" on public.%I', t, t);
    execute format('create policy "%s admin all" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- giá vốn + đóng gói + lãi ước tính của mỗi đơn ngoài sàn
-- · chi tiết: giá vốn = Σ (giá vốn công thức × số lượng)
-- · nhập nhanh: giá vốn = thu nhập × tỉ lệ giá vốn bình quân của phân loại (từ đơn chi tiết 90 ngày gần nhất) — "ước tính"
create or replace view public.finance_offline_facts with (security_invoker = true) as
with lc as (
  select l.order_id, sum(l.qty * coalesce(rc.cost, 0)) as cogs
  from public.offline_order_lines l left join public.finance_recipe_cost rc on rc.recipe_id = l.recipe_id group by l.order_id
), ratio as (
  select o.category_id, sum(lc.cogs) / nullif(sum(o.amount), 0) as r
  from public.offline_orders o join lc on lc.order_id = o.id
  where o.mode = 'detail' and o.order_date >= ((now() at time zone 'Asia/Ho_Chi_Minh')::date - 90)
  group by o.category_id
), pk as (select public.finance_packaging_cost() as v)
select o.id, o.order_date, o.channel, o.customer, o.mode, o.amount, o.category_id, o.packaging, o.note, o.created_at,
  c.cogs, o.mode = 'quick' as cogs_estimated, (o.mode = 'quick' and ra.r is null) as no_ratio, c.pack as packaging_cost,
  o.amount - c.cogs - c.pack as profit
from public.offline_orders o
left join lc on lc.order_id = o.id
left join ratio ra on ra.category_id is not distinct from o.category_id
cross join pk
cross join lateral (select case when o.mode = 'detail' then coalesce(lc.cogs, 0) else o.amount * coalesce(ra.r, 0) end as cogs,
                           case when o.packaging then pk.v else 0 end as pack) c;
