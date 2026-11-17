-- =====================================================================
-- GIẢM GIÁ (mã riêng tư + chương trình toàn shop) + địa chỉ chi tiết cho đơn.
-- Cần chạy SAU migration_payment.sql. Chạy 1 lần trong Supabase → SQL Editor. Chạy lại cũng không sao.
-- Tính giá và kiểm tra mã LUÔN ở server (hàm create_order). Trình duyệt chỉ xem trước.
-- =====================================================================

-- ---------- 1. Bảng chương trình giảm giá ----------
create table if not exists public.discounts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,                                  -- tên chương trình (chỉ admin thấy)
  label           text not null default '',                       -- tên hiển thị cho khách, ví dụ "Ưu đãi khai trương"
  kind            text not null default 'private' check (kind in ('private', 'public')), -- private = mã riêng tư, public = toàn shop
  code            text,                                           -- mã (chỉ với private), VIẾT HOA không dấu
  value_type      text not null default 'amount' check (value_type in ('amount', 'percent')),
  value           integer not null check (value > 0),             -- số tiền (đồng) hoặc % (1–100)
  max_discount    integer check (max_discount is null or max_discount > 0), -- giảm tối đa (kiểu %)
  scope           text not null default 'order' check (scope in ('order', 'items')), -- toàn bộ đơn / chỉ gói-phụ kiện được chọn
  package_ids     uuid[] not null default '{}',
  addon_ids       uuid[] not null default '{}',
  min_order       integer check (min_order is null or min_order >= 0), -- giá trị đơn tối thiểu (tạm tính)
  starts_at       timestamptz,
  ends_at         timestamptz,
  usage_limit     integer check (usage_limit is null or usage_limit > 0),     -- tổng lượt dùng tối đa
  per_phone_limit integer check (per_phone_limit is null or per_phone_limit > 0), -- lượt mỗi SĐT
  used_count      integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint discounts_code_check check (kind = 'public' or (code is not null and code ~ '^[A-Z0-9]{3,30}$')),
  constraint discounts_percent_check check (value_type = 'amount' or value <= 100)
);
create unique index if not exists discounts_code_key on public.discounts (upper(code)) where code is not null;
drop trigger if exists discounts_touch on public.discounts;
create trigger discounts_touch before update on public.discounts
  for each row execute function public.touch_updated_at();

create table if not exists public.discount_usages (
  id          uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.discounts(id) on delete cascade,
  order_id    uuid not null references public.orders(id) on delete cascade,
  phone       text not null,
  amount      integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists discount_usages_discount_idx on public.discount_usages (discount_id, created_at desc);
create index if not exists discount_usages_phone_idx on public.discount_usages (discount_id, phone);

-- RLS: khách KHÔNG đọc được bảng (mã riêng tư bí mật). Chỉ admin tạo/sửa/xoá/xem.
alter table public.discounts enable row level security;
alter table public.discount_usages enable row level security;
grant select, insert, update, delete on public.discounts, public.discount_usages to authenticated;
drop policy if exists "discounts: admin toàn quyền" on public.discounts;
create policy "discounts: admin toàn quyền" on public.discounts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "discount_usages: admin toàn quyền" on public.discount_usages;
create policy "discount_usages: admin toàn quyền" on public.discount_usages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 2. Cột mới cho đơn ----------
alter table public.orders add column if not exists subtotal integer;                 -- tổng trước giảm
alter table public.orders add column if not exists discount_id uuid references public.discounts(id) on delete set null;
alter table public.orders add column if not exists discount_code text;               -- mã đã dùng (toàn shop: để trống)
alter table public.orders add column if not exists discount_label text;
alter table public.orders add column if not exists discount_amount integer not null default 0;
alter table public.orders add column if not exists province text not null default ''; -- Tỉnh/Thành
alter table public.orders add column if not exists ward text not null default '';     -- Phường/Xã
alter table public.orders add column if not exists street text not null default '';   -- Số nhà và đường
-- Số lượng từng mục nằm trong orders.items (jsonb: type, id, name, price, qty). total = tổng SAU giảm.
update public.orders set subtotal = total where subtotal is null;

-- ---------- 3. Hàm tính giảm giá (dùng chung) ----------
-- Giỏ hàng có giá lấy từ database: [{type, id, name, price, qty}]
create or replace function public.discount_cart(p_package_id uuid, p_quantity integer, p_addons jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_agg(x) from (
      select jsonb_build_object('type', 'package', 'id', p.id, 'name', p.name, 'price', p.price,
                                'qty', greatest(1, least(coalesce(p_quantity, 1), 1000))) as x
      from public.packages p where p.id = p_package_id and p.is_active
      union all
      select jsonb_build_object('type', 'addon', 'id', a.id, 'name', a.name, 'price', a.price,
                                'qty', greatest(1, least(coalesce((e->>'qty')::int, 1), 1000)))
      from jsonb_array_elements(coalesce(p_addons, '[]'::jsonb)) e
      join public.addons a on a.id = (e->>'id')::uuid and a.is_active
      where coalesce((e->>'qty')::int, 1) > 0
    ) t
  ), '[]'::jsonb);
$$;

-- Số tiền giảm của 1 chương trình cho giỏ hàng (CHƯA xét điều kiện tối thiểu / thời gian / lượt dùng)
--   %: giảm theo % phần được áp dụng, tối đa max_discount
--   số tiền + toàn đơn: trừ 1 lần
--   số tiền + chỉ một số gói/phụ kiện: trừ cho MỖI đơn vị sản phẩm được áp dụng
create or replace function public.discount_amount_for(d public.discounts, p_items jsonb)
returns integer language plpgsql stable security definer set search_path = public as $$
declare
  v_sub  bigint := 0;
  v_base bigint := 0;
  v_unit bigint := 0;
  it     jsonb;
  v_ok   boolean;
  v_amt  bigint;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_sub := v_sub + (it->>'price')::bigint * (it->>'qty')::bigint;
    v_ok := d.scope = 'order'
      or (it->>'type' = 'package' and (it->>'id')::uuid = any(d.package_ids))
      or (it->>'type' = 'addon' and (it->>'id')::uuid = any(d.addon_ids));
    if v_ok then
      v_base := v_base + (it->>'price')::bigint * (it->>'qty')::bigint;
      v_unit := v_unit + least(d.value, (it->>'price')::bigint) * (it->>'qty')::bigint;
    end if;
  end loop;
  if v_base = 0 then return 0; end if;
  if d.value_type = 'percent' then
    v_amt := floor(v_base * d.value / 100.0);
    if d.max_discount is not null then v_amt := least(v_amt, d.max_discount); end if;
  elsif d.scope = 'order' then
    v_amt := least(d.value, v_sub);
  else
    v_amt := v_unit;
  end if;
  return least(v_amt, v_sub)::int;
end $$;

-- Lý do không dùng được (null = dùng được). Không xét giá trị tối thiểu.
create or replace function public.discount_problem(d public.discounts, p_phone text)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if not d.is_active then return 'Mã giảm giá không còn hiệu lực'; end if;
  if d.starts_at is not null and d.starts_at > now() then return 'Mã giảm giá chưa đến thời gian áp dụng'; end if;
  if d.ends_at is not null and d.ends_at < now() then return 'Mã giảm giá đã hết hạn'; end if;
  if d.usage_limit is not null and d.used_count >= d.usage_limit then return 'Mã giảm giá đã hết lượt sử dụng'; end if;
  if d.per_phone_limit is not null and coalesce(p_phone, '') <> '' and
     (select count(*) from public.discount_usages u where u.discount_id = d.id and u.phone = p_phone) >= d.per_phone_limit then
    return 'Số điện thoại này đã dùng hết lượt cho mã giảm giá';
  end if;
  return null;
end $$;

-- ---------- 4. Hàm cho khách ----------
-- Chương trình TOÀN SHOP đang hiệu lực: ai cũng đọc được tên và mức giảm (không có mã riêng tư)
drop function if exists public.get_public_discounts();
create or replace function public.get_public_discounts()
returns table (id uuid, label text, value_type text, value integer, max_discount integer, scope text,
               package_ids uuid[], addon_ids uuid[], min_order integer, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.id, coalesce(nullif(d.label, ''), 'Ưu đãi toàn shop'), d.value_type, d.value, d.max_discount, d.scope,
         d.package_ids, d.addon_ids, d.min_order, d.ends_at
  from public.discounts d
  where d.kind = 'public' and public.discount_problem(d, null) is null
  order by d.created_at;
$$;

-- Kiểm tra mã riêng tư cho giỏ hàng: chỉ trả về hợp lệ hay không + số tiền giảm (không lộ thông tin mã khác)
--   need > 0: còn thiếu bao nhiêu để đạt giá trị tối thiểu; potential: số tiền sẽ được giảm khi đủ
drop function if exists public.check_discount_code(text, uuid, integer, jsonb, text);
create or replace function public.check_discount_code(p_code text, p_package_id uuid, p_quantity integer,
                                                      p_addons jsonb default '[]'::jsonb, p_phone text default '')
returns table (ok boolean, message text, amount integer, label text, need integer, potential integer)
language plpgsql stable security definer set search_path = public as $$
declare
  d       public.discounts;
  v_items jsonb := public.discount_cart(p_package_id, p_quantity, p_addons);
  v_sub   integer;
  v_amt   integer;
  v_prob  text;
begin
  select coalesce(sum((x->>'price')::int * (x->>'qty')::int), 0) into v_sub from jsonb_array_elements(v_items) x;
  select * into d from public.discounts
  where kind = 'private' and upper(code) = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')) limit 1;
  if not found then
    return query select false, 'Mã giảm giá không đúng'::text, 0, ''::text, 0, 0; return;
  end if;
  v_prob := public.discount_problem(d, regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'));
  if v_prob is not null then
    return query select false, v_prob, 0, ''::text, 0, 0; return;
  end if;
  v_amt := public.discount_amount_for(d, v_items);
  if v_amt <= 0 then
    return query select false, 'Mã giảm giá không áp dụng cho sản phẩm bạn chọn'::text, 0, ''::text, 0, 0; return;
  end if;
  if d.min_order is not null and v_sub < d.min_order then
    return query select false, ('Đơn tối thiểu ' || to_char(d.min_order, 'FM999G999G999') || 'đ để dùng mã này')::text,
                        0, coalesce(nullif(d.label, ''), d.code), d.min_order - v_sub, v_amt; return;
  end if;
  return query select true, ''::text, v_amt, coalesce(nullif(d.label, ''), d.code), 0, v_amt;
end $$;

-- ---------- 5. create_order mới: số lượng từng mục + giảm giá + địa chỉ chi tiết ----------
drop function if exists public.create_order(text, text, text, text, uuid, integer, jsonb, text, text);
create or replace function public.create_order(
  p_customer_name text,
  p_phone         text,
  p_address       text default '',
  p_note          text default '',
  p_package_id    uuid default null,
  p_quantity      integer default 1,
  p_addons        jsonb default '[]'::jsonb,   -- [{ "id": "<uuid>", "qty": 2 }, ...]
  p_order_type    text default 'cd',
  p_music_link    text default '',
  p_discount_code text default '',             -- mã riêng tư khách nhập (nếu có)
  p_auto_discount boolean default true,        -- tự áp dụng chương trình toàn shop
  p_province      text default '',
  p_ward          text default '',
  p_street        text default ''
)
returns table (order_id uuid, order_code text, order_total integer)
language plpgsql security definer
set search_path = public
as $$
declare
  v_items   jsonb;
  v_sub     integer := 0;
  v_qty     integer := greatest(1, least(coalesce(p_quantity, 1), 1000));
  v_code    text;
  v_id      uuid;
  v_phone   text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  v_alpha   text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_address text;
  d         public.discounts;
  v_best    public.discounts;
  v_best_amt integer := 0;
  v_amt     integer;
  v_prob    text;
  v_dcode   text := upper(regexp_replace(coalesce(p_discount_code, ''), '\s', '', 'g'));
begin
  if char_length(trim(coalesce(p_customer_name, ''))) not between 1 and 100 then
    raise exception 'Vui lòng nhập tên (tối đa 100 ký tự)';
  end if;
  if char_length(v_phone) not between 8 and 15 then
    raise exception 'Số điện thoại không hợp lệ';
  end if;
  if char_length(coalesce(p_address, '')) > 500 or char_length(coalesce(p_note, '')) > 2000
     or char_length(coalesce(p_music_link, '')) > 1000
     or char_length(coalesce(p_province, '')) > 100 or char_length(coalesce(p_ward, '')) > 100
     or char_length(coalesce(p_street, '')) > 300 then
    raise exception 'Nội dung quá dài';
  end if;
  if p_order_type not in ('cd', 'custom_cd', 'photostrip') then
    raise exception 'Loại đơn không hợp lệ';
  end if;
  if p_package_id is not null and not exists (select 1 from public.packages where id = p_package_id and is_active) then
    raise exception 'Gói sản phẩm không tồn tại';
  end if;
  if p_package_id is null and p_order_type = 'cd' then
    raise exception 'Vui lòng chọn một gói sản phẩm';
  end if;

  -- Giỏ hàng tính lại theo giá trong database
  v_items := public.discount_cart(p_package_id, v_qty, p_addons);
  select coalesce(sum((x->>'price')::int * (x->>'qty')::int), 0) into v_sub from jsonb_array_elements(v_items) x;

  -- Mã riêng tư khách nhập: sai / hết hạn / hết lượt / chưa đủ điều kiện → báo lỗi rõ ràng
  if v_dcode <> '' then
    select * into d from public.discounts where kind = 'private' and upper(code) = v_dcode for update;
    if not found then raise exception 'Mã giảm giá không đúng'; end if;
    v_prob := public.discount_problem(d, v_phone);
    if v_prob is not null then raise exception '%', v_prob; end if;
    if d.min_order is not null and v_sub < d.min_order then
      raise exception 'Đơn chưa đủ giá trị tối thiểu để dùng mã %', d.code;
    end if;
    v_amt := public.discount_amount_for(d, v_items);
    if v_amt <= 0 then raise exception 'Mã giảm giá không áp dụng cho sản phẩm bạn chọn'; end if;
    v_best := d; v_best_amt := v_amt;
  end if;

  -- Chương trình toàn shop: dùng nếu giảm nhiều hơn mã riêng tư (mỗi đơn chỉ 1 giảm giá)
  if coalesce(p_auto_discount, true) then
    for d in select * from public.discounts where kind = 'public' for update loop
      if public.discount_problem(d, v_phone) is null and (d.min_order is null or v_sub >= d.min_order) then
        v_amt := public.discount_amount_for(d, v_items);
        if v_amt > v_best_amt then v_best := d; v_best_amt := v_amt; end if;
      end if;
    end loop;
  end if;

  v_address := coalesce(nullif(trim(coalesce(p_address, '')), ''),
    concat_ws(', ', nullif(trim(coalesce(p_street, '')), ''), nullif(trim(coalesce(p_ward, '')), ''), nullif(trim(coalesce(p_province, '')), '')), '');

  -- Mã đơn: TL-YYMMDD-XXXX (giờ Việt Nam)
  loop
    v_code := 'TL-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD') || '-' ||
              (select string_agg(substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1), '')
               from generate_series(1, 4));
    exit when not exists (select 1 from public.orders where code = v_code);
  end loop;

  insert into public.orders (code, order_type, customer_name, phone, address, note, package_id,
                             quantity, items, subtotal, discount_id, discount_code, discount_label, discount_amount,
                             total, music_link, province, ward, street)
  values (v_code, p_order_type, trim(p_customer_name), v_phone, v_address, coalesce(p_note, ''), p_package_id,
          v_qty, v_items, v_sub, v_best.id,
          case when v_best.kind = 'private' then v_best.code end,
          case when v_best.id is not null then coalesce(nullif(v_best.label, ''), v_best.code, 'Ưu đãi toàn shop') end,
          v_best_amt, v_sub - v_best_amt, coalesce(p_music_link, ''),
          trim(coalesce(p_province, '')), trim(coalesce(p_ward, '')), trim(coalesce(p_street, '')))
  returning id into v_id;

  -- Tăng số lượt đã dùng
  if v_best.id is not null then
    update public.discounts set used_count = used_count + 1 where id = v_best.id;
    insert into public.discount_usages (discount_id, order_id, phone, amount) values (v_best.id, v_id, v_phone, v_best_amt);
  end if;

  return query select v_id, v_code, v_sub - v_best_amt;
end $$;

-- Quyền
revoke all on function public.discount_cart(uuid, integer, jsonb) from public;
revoke all on function public.discount_amount_for(public.discounts, jsonb) from public;
revoke all on function public.discount_problem(public.discounts, text) from public;
grant execute on function public.get_public_discounts() to anon, authenticated;
grant execute on function public.check_discount_code(text, uuid, integer, jsonb, text) to anon, authenticated;
grant execute on function public.create_order(text, text, text, text, uuid, integer, jsonb, text, text, text, boolean, text, text, text) to anon, authenticated;
