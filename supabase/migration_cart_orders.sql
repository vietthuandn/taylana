-- =====================================================================
-- GIỎ HÀNG + ĐƠN NHIỀU DÒNG + "ĐƠN HÀNG CỦA TÔI" + GỬI FILE THEO ĐƠN + CHUẨN HOÁ SĐT
-- Cần chạy SAU migration_payment.sql và migration_discounts.sql.
-- Chạy 1 lần trong Supabase → SQL Editor. Chạy lại cũng không sao.
-- =====================================================================

-- ---------- 1. Chuẩn hoá số điện thoại (giống hệt lib/phone.ts) ----------
-- Bỏ khoảng trắng . - ( ) ; +84 / 84xxxxxxxxx → 0xxxxxxxxx ; 9 số → thêm 0. Hợp lệ: đúng 10 số, bắt đầu bằng 0. Sai → null.
create or replace function public.normalize_phone(p text)
returns text language plpgsql immutable as $$
declare v text := regexp_replace(coalesce(p, ''), '[\s\.\-\(\)]', '', 'g');
begin
  if v like '+84%' then v := '0' || substr(v, 4);
  elsif v ~ '^84[0-9]{9}$' then v := '0' || substr(v, 3);
  elsif v ~ '^[1-9][0-9]{8}$' then v := '0' || v;
  end if;
  if v ~ '^0[0-9]{9}$' then return v; end if;
  return null;
end $$;
grant execute on function public.normalize_phone(text) to anon, authenticated;

-- ---------- 2. Cột mới cho đơn ----------
alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists phone_normalized text;
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_phone_norm_idx on public.orders (phone_normalized);

-- Chuẩn hoá SĐT cũ trong đơn và lượt dùng mã giảm giá
update public.orders set phone_normalized = public.normalize_phone(phone) where phone_normalized is null;
update public.orders set phone = phone_normalized where phone_normalized is not null and phone <> phone_normalized;
update public.discount_usages set phone = public.normalize_phone(phone)
where public.normalize_phone(phone) is not null and phone <> public.normalize_phone(phone);

-- Tài khoản khách cũ (email ảo <SĐT>@khach.taylana.vn): đưa về SĐT đã chuẩn hoá (bỏ qua nếu trùng)
do $$
declare r record; v text;
begin
  for r in select id, email from auth.users where email like '%@khach.taylana.vn' loop
    v := public.normalize_phone(split_part(r.email, '@', 1));
    if v is not null then
      if v || '@khach.taylana.vn' <> r.email and not exists (select 1 from auth.users where email = v || '@khach.taylana.vn') then
        update auth.users set email = v || '@khach.taylana.vn' where id = r.id;
        update auth.identities set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', v || '@khach.taylana.vn')
        where user_id = r.id and provider = 'email';
      end if;
      update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('phone', v) where id = r.id;
    end if;
  end loop;
end $$;

-- Đơn cũ chưa có chủ: gắn vào tài khoản có cùng SĐT
update public.orders o set user_id = u.id
from auth.users u
where o.user_id is null and o.phone_normalized is not null and u.email = o.phone_normalized || '@khach.taylana.vn';

-- ---------- 3. Dòng sản phẩm của đơn ----------
create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  position     integer not null default 1,
  package_id   uuid references public.packages(id) on delete set null,
  package_name text not null default '',
  unit_price   integer not null default 0,           -- đơn giá gói lúc đặt
  quantity     integer not null default 1 check (quantity between 1 and 1000),
  addons       jsonb not null default '[]'::jsonb,   -- [{id, name, price, qty}] — giá lúc đặt
  line_total   integer not null default 0,
  copies_mode  text not null default 'same' check (copies_mode in ('same', 'different')), -- file: các bản giống / khác nhau
  created_at   timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items (order_id, position);

-- Đơn cũ (1 gói): tạo 1 dòng từ orders.items
insert into public.order_items (order_id, position, package_id, package_name, unit_price, quantity, addons, line_total)
select o.id, 1,
       nullif(pk->>'id', '')::uuid, coalesce(pk->>'name', ''), coalesce((pk->>'price')::int, 0), greatest(1, coalesce((pk->>'qty')::int, o.quantity)),
       coalesce((select jsonb_agg(jsonb_build_object('id', a->>'id', 'name', a->>'name', 'price', (a->>'price')::int, 'qty', (a->>'qty')::int))
                 from jsonb_array_elements(o.items) a where a->>'type' = 'addon'), '[]'::jsonb),
       coalesce(o.subtotal, o.total)
from public.orders o
left join lateral (select x as pk from jsonb_array_elements(o.items) x where x->>'type' = 'package' limit 1) p on true
where not exists (select 1 from public.order_items i where i.order_id = o.id)
  and (p.pk is not null or o.package_id is not null);

-- File đã nộp: gắn theo dòng sản phẩm + số bản (khi "Mỗi bản khác nhau")
alter table public.order_files add column if not exists order_item_id uuid references public.order_items(id) on delete set null;
alter table public.order_files add column if not exists copy_no integer not null default 1;
create index if not exists order_files_item_idx on public.order_files (order_item_id);
update public.order_files f set order_item_id = i.id
from public.order_items i
where f.order_item_id is null and i.order_id = f.order_id
  and (select count(*) from public.order_items x where x.order_id = f.order_id) = 1;

-- ---------- 4. Giỏ hàng theo tài khoản ----------
create table if not exists public.carts (
  user_id    uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  updated_at timestamptz not null default now()
);
create table if not exists public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  quantity   integer not null default 1 check (quantity between 1 and 1000),
  addons     jsonb not null default '[]'::jsonb,   -- [{id, qty}]
  unit_price integer not null default 0,           -- giá lúc thêm vào giỏ (để báo khi đổi giá)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cart_items_user_idx on public.cart_items (user_id, created_at);

-- ---------- 5. RLS ----------
alter table public.order_items enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
grant select, insert, update, delete on public.order_items, public.carts, public.cart_items to authenticated;

drop policy if exists "order_items: admin toàn quyền" on public.order_items;
create policy "order_items: admin toàn quyền" on public.order_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "order_items: chủ đơn đọc" on public.order_items;
create policy "order_items: chủ đơn đọc" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

-- Khách đăng nhập: chỉ xem đơn có user_id là mình (và file của đơn đó)
drop policy if exists "orders: chủ đơn đọc" on public.orders;
create policy "orders: chủ đơn đọc" on public.orders for select to authenticated using (user_id = auth.uid());
drop policy if exists "order_files: chủ đơn đọc" on public.order_files;
create policy "order_files: chủ đơn đọc" on public.order_files for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

drop policy if exists "carts: của mình" on public.carts;
create policy "carts: của mình" on public.carts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "cart_items: của mình" on public.cart_items;
create policy "cart_items: của mình" on public.cart_items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Chủ đơn xem được ảnh đã gửi (thư mục đầu tiên của file = id đơn)
create or replace function public.order_owned_by_me(p_order_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.orders where id::text = p_order_id and user_id = auth.uid());
$$;
grant execute on function public.order_owned_by_me(text) to authenticated;
drop policy if exists "order-files: chủ đơn đọc" on storage.objects;
create policy "order-files: chủ đơn đọc" on storage.objects for select to authenticated
  using (bucket_id = 'order-files' and public.order_owned_by_me((storage.foldername(name))[1]));

-- Chỉ nhận / thay file khi đơn còn "Mới". Từ "Đang làm" trở đi chỉ xem.
create or replace function public.order_accepts_files(p_order_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.orders where id::text = p_order_id and status = 'new');
$$;

-- ---------- 6. Giỏ hàng → danh sách sản phẩm có giá từ database ----------
-- p_lines: [{ "package_id": "...", "qty": 2, "addons": [{ "id": "...", "qty": 1 }] }]
-- Trả về: [{ package_id, package_name, unit_price, qty, addons:[{id,name,price,qty}], line_total }]
create or replace function public.priced_lines(p_lines jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  l jsonb; out jsonb := '[]'::jsonb; v_pkg public.packages; v_qty int; v_addons jsonb; v_total int;
begin
  for l in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    select * into v_pkg from public.packages where id = nullif(l->>'package_id', '')::uuid and is_active;
    if not found then raise exception 'Gói sản phẩm không tồn tại hoặc đã ngừng bán'; end if;
    v_qty := greatest(1, least(coalesce((l->>'qty')::int, 1), 1000));
    select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'price', a.price,
                    'qty', greatest(1, least(coalesce((e->>'qty')::int, 1), 1000)))), '[]'::jsonb)
      into v_addons
    from jsonb_array_elements(coalesce(l->'addons', '[]'::jsonb)) e
    join public.addons a on a.id = (e->>'id')::uuid and a.is_active
    where coalesce((e->>'qty')::int, 1) > 0;
    v_total := v_pkg.price * v_qty + coalesce((select sum((x->>'price')::int * (x->>'qty')::int) from jsonb_array_elements(v_addons) x), 0);
    out := out || jsonb_build_object('package_id', v_pkg.id, 'package_name', v_pkg.name, 'unit_price', v_pkg.price,
                                     'qty', v_qty, 'addons', v_addons, 'line_total', v_total);
  end loop;
  return out;
end $$;

-- Danh sách phẳng (gói + phụ kiện) để tính giảm giá — cùng định dạng discount_cart
create or replace function public.flat_items(p_priced jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select jsonb_build_object('type', 'package', 'id', l->>'package_id', 'name', l->>'package_name',
                              'price', (l->>'unit_price')::int, 'qty', (l->>'qty')::int) as x
    from jsonb_array_elements(p_priced) l
    union all
    select jsonb_build_object('type', 'addon', 'id', a->>'id', 'name', a->>'name', 'price', (a->>'price')::int, 'qty', (a->>'qty')::int)
    from jsonb_array_elements(p_priced) l, jsonb_array_elements(l->'addons') a
  ) t;
$$;

-- ---------- 7. Kiểm tra mã giảm giá (hỗ trợ nhiều dòng) ----------
drop function if exists public.check_discount_code(text, uuid, integer, jsonb, text);
drop function if exists public.check_discount_code(text, uuid, integer, jsonb, text, jsonb);
create or replace function public.check_discount_code(p_code text, p_package_id uuid default null, p_quantity integer default 1,
                                                      p_addons jsonb default '[]'::jsonb, p_phone text default '', p_lines jsonb default null)
returns table (ok boolean, message text, amount integer, label text, need integer, potential integer)
language plpgsql stable security definer set search_path = public as $$
declare
  d       public.discounts;
  v_items jsonb;
  v_sub   integer;
  v_amt   integer;
  v_prob  text;
begin
  if p_lines is not null and jsonb_array_length(p_lines) > 0 then
    v_items := public.flat_items(public.priced_lines(p_lines));
  else
    v_items := public.discount_cart(p_package_id, p_quantity, p_addons);
  end if;
  select coalesce(sum((x->>'price')::int * (x->>'qty')::int), 0) into v_sub from jsonb_array_elements(v_items) x;
  select * into d from public.discounts
  where kind = 'private' and upper(code) = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')) limit 1;
  if not found then
    return query select false, 'Mã giảm giá không đúng'::text, 0, ''::text, 0, 0; return;
  end if;
  v_prob := public.discount_problem(d, coalesce(public.normalize_phone(p_phone), ''));
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

-- ---------- 8. create_order: nhiều dòng (p_lines) + user_id + SĐT chuẩn hoá ----------
drop function if exists public.create_order(text, text, text, text, uuid, integer, jsonb, text, text, text, boolean, text, text, text);
drop function if exists public.create_order(text, text, text, text, uuid, integer, jsonb, text, text, text, boolean, text, text, text, jsonb);
create or replace function public.create_order(
  p_customer_name text,
  p_phone         text,
  p_address       text default '',
  p_note          text default '',
  p_package_id    uuid default null,
  p_quantity      integer default 1,
  p_addons        jsonb default '[]'::jsonb,
  p_order_type    text default 'cd',
  p_music_link    text default '',
  p_discount_code text default '',
  p_auto_discount boolean default true,
  p_province      text default '',
  p_ward          text default '',
  p_street        text default '',
  p_lines         jsonb default null           -- nhiều dòng (từ giỏ hàng); null = 1 dòng từ p_package_id
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
  v_best    public.discounts;
  v_best_amt integer := 0;
  v_amt     integer;
  v_prob    text;
  v_dcode   text := upper(regexp_replace(coalesce(p_discount_code, ''), '\s', '', 'g'));
  v_first   uuid;
  l         jsonb;
  i         int := 0;
begin
  if char_length(trim(coalesce(p_customer_name, ''))) not between 1 and 100 then
    raise exception 'Vui lòng nhập tên (tối đa 100 ký tự)';
  end if;
  if v_phone is null then raise exception 'Số điện thoại không hợp lệ'; end if;
  if char_length(coalesce(p_address, '')) > 500 or char_length(coalesce(p_note, '')) > 2000
     or char_length(coalesce(p_music_link, '')) > 1000
     or char_length(coalesce(p_province, '')) > 100 or char_length(coalesce(p_ward, '')) > 100
     or char_length(coalesce(p_street, '')) > 300 then
    raise exception 'Nội dung quá dài';
  end if;
  if p_order_type not in ('cd', 'custom_cd', 'photostrip') then raise exception 'Loại đơn không hợp lệ'; end if;

  -- Các dòng sản phẩm, giá lấy từ database
  if p_lines is not null and jsonb_array_length(p_lines) > 0 then
    if jsonb_array_length(p_lines) > 50 then raise exception 'Đơn có quá nhiều sản phẩm'; end if;
    v_lines := public.priced_lines(p_lines);
  elsif p_package_id is not null then
    v_lines := public.priced_lines(jsonb_build_array(jsonb_build_object('package_id', p_package_id, 'qty', p_quantity, 'addons', coalesce(p_addons, '[]'::jsonb))));
  else
    if p_order_type = 'cd' then raise exception 'Vui lòng chọn một gói sản phẩm'; end if;
    v_lines := '[]'::jsonb;
  end if;
  v_items := public.flat_items(v_lines);
  if p_package_id is null and (p_lines is null or jsonb_array_length(p_lines) = 0) then
    v_items := v_items || public.discount_cart(null, 1, p_addons); -- đơn không gói (photostrip...) chỉ có phụ kiện
  end if;
  select coalesce(sum((x->>'price')::int * (x->>'qty')::int), 0) into v_sub from jsonb_array_elements(v_items) x;

  -- Mã riêng tư
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
  -- Toàn shop (lấy cái giảm nhiều hơn; mỗi đơn chỉ 1 giảm giá)
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

  loop
    v_code := 'TL-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD') || '-' ||
              (select string_agg(substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1), '') from generate_series(1, 4));
    exit when not exists (select 1 from public.orders where code = v_code);
  end loop;

  v_first := nullif(v_lines->0->>'package_id', '')::uuid;
  insert into public.orders (code, order_type, customer_name, phone, phone_normalized, user_id, address, note, package_id,
                             quantity, items, subtotal, discount_id, discount_code, discount_label, discount_amount,
                             total, music_link, province, ward, street)
  values (v_code, p_order_type, trim(p_customer_name), v_phone, v_phone, auth.uid(), v_address, coalesce(p_note, ''), v_first,
          greatest(1, coalesce((v_lines->0->>'qty')::int, 1)), v_items, v_sub, v_best.id,
          case when v_best.kind = 'private' then v_best.code end,
          case when v_best.id is not null then coalesce(nullif(v_best.label, ''), v_best.code, 'Ưu đãi toàn shop') end,
          v_best_amt, v_sub - v_best_amt, coalesce(p_music_link, ''),
          trim(coalesce(p_province, '')), trim(coalesce(p_ward, '')), trim(coalesce(p_street, '')))
  returning id into v_id;

  for l in select * from jsonb_array_elements(v_lines) loop
    i := i + 1;
    insert into public.order_items (order_id, position, package_id, package_name, unit_price, quantity, addons, line_total)
    values (v_id, i, (l->>'package_id')::uuid, l->>'package_name', (l->>'unit_price')::int, (l->>'qty')::int, l->'addons', (l->>'line_total')::int);
  end loop;

  if v_best.id is not null then
    update public.discounts set used_count = used_count + 1 where id = v_best.id;
    insert into public.discount_usages (discount_id, order_id, phone, amount) values (v_best.id, v_id, v_phone, v_best_amt);
  end if;

  return query select v_id, v_code, v_sub - v_best_amt;
end $$;
grant execute on function public.create_order(text, text, text, text, uuid, integer, jsonb, text, text, text, boolean, text, text, text, jsonb) to anon, authenticated;

-- ---------- 9. Tra cứu đơn / đơn đã lưu trên trình duyệt / gắn đơn vào tài khoản ----------
-- Thông tin tóm tắt (không có tên, SĐT, địa chỉ)
create or replace function public.order_summary_json(o public.orders)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'code', o.code, 'payment_code', o.payment_code, 'created_at', o.created_at,
    'total', o.total, 'amount_due', o.amount_due, 'status', o.status, 'payment_status', o.payment_status,
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'package_id', i.package_id, 'package_name', i.package_name,
                         'quantity', i.quantity, 'addons', i.addons, 'unit_price', i.unit_price, 'line_total', i.line_total,
                         'copies_mode', i.copies_mode) order by i.position)
                       from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'file_count', (select count(*) from public.order_files f where f.order_id = o.id)
  );
$$;

-- Tra cứu khi chưa đăng nhập: cần ĐÚNG CẢ mã đơn lẫn SĐT
create or replace function public.lookup_order(p_code text, p_phone text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders
  where upper(code) = upper(trim(coalesce(p_code, ''))) and phone_normalized = public.normalize_phone(p_phone) limit 1;
  if not found then return null; end if;
  return public.order_summary_json(o);
end $$;

-- Đơn đã đặt trên trình duyệt này (danh sách mã trong localStorage). Mã đơn ngẫu nhiên đóng vai trò "chìa khoá".
-- Đơn đã gắn vào tài khoản khác thì không trả về.
create or replace function public.orders_by_codes(p_codes text[])
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.order_summary_json(o) order by o.created_at desc), '[]'::jsonb)
  from public.orders o
  where upper(o.code) = any (select upper(c) from unnest(coalesce(p_codes, '{}'::text[])) c limit 50)
    and (o.user_id is null or o.user_id = auth.uid());
$$;

-- Đơn của tài khoản đang đăng nhập
create or replace function public.my_orders()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.order_summary_json(o) order by o.created_at desc), '[]'::jsonb)
  from public.orders o where auth.uid() is not null and o.user_id = auth.uid();
$$;

-- Đăng ký / đăng nhập: gắn các đơn chưa có chủ có cùng SĐT (lấy từ email ảo của tài khoản)
create or replace function public.claim_my_orders()
returns integer language plpgsql security definer set search_path = public as $$
declare v_phone text; n int;
begin
  if auth.uid() is null then return 0; end if;
  v_phone := public.normalize_phone(split_part(coalesce(auth.jwt()->>'email', ''), '@', 1));
  if v_phone is null or coalesce(auth.jwt()->>'email', '') not like '%@khach.taylana.vn' then return 0; end if;
  update public.orders set user_id = auth.uid() where user_id is null and phone_normalized = v_phone;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- 10. Gửi file cho đơn ----------
-- Quyền gửi file: đơn của tài khoản đang đăng nhập, HOẶC đúng SĐT, HOẶC mã đơn có trong danh sách đã lưu trên trình duyệt
-- (p_saved = true — mã đơn ngẫu nhiên là "chìa khoá", giống trang thanh toán) và đơn chưa thuộc tài khoản khác.
-- Trả về dòng sản phẩm (kèm số trang của gói) + danh sách file đã gửi. Không lộ tên/SĐT/địa chỉ.
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
    'lines', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'package_id', i.package_id, 'package_name', i.package_name,
                          'quantity', i.quantity, 'copies_mode', i.copies_mode,
                          'front_pages', p.front_pages, 'back_pages', p.back_pages, 'has_disc', p.has_disc) order by i.position)
                       from public.order_items i left join public.packages p on p.id = i.package_id where i.order_id = o.id), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'kind', f.kind, 'page', f.page, 'order_item_id', f.order_item_id,
                          'copy_no', f.copy_no, 'file_name', f.file_name, 'mime_type', f.mime_type, 'storage_path', f.storage_path,
                          'created_at', f.created_at) order by f.created_at)
                       from public.order_files f where f.order_id = o.id), '[]'::jsonb)
  );
end $$;

-- Ghi file vừa upload — thêm dòng sản phẩm + số bản. Đơn chỉ có 1 dòng thì tự gắn vào dòng đó.
drop function if exists public.register_order_file(uuid, text, text, text, text, bigint, integer, integer, integer);
create or replace function public.register_order_file(
  p_order_id      uuid,
  p_kind          text,
  p_storage_path  text,
  p_file_name     text,
  p_mime_type     text,
  p_size_bytes    bigint,
  p_page          integer default null,
  p_width_px      integer default null,
  p_height_px     integer default null,
  p_order_item_id uuid default null,
  p_copy_no       integer default 1
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_item uuid := p_order_item_id;
begin
  if not public.order_accepts_files(p_order_id::text) then
    raise exception 'Đơn không tồn tại hoặc đã chuyển sang "Đang làm" — không thay file được nữa';
  end if;
  if split_part(p_storage_path, '/', 1) <> p_order_id::text then raise exception 'Đường dẫn file không hợp lệ'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'order-files' and name = p_storage_path) then
    raise exception 'Không tìm thấy file đã upload';
  end if;
  if v_item is not null and not exists (select 1 from public.order_items where id = v_item and order_id = p_order_id) then
    raise exception 'Dòng sản phẩm không thuộc đơn này';
  end if;
  if v_item is null and (select count(*) from public.order_items where order_id = p_order_id) = 1 then
    select id into v_item from public.order_items where order_id = p_order_id;
  end if;
  insert into public.order_files (order_id, order_item_id, copy_no, kind, page, storage_path, file_name, mime_type, size_bytes, width_px, height_px)
  values (p_order_id, v_item, greatest(1, coalesce(p_copy_no, 1)), p_kind, p_page, p_storage_path, left(coalesce(p_file_name, ''), 255),
          left(coalesce(p_mime_type, ''), 100), coalesce(p_size_bytes, 0), p_width_px, p_height_px)
  on conflict (storage_path) do nothing
  returning id into v_id;
  return v_id;
end $$;

-- Chọn "Các bản giống nhau" / "Mỗi bản khác nhau" cho 1 dòng (khi đơn còn "Mới")
create or replace function public.set_item_copies_mode(p_order_id uuid, p_item_id uuid, p_mode text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_mode not in ('same', 'different') then raise exception 'Lựa chọn không hợp lệ'; end if;
  if not public.order_accepts_files(p_order_id::text) then raise exception 'Đơn không còn nhận file'; end if;
  update public.order_items set copies_mode = p_mode where id = p_item_id and order_id = p_order_id;
end $$;

-- Link nhạc: chỉ khi đơn còn "Mới"
create or replace function public.set_order_music_link(p_order_id uuid, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if char_length(coalesce(p_link, '')) > 1000 then raise exception 'Link quá dài'; end if;
  update public.orders set music_link = coalesce(p_link, '') where id = p_order_id and status = 'new';
end $$;

-- Quyền
revoke all on function public.priced_lines(jsonb) from public;
revoke all on function public.order_summary_json(public.orders) from public;
grant execute on function public.check_discount_code(text, uuid, integer, jsonb, text, jsonb) to anon, authenticated;
grant execute on function public.lookup_order(text, text) to anon, authenticated;
grant execute on function public.orders_by_codes(text[]) to anon, authenticated;
grant execute on function public.my_orders() to authenticated;
grant execute on function public.claim_my_orders() to authenticated;
grant execute on function public.order_upload_info(text, text, boolean) to anon, authenticated;
grant execute on function public.register_order_file(uuid, text, text, text, text, bigint, integer, integer, integer, uuid, integer) to anon, authenticated;
grant execute on function public.set_item_copies_mode(uuid, uuid, text) to anon, authenticated;
grant execute on function public.set_order_music_link(uuid, text) to anon, authenticated;
