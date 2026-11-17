-- =====================================================================
-- CƠ CẤU LẠI SẢN PHẨM: products → option_groups → options
-- + phí ship theo bậc (shipping_tiers) + mã giảm giá theo phạm vi (tiền hàng / phí ship).
-- Cần chạy SAU: migration_payment, migration_discounts, migration_cart_orders, migration_shipping.
-- Chạy 1 lần trong Supabase → SQL Editor (chạy lại cũng không sao). KHÔNG xoá bảng cũ:
-- packages / addons giữ nguyên làm dữ liệu cũ (không dùng nữa). Lựa chọn mới DÙNG LẠI ĐÚNG id của gói / phụ kiện
-- nên mọi tham chiếu cũ (đơn, giỏ, mã giảm giá, thiết kế Custom CD, file đã nộp) vẫn khớp.
-- =====================================================================

-- ---------- 1. Bảng mới ----------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text not null default '',       -- chữ thường, xuống dòng = đoạn mới, **đậm**
  images      text[] not null default '{}',   -- ảnh đầu = ảnh chính
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists public.option_groups (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  name        text not null,
  select_type text not null default 'single' check (select_type in ('single', 'multi')), -- Chọn 1 / Chọn nhiều
  required    boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists option_groups_product_idx on public.option_groups (product_id, sort_order);
create table if not exists public.options (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.option_groups(id) on delete cascade,
  name        text not null,
  price       integer not null default 0 check (price >= 0), -- Chọn 1: giá của loại · Chọn nhiều: giá cộng thêm
  description text not null default '',
  image_url   text,
  front_pages integer,                                        -- preset thiết kế (nhóm Loại)
  back_pages  integer,
  has_disc    boolean,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists options_group_idx on public.options (group_id, sort_order);
drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
drop trigger if exists options_touch on public.options;
create trigger options_touch before update on public.options for each row execute function public.touch_updated_at();

create table if not exists public.shipping_tiers (
  id         uuid primary key default gen_random_uuid(),
  min_amount integer not null check (min_amount >= 0), -- từ (đ) — so với tiền hàng TRƯỚC giảm giá
  percent    integer not null check (percent between 0 and 100), -- giảm (%) phí ship
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.option_groups enable row level security;
alter table public.options enable row level security;
alter table public.shipping_tiers enable row level security;
grant select on public.products, public.option_groups, public.options, public.shipping_tiers to anon, authenticated;
grant insert, update, delete on public.products, public.option_groups, public.options, public.shipping_tiers to authenticated;

drop policy if exists "products: ai cũng đọc" on public.products;
create policy "products: ai cũng đọc" on public.products for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "products: admin toàn quyền" on public.products;
create policy "products: admin toàn quyền" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "option_groups: ai cũng đọc" on public.option_groups;
create policy "option_groups: ai cũng đọc" on public.option_groups for select to anon, authenticated using (true);
drop policy if exists "option_groups: admin toàn quyền" on public.option_groups;
create policy "option_groups: admin toàn quyền" on public.option_groups for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "options: ai cũng đọc" on public.options;
create policy "options: ai cũng đọc" on public.options for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "options: admin toàn quyền" on public.options;
create policy "options: admin toàn quyền" on public.options for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "shipping_tiers: ai cũng đọc" on public.shipping_tiers;
create policy "shipping_tiers: ai cũng đọc" on public.shipping_tiers for select to anon, authenticated using (true);
drop policy if exists "shipping_tiers: admin toàn quyền" on public.shipping_tiers;
create policy "shipping_tiers: admin toàn quyền" on public.shipping_tiers for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 2. Chuyển dữ liệu gói / phụ kiện cũ ----------
insert into public.products (name, slug, description, images, is_active, sort_order)
select 'In CD theo yêu cầu', 'in-cd-theo-yeu-cau',
       'Thiết kế và in CD theo yêu cầu: bìa trước, bìa sau, booklet và mặt đĩa. In sắc nét 300 DPI.',
       coalesce((select images from public.packages where coalesce(array_length(images, 1), 0) > 0 order by sort_order limit 1), '{}'), true, 1
where not exists (select 1 from public.products where slug = 'in-cd-theo-yeu-cau');

insert into public.option_groups (product_id, name, select_type, required, sort_order)
select p.id, 'Loại', 'single', true, 1 from public.products p
where p.slug = 'in-cd-theo-yeu-cau' and not exists (select 1 from public.option_groups g where g.product_id = p.id and g.name = 'Loại');
insert into public.option_groups (product_id, name, select_type, required, sort_order)
select p.id, 'Mua kèm', 'multi', false, 2 from public.products p
where p.slug = 'in-cd-theo-yeu-cau' and not exists (select 1 from public.option_groups g where g.product_id = p.id and g.name = 'Mua kèm');

-- gói → lựa chọn nhóm "Loại" (giữ nguyên id, giá, ảnh, preset)
insert into public.options (id, group_id, name, price, description, image_url, front_pages, back_pages, has_disc, is_active, sort_order)
select k.id, g.id, k.name, k.price, coalesce(k.description, ''),
       coalesce((k.images)[1], k.image_url), k.front_pages, k.back_pages, k.has_disc, k.is_active, k.sort_order
from public.packages k
join public.option_groups g on g.name = 'Loại'
join public.products p on p.id = g.product_id and p.slug = 'in-cd-theo-yeu-cau'
on conflict (id) do nothing;
-- phụ kiện → lựa chọn nhóm "Mua kèm"
insert into public.options (id, group_id, name, price, description, image_url, is_active, sort_order)
select a.id, g.id, a.name, a.price, coalesce(a.description, ''), a.image_url, a.is_active, a.sort_order
from public.addons a
join public.option_groups g on g.name = 'Mua kèm'
join public.products p on p.id = g.product_id and p.slug = 'in-cd-theo-yeu-cau'
on conflict (id) do nothing;

-- ảnh sản phẩm: gộp ảnh các gói (nếu sản phẩm chưa có ảnh)
update public.products p set images = coalesce((
  select array_agg(u order by s, n) from (
    select distinct on (u) u, k.sort_order as s, n
    from public.packages k, unnest(coalesce(k.images, '{}'::text[]) || array[k.image_url]) with ordinality as x(u, n)
    where u is not null and u <> ''
  ) t), '{}')
where p.slug = 'in-cd-theo-yeu-cau' and coalesce(array_length(p.images, 1), 0) = 0;

comment on table public.packages is 'KHÔNG DÙNG NỮA — đã chuyển sang options (nhóm Loại). Giữ lại làm dữ liệu cũ.';
comment on table public.addons is 'KHÔNG DÙNG NỮA — đã chuyển sang options (nhóm Mua kèm). Giữ lại làm dữ liệu cũ.';

-- ---------- 3. Tham chiếu: dòng đơn, giỏ hàng, mã giảm giá, đơn ----------
alter table public.order_items add column if not exists product_id uuid references public.products(id) on delete set null;
alter table public.order_items add column if not exists product_name text not null default '';
alter table public.order_items add column if not exists type_option_id uuid;            -- lựa chọn nhóm Loại (preset trang)
alter table public.order_items add column if not exists options jsonb not null default '[]'::jsonb; -- [{id,name,price,group,multi}]
update public.order_items i set
  product_id = p.id, product_name = p.name, type_option_id = coalesce(i.type_option_id, i.package_id),
  options = jsonb_build_array(jsonb_build_object('id', i.package_id, 'name', i.package_name, 'price', i.unit_price, 'group', 'Loại', 'multi', false))
            || coalesce((select jsonb_agg(jsonb_build_object('id', a->>'id', 'name', a->>'name', 'price', (a->>'price')::int, 'group', 'Mua kèm', 'multi', true))
                         from jsonb_array_elements(i.addons) a), '[]'::jsonb)
from public.products p
where p.slug = 'in-cd-theo-yeu-cau' and i.product_id is null and i.package_id is not null;

alter table public.cart_items add column if not exists product_id uuid references public.products(id) on delete cascade;
alter table public.cart_items add column if not exists options jsonb not null default '[]'::jsonb; -- ["<option id>", ...]
alter table public.cart_items alter column package_id drop not null;
update public.cart_items c set product_id = p.id,
  options = jsonb_build_array(c.package_id::text) || coalesce((select jsonb_agg(a->>'id') from jsonb_array_elements(c.addons) a where coalesce((a->>'qty')::int, 1) > 0), '[]'::jsonb)
from public.products p
where p.slug = 'in-cd-theo-yeu-cau' and c.product_id is null and c.package_id is not null;

alter table public.discounts add column if not exists target text not null default 'goods';
alter table public.discounts drop constraint if exists discounts_target_check;
alter table public.discounts add constraint discounts_target_check check (target in ('goods', 'shipping')); -- Giảm tiền hàng / Giảm phí ship
alter table public.discounts add column if not exists option_ids uuid[] not null default '{}';
update public.discounts set option_ids = package_ids || addon_ids where option_ids = '{}' and (package_ids <> '{}' or addon_ids <> '{}');

alter table public.orders add column if not exists shipping_base integer not null default 0;          -- phí gốc
alter table public.orders add column if not exists shipping_tier_percent integer not null default 0;  -- % ưu đãi theo bậc
alter table public.orders add column if not exists shipping_after_tier integer not null default 0;    -- phí sau ưu đãi bậc
alter table public.orders add column if not exists ship_discount_id uuid references public.discounts(id) on delete set null;
alter table public.orders add column if not exists ship_discount_code text;
alter table public.orders add column if not exists ship_discount_label text;
alter table public.orders add column if not exists ship_discount_amount integer not null default 0;
update public.orders set shipping_base = shipping_fee, shipping_after_tier = shipping_fee where shipping_base = 0 and shipping_fee > 0;

-- Bậc ưu đãi từ cài đặt freeship cũ (nếu có)
insert into public.shipping_tiers (min_amount, percent)
select coalesce((value->>'free_threshold')::int, 0), 100 from public.site_settings
where key = 'shipping' and coalesce((value->>'free_enabled')::boolean, false)
  and not exists (select 1 from public.shipping_tiers);

-- ---------- 4. Tính giá giỏ hàng theo cấu trúc mới ----------
-- 1 dòng: { product_id, qty, options:[id...] }  (dạng cũ { package_id, qty, addons:[{id,qty}] } vẫn nhận)
-- → { product_id, product_name, qty, type_option_id, type_name, unit_price, options:[{id,name,price,group,multi}], line_total }
create or replace function public.catalog_line(p_line jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_ids   uuid[];
  v_prod  public.products;
  v_qty   int := greatest(1, least(coalesce((p_line->>'qty')::int, 1), 1000));
  v_opts  jsonb;
  v_type_id   uuid;
  v_type_name text;
  v_bad   int;
  g       record;
  v_n     int;
begin
  if jsonb_typeof(p_line->'options') = 'array' then
    select coalesce(array_agg(distinct (x #>> '{}')::uuid), '{}') into v_ids from jsonb_array_elements(p_line->'options') x;
  else
    v_ids := array_remove(array[nullif(p_line->>'package_id', '')::uuid], null)
      || coalesce((select array_agg((a->>'id')::uuid) from jsonb_array_elements(coalesce(p_line->'addons', '[]'::jsonb)) a where coalesce((a->>'qty')::int, 1) > 0), '{}');
  end if;
  if coalesce(array_length(v_ids, 1), 0) = 0 then raise exception 'Vui lòng chọn sản phẩm'; end if;

  select p.* into v_prod from public.products p
  where p.id = coalesce(nullif(p_line->>'product_id', '')::uuid,
                        (select g2.product_id from public.options o join public.option_groups g2 on g2.id = o.group_id where o.id = v_ids[1]))
    and p.is_active;
  if not found then raise exception 'Sản phẩm không tồn tại hoặc đã ngừng bán'; end if;

  -- mọi lựa chọn phải thuộc sản phẩm và đang bán
  select count(*) into v_bad from unnest(v_ids) i
  where not exists (select 1 from public.options o join public.option_groups g2 on g2.id = o.group_id
                    where o.id = i and o.is_active and g2.product_id = v_prod.id);
  if v_bad > 0 then raise exception 'Một số lựa chọn đã ngừng bán, bạn chọn lại nhé'; end if;

  -- kiểm tra từng nhóm: Chọn 1 tối đa 1, nhóm bắt buộc phải có
  for g in select * from public.option_groups where product_id = v_prod.id loop
    select count(*) into v_n from public.options o where o.group_id = g.id and o.id = any(v_ids);
    if g.select_type = 'single' and v_n > 1 then raise exception 'Nhóm "%" chỉ được chọn 1', g.name; end if;
    if g.required and v_n = 0 then raise exception 'Vui lòng chọn %', lower(g.name); end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'price', o.price, 'group', g2.name, 'multi', g2.select_type = 'multi')
                            order by g2.sort_order, o.sort_order), '[]'::jsonb)
    into v_opts
  from public.options o join public.option_groups g2 on g2.id = o.group_id where o.id = any(v_ids);

  select o.id, o.name into v_type_id, v_type_name from public.options o join public.option_groups g2 on g2.id = o.group_id
  where o.id = any(v_ids) and g2.select_type = 'single' order by g2.required desc, g2.sort_order limit 1;

  return jsonb_build_object(
    'product_id', v_prod.id, 'product_name', v_prod.name, 'qty', v_qty,
    'type_option_id', v_type_id, 'type_name', coalesce(v_type_name, v_prod.name),
    'unit_price', (select coalesce(sum((x->>'price')::int), 0) from jsonb_array_elements(v_opts) x),
    'options', v_opts,
    'line_total', v_qty * (select coalesce(sum((x->>'price')::int), 0) from jsonb_array_elements(v_opts) x)
  );
end $$;

create or replace function public.priced_lines(p_lines jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.catalog_line(l)), '[]'::jsonb) from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l;
$$;

-- Danh sách phẳng để tính giảm giá: mỗi lựa chọn × số lượng
create or replace function public.flat_items(p_priced jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_object('type', case when (o->>'multi')::boolean then 'addon' else 'package' end,
                                               'id', o->>'id', 'name', o->>'name', 'price', (o->>'price')::int, 'qty', (l->>'qty')::int)), '[]'::jsonb)
  from jsonb_array_elements(p_priced) l, jsonb_array_elements(l->'options') o;
$$;

-- Dạng cũ (1 gói + phụ kiện) — vẫn dùng cho đơn không có loại (chỉ phụ kiện)
create or replace function public.discount_cart(p_package_id uuid, p_quantity integer, p_addons jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if p_package_id is not null then
    return public.flat_items(public.priced_lines(jsonb_build_array(jsonb_build_object('package_id', p_package_id, 'qty', p_quantity, 'addons', coalesce(p_addons, '[]'::jsonb)))));
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('type', 'addon', 'id', o.id, 'name', o.name, 'price', o.price,
                                                       'qty', greatest(1, least(coalesce((e->>'qty')::int, 1), 1000))))
                   from jsonb_array_elements(coalesce(p_addons, '[]'::jsonb)) e
                   join public.options o on o.id = (e->>'id')::uuid and o.is_active
                   where coalesce((e->>'qty')::int, 1) > 0), '[]'::jsonb);
end $$;

-- Giảm tiền hàng: "chỉ áp dụng cho" dùng option_ids (id lựa chọn)
create or replace function public.discount_amount_for(d public.discounts, p_items jsonb)
returns integer language plpgsql stable security definer set search_path = public as $$
declare
  v_sub bigint := 0; v_base bigint := 0; v_unit bigint := 0; it jsonb; v_ok boolean; v_amt bigint;
  v_ids uuid[] := case when coalesce(array_length(d.option_ids, 1), 0) > 0 then d.option_ids else d.package_ids || d.addon_ids end;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_sub := v_sub + (it->>'price')::bigint * (it->>'qty')::bigint;
    v_ok := d.scope = 'order' or (it->>'id')::uuid = any(v_ids);
    if v_ok then
      v_base := v_base + (it->>'price')::bigint * (it->>'qty')::bigint;
      v_unit := v_unit + least(d.value, (it->>'price')::bigint) * (it->>'qty')::bigint;
    end if;
  end loop;
  if v_base = 0 then return 0; end if;
  if d.value_type = 'percent' then
    v_amt := floor(v_base * d.value / 100.0);
    if d.max_discount is not null then v_amt := least(v_amt, d.max_discount); end if;
  elsif d.scope = 'order' then v_amt := least(d.value, v_sub);
  else v_amt := v_unit;
  end if;
  return least(v_amt, v_sub)::int;
end $$;

-- ---------- 5. Phí vận chuyển theo bậc ----------
-- base = phí mặc định; pct = % ưu đãi của bậc CAO NHẤT đạt được (theo tiền hàng TRƯỚC giảm giá); after = phí sau ưu đãi
create or replace function public.shipping_quote(p_sub integer)
returns table (base integer, pct integer, after integer)
language sql stable security definer set search_path = public as $$
  with s as (select greatest(0, coalesce((select (value->>'fee')::int from public.site_settings where key = 'shipping'), 0)) as fee),
       t as (select coalesce((select percent from public.shipping_tiers where min_amount <= p_sub order by min_amount desc limit 1), 0) as pct)
  select s.fee, t.pct, (s.fee - floor(s.fee * t.pct / 100.0))::int from s, t;
$$;

-- Số tiền giảm của 1 mã theo phạm vi
create or replace function public.discount_value(d public.discounts, p_items jsonb, p_ship_after integer)
returns integer language plpgsql stable security definer set search_path = public as $$
declare v int;
begin
  if d.target = 'shipping' then
    if coalesce(p_ship_after, 0) <= 0 then return 0; end if;
    if d.value_type = 'percent' then
      v := floor(p_ship_after * d.value / 100.0);
      if d.max_discount is not null then v := least(v, d.max_discount); end if;
    else v := least(d.value, p_ship_after);
    end if;
    return least(v, p_ship_after);
  end if;
  return public.discount_amount_for(d, p_items);
end $$;

-- ---------- 6. Mã công khai + kiểm tra mã riêng tư ----------
drop function if exists public.get_public_discounts();
create or replace function public.get_public_discounts()
returns table (id uuid, label text, target text, value_type text, value integer, max_discount integer, scope text,
               option_ids uuid[], package_ids uuid[], addon_ids uuid[], min_order integer, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.id, coalesce(nullif(d.label, ''), case when d.target = 'shipping' then 'Giảm phí vận chuyển' else 'Ưu đãi toàn shop' end),
         d.target, d.value_type, d.value, d.max_discount, d.scope,
         case when coalesce(array_length(d.option_ids, 1), 0) > 0 then d.option_ids else d.package_ids || d.addon_ids end,
         d.package_ids, d.addon_ids, d.min_order, d.starts_at, d.ends_at
  from public.discounts d
  where d.kind = 'public' and public.discount_problem(d, null) is null
  order by d.created_at;
$$;

drop function if exists public.check_discount_code(text, uuid, integer, jsonb, text, jsonb);
create or replace function public.check_discount_code(p_code text, p_package_id uuid default null, p_quantity integer default 1,
                                                      p_addons jsonb default '[]'::jsonb, p_phone text default '', p_lines jsonb default null)
returns table (ok boolean, message text, amount integer, label text, need integer, potential integer, target text, discount_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  d public.discounts; v_items jsonb; v_sub int; v_amt int; v_prob text; v_after int;
begin
  if p_lines is not null and jsonb_array_length(p_lines) > 0 then v_items := public.flat_items(public.priced_lines(p_lines));
  else v_items := public.discount_cart(p_package_id, p_quantity, p_addons);
  end if;
  select coalesce(sum((x->>'price')::int * (x->>'qty')::int), 0) into v_sub from jsonb_array_elements(v_items) x;
  select q.after into v_after from public.shipping_quote(v_sub) q;
  select * into d from public.discounts
  where kind = 'private' and upper(code) = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')) limit 1;
  if not found then return query select false, 'Mã giảm giá không đúng'::text, 0, ''::text, 0, 0, ''::text, null::uuid; return; end if;
  v_prob := public.discount_problem(d, coalesce(public.normalize_phone(p_phone), ''));
  if v_prob is not null then return query select false, v_prob, 0, ''::text, 0, 0, d.target, d.id; return; end if;
  v_amt := public.discount_value(d, v_items, v_after);
  if v_amt <= 0 then
    return query select false, (case when d.target = 'shipping' then 'Đơn đang được miễn phí vận chuyển, không cần dùng mã này'
                                     else 'Mã giảm giá không áp dụng cho sản phẩm bạn chọn' end)::text, 0, ''::text, 0, 0, d.target, d.id; return;
  end if;
  if d.min_order is not null and v_sub < d.min_order then
    return query select false, ('Đơn tối thiểu ' || to_char(d.min_order, 'FM999G999G999') || 'đ để dùng mã này')::text,
                        0, coalesce(nullif(d.label, ''), d.code), d.min_order - v_sub, v_amt, d.target, d.id; return;
  end if;
  return query select true, ''::text, v_amt, coalesce(nullif(d.label, ''), d.code), 0, v_amt, d.target, d.id;
end $$;

-- ---------- 7. create_order: sản phẩm + tuỳ chọn, ship theo bậc, tối đa 1 mã mỗi phạm vi ----------
drop function if exists public.create_order(text, text, text, text, uuid, integer, jsonb, text, text, text, boolean, text, text, text, jsonb);
drop function if exists public.create_order(text, text, text, text, uuid, integer, jsonb, text, text, text, boolean, text, text, text, jsonb, uuid[]);
create or replace function public.create_order(
  p_customer_name text,
  p_phone         text,
  p_address       text default '',
  p_note          text default '',
  p_package_id    uuid default null,          -- dạng cũ: id lựa chọn "Loại"
  p_quantity      integer default 1,
  p_addons        jsonb default '[]'::jsonb,
  p_order_type    text default 'cd',
  p_music_link    text default '',
  p_discount_code text default '',             -- mã riêng tư khách nhập
  p_auto_discount boolean default true,        -- tự chọn mã công khai tốt nhất (khi không gửi p_discount_ids)
  p_province      text default '',
  p_ward          text default '',
  p_street        text default '',
  p_lines         jsonb default null,          -- [{product_id, qty, options:[id...]}]
  p_discount_ids  uuid[] default null          -- mã công khai khách đã chọn (tối đa 1 mỗi phạm vi); [] = không dùng
)
returns table (order_id uuid, order_code text, order_total integer)
language plpgsql security definer
set search_path = public
as $$
declare
  v_lines   jsonb;
  v_items   jsonb;
  v_sub     integer := 0;
  v_code    text;
  v_id      uuid;
  v_phone   text := public.normalize_phone(p_phone);
  v_alpha   text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_address text;
  d         public.discounts;
  v_g       public.discounts;   -- mã giảm tiền hàng
  v_s       public.discounts;   -- mã giảm phí ship
  v_g_amt   integer := 0;
  v_s_amt   integer := 0;
  v_amt     integer;
  v_prob    text;
  v_dcode   text := upper(regexp_replace(coalesce(p_discount_code, ''), '\s', '', 'g'));
  v_base    integer; v_pct integer; v_after integer;
  l         jsonb;
  i         int := 0;
  v_type    uuid;
begin
  if char_length(trim(coalesce(p_customer_name, ''))) not between 1 and 100 then raise exception 'Vui lòng nhập tên (tối đa 100 ký tự)'; end if;
  if v_phone is null then raise exception 'Số điện thoại không hợp lệ'; end if;
  if char_length(coalesce(p_address, '')) > 500 or char_length(coalesce(p_note, '')) > 2000 or char_length(coalesce(p_music_link, '')) > 1000
     or char_length(coalesce(p_province, '')) > 100 or char_length(coalesce(p_ward, '')) > 100 or char_length(coalesce(p_street, '')) > 300 then
    raise exception 'Nội dung quá dài';
  end if;
  if p_order_type not in ('cd', 'custom_cd', 'photostrip') then raise exception 'Loại đơn không hợp lệ'; end if;

  -- Dòng sản phẩm, giá lấy từ database
  if p_lines is not null and jsonb_array_length(p_lines) > 0 then
    if jsonb_array_length(p_lines) > 50 then raise exception 'Đơn có quá nhiều sản phẩm'; end if;
    v_lines := public.priced_lines(p_lines);
    v_items := public.flat_items(v_lines);
  elsif p_package_id is not null then
    v_lines := public.priced_lines(jsonb_build_array(jsonb_build_object('package_id', p_package_id, 'qty', p_quantity, 'addons', coalesce(p_addons, '[]'::jsonb))));
    v_items := public.flat_items(v_lines);
  else
    if p_order_type = 'cd' then raise exception 'Vui lòng chọn sản phẩm'; end if;
    v_lines := '[]'::jsonb;
    v_items := public.discount_cart(null, 1, p_addons);
  end if;
  select coalesce(sum((x->>'price')::int * (x->>'qty')::int), 0) into v_sub from jsonb_array_elements(v_items) x;
  select q.base, q.pct, q.after into v_base, v_pct, v_after from public.shipping_quote(v_sub) q;

  -- Mã riêng tư
  if v_dcode <> '' then
    select * into d from public.discounts where kind = 'private' and upper(code) = v_dcode for update;
    if not found then raise exception 'Mã giảm giá không đúng'; end if;
    v_prob := public.discount_problem(d, v_phone);
    if v_prob is not null then raise exception '%', v_prob; end if;
    if d.min_order is not null and v_sub < d.min_order then raise exception 'Đơn chưa đủ giá trị tối thiểu để dùng mã %', d.code; end if;
    v_amt := public.discount_value(d, v_items, v_after);
    if v_amt <= 0 then raise exception 'Mã % không áp dụng được cho đơn này', d.code; end if;
    if d.target = 'shipping' then v_s := d; v_s_amt := v_amt; else v_g := d; v_g_amt := v_amt; end if;
  end if;

  -- Mã công khai khách đã chọn
  if p_discount_ids is not null then
    for d in select * from public.discounts where id = any(p_discount_ids) and kind = 'public' for update loop
      v_prob := public.discount_problem(d, v_phone);
      if v_prob is not null then raise exception 'Ưu đãi "%": %', coalesce(nullif(d.label, ''), d.name), v_prob; end if;
      if d.min_order is not null and v_sub < d.min_order then raise exception 'Đơn chưa đủ điều kiện dùng ưu đãi "%"', coalesce(nullif(d.label, ''), d.name); end if;
      v_amt := public.discount_value(d, v_items, v_after);
      if v_amt <= 0 then continue; end if;
      if d.target = 'shipping' then
        if v_s.id is null then v_s := d; v_s_amt := v_amt; end if;
      else
        if v_g.id is null then v_g := d; v_g_amt := v_amt; end if;
      end if;
    end loop;
  elsif coalesce(p_auto_discount, true) then
    -- tự chọn mã công khai tốt nhất cho phạm vi còn trống
    for d in select * from public.discounts where kind = 'public' for update loop
      if public.discount_problem(d, v_phone) is null and (d.min_order is null or v_sub >= d.min_order) then
        v_amt := public.discount_value(d, v_items, v_after);
        if d.target = 'shipping' then
          if (v_s.id is null or v_s.kind = 'public') and v_amt > v_s_amt then v_s := d; v_s_amt := v_amt; end if;
        else
          if (v_g.id is null or v_g.kind = 'public') and v_amt > v_g_amt then v_g := d; v_g_amt := v_amt; end if;
        end if;
      end if;
    end loop;
  end if;
  v_g_amt := least(v_g_amt, v_sub);
  v_s_amt := least(v_s_amt, v_after);

  v_address := coalesce(nullif(trim(coalesce(p_address, '')), ''),
    concat_ws(', ', nullif(trim(coalesce(p_street, '')), ''), nullif(trim(coalesce(p_ward, '')), ''), nullif(trim(coalesce(p_province, '')), '')), '');

  loop
    v_code := 'TL-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD') || '-' ||
              (select string_agg(substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1), '') from generate_series(1, 4));
    exit when not exists (select 1 from public.orders where code = v_code);
  end loop;

  v_type := nullif(v_lines->0->>'type_option_id', '')::uuid;
  insert into public.orders (code, order_type, customer_name, phone, phone_normalized, user_id, address, note, package_id,
                             quantity, items, subtotal,
                             discount_id, discount_code, discount_label, discount_amount,
                             ship_discount_id, ship_discount_code, ship_discount_label, ship_discount_amount,
                             shipping_base, shipping_tier_percent, shipping_after_tier, shipping_fee, shipping_free,
                             total, music_link, province, ward, street)
  values (v_code, p_order_type, trim(p_customer_name), v_phone, v_phone, auth.uid(), v_address, coalesce(p_note, ''),
          (select id from public.packages where id = v_type),
          greatest(1, coalesce((v_lines->0->>'qty')::int, 1)), v_items, v_sub,
          v_g.id, case when v_g.kind = 'private' then v_g.code end,
          case when v_g.id is not null then coalesce(nullif(v_g.label, ''), v_g.code, 'Ưu đãi toàn shop') end, v_g_amt,
          v_s.id, case when v_s.kind = 'private' then v_s.code end,
          case when v_s.id is not null then coalesce(nullif(v_s.label, ''), v_s.code, 'Giảm phí vận chuyển') end, v_s_amt,
          v_base, v_pct, v_after, v_after - v_s_amt, (v_after - v_s_amt) = 0 and v_base > 0,
          v_sub - v_g_amt + (v_after - v_s_amt), coalesce(p_music_link, ''),
          trim(coalesce(p_province, '')), trim(coalesce(p_ward, '')), trim(coalesce(p_street, '')))
  returning id into v_id;

  for l in select * from jsonb_array_elements(v_lines) loop
    i := i + 1;
    insert into public.order_items (order_id, position, package_id, package_name, product_id, product_name, type_option_id, options,
                                    unit_price, quantity, addons, line_total)
    values (v_id, i, (select id from public.packages where id = nullif(l->>'type_option_id', '')::uuid), l->>'type_name',
            (l->>'product_id')::uuid, l->>'product_name', nullif(l->>'type_option_id', '')::uuid, l->'options',
            (l->>'unit_price')::int, (l->>'qty')::int,
            coalesce((select jsonb_agg(jsonb_build_object('id', o->>'id', 'name', o->>'name', 'price', (o->>'price')::int, 'qty', (l->>'qty')::int))
                      from jsonb_array_elements(l->'options') o where (o->>'multi')::boolean), '[]'::jsonb),
            (l->>'line_total')::int);
  end loop;

  if v_g.id is not null then
    update public.discounts set used_count = used_count + 1 where id = v_g.id;
    insert into public.discount_usages (discount_id, order_id, phone, amount) values (v_g.id, v_id, v_phone, v_g_amt);
  end if;
  if v_s.id is not null then
    update public.discounts set used_count = used_count + 1 where id = v_s.id;
    insert into public.discount_usages (discount_id, order_id, phone, amount) values (v_s.id, v_id, v_phone, v_s_amt);
  end if;

  return query select v_id, v_code, v_sub - v_g_amt + (v_after - v_s_amt);
end $$;

-- ---------- 8. Tóm tắt đơn + gửi file: đọc preset từ lựa chọn "Loại" ----------
create or replace function public.order_summary_json(o public.orders)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'code', o.code, 'payment_code', o.payment_code, 'created_at', o.created_at,
    'total', o.total, 'amount_due', o.amount_due, 'status', o.status, 'payment_status', o.payment_status,
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'package_id', coalesce(i.type_option_id, i.package_id), 'package_name', i.package_name,
                         'product_name', i.product_name, 'options', i.options,
                         'quantity', i.quantity, 'addons', i.addons, 'unit_price', i.unit_price, 'line_total', i.line_total,
                         'copies_mode', i.copies_mode) order by i.position)
                       from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'file_count', (select count(*) from public.order_files f where f.order_id = o.id)
  );
$$;

create or replace function public.order_upload_info(p_code text, p_phone text default '', p_saved boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where upper(code) = upper(trim(coalesce(p_code, ''))) limit 1;
  if not found then return null; end if;
  if not (
       (auth.uid() is not null and o.user_id = auth.uid())
    or (coalesce(p_phone, '') <> '' and o.phone_normalized = public.normalize_phone(p_phone))
    or (coalesce(p_saved, false) and (o.user_id is null or o.user_id = auth.uid()))
    or public.is_admin()
  ) then return null; end if;
  return public.order_summary_json(o) || jsonb_build_object(
    'editable', o.status = 'new',
    'music_link', o.music_link,
    'lines', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'package_id', coalesce(i.type_option_id, i.package_id), 'package_name', i.package_name,
                          'quantity', i.quantity, 'copies_mode', i.copies_mode,
                          'front_pages', coalesce(op.front_pages, p.front_pages), 'back_pages', coalesce(op.back_pages, p.back_pages),
                          'has_disc', coalesce(op.has_disc, p.has_disc)) order by i.position)
                       from public.order_items i
                       left join public.options op on op.id = coalesce(i.type_option_id, i.package_id)
                       left join public.packages p on p.id = i.package_id
                       where i.order_id = o.id), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'kind', f.kind, 'page', f.page, 'order_item_id', f.order_item_id,
                          'copy_no', f.copy_no, 'file_name', f.file_name, 'mime_type', f.mime_type, 'storage_path', f.storage_path,
                          'created_at', f.created_at) order by f.created_at)
                       from public.order_files f where f.order_id = o.id), '[]'::jsonb)
  );
end $$;

-- Quyền
revoke all on function public.catalog_line(jsonb) from public;
revoke all on function public.priced_lines(jsonb) from public;
revoke all on function public.discount_value(public.discounts, jsonb, integer) from public;
grant execute on function public.shipping_quote(integer) to anon, authenticated;
grant execute on function public.get_public_discounts() to anon, authenticated;
grant execute on function public.check_discount_code(text, uuid, integer, jsonb, text, jsonb) to anon, authenticated;
grant execute on function public.create_order(text, text, text, text, uuid, integer, jsonb, text, text, text, boolean, text, text, text, jsonb, uuid[]) to anon, authenticated;
