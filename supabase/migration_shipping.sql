-- =====================================================================
-- PHÍ VẬN CHUYỂN: phí mặc định + miễn phí khi tiền hàng (trước giảm giá) ≥ ngưỡng.
-- Cần chạy SAU migration_cart_orders.sql. Chạy 1 lần trong Supabase → SQL Editor. Chạy lại cũng không sao.
-- Tổng đơn = tiền hàng − giảm giá + phí ship (tính ở server). QR thanh toán dùng đúng tổng này.
-- =====================================================================

-- Cài đặt (bảng site_settings, key "shipping"): ai cũng đọc được, chỉ admin sửa (policy có sẵn)
insert into public.site_settings (key, value) values ('shipping', jsonb_build_object(
  'fee', 30000, 'free_enabled', false, 'free_threshold', 100000, 'note', ''
)) on conflict (key) do nothing;

-- Lưu vào đơn
alter table public.orders add column if not exists shipping_fee integer not null default 0;
alter table public.orders add column if not exists shipping_free boolean not null default false;

-- create_order: thêm phí vận chuyển (giữ nguyên tham số → các trang đang gọi không cần đổi)
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
  v_ship    jsonb := (select value from public.site_settings where key = 'shipping');
  v_fee     integer := 0;
  v_free    boolean := false;
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

  -- Phí vận chuyển: tính ở SERVER theo cài đặt. Freeship khi TIỀN HÀNG TRƯỚC GIẢM GIÁ ≥ ngưỡng.
  v_fee := greatest(0, coalesce((v_ship->>'fee')::int, 0));
  if coalesce((v_ship->>'free_enabled')::boolean, false) and v_sub >= greatest(0, coalesce((v_ship->>'free_threshold')::int, 0)) then
    v_free := true;
    v_fee := 0;
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
                             total, shipping_fee, shipping_free, music_link, province, ward, street)
  values (v_code, p_order_type, trim(p_customer_name), v_phone, v_phone, auth.uid(), v_address, coalesce(p_note, ''), v_first,
          greatest(1, coalesce((v_lines->0->>'qty')::int, 1)), v_items, v_sub, v_best.id,
          case when v_best.kind = 'private' then v_best.code end,
          case when v_best.id is not null then coalesce(nullif(v_best.label, ''), v_best.code, 'Ưu đãi toàn shop') end,
          v_best_amt, v_sub - v_best_amt + v_fee, v_fee, v_free, coalesce(p_music_link, ''),
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

  return query select v_id, v_code, v_sub - v_best_amt + v_fee;
end $$;
grant execute on function public.create_order(text, text, text, text, uuid, integer, jsonb, text, text, text, boolean, text, text, text, jsonb) to anon, authenticated;

grant execute on function public.create_order(text, text, text, text, uuid, integer, jsonb, text, text, text, boolean, text, text, text, jsonb) to anon, authenticated;
