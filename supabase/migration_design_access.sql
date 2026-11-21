-- =====================================================================
-- Quyền dùng trang Thiết kế (khi bật "Yêu cầu số điện thoại / mã đơn hàng" ở Admin → Giao diện → Thiết kế)
--   · Mã đơn Shopee do admin nhập (Admin → Tổng quan → Đơn hàng Shopee): khách nhập mã → dùng được 7 ngày kể từ lần nhập đầu.
--     Khách đăng nhập → mã được gán vào tài khoản (lần sau tự vào được, không cần nhập lại).
--   · Số điện thoại có đơn đặt trên web CHƯA "Đã giao" → dùng được tới khi đơn được đánh dấu Đã giao.
--   · Kiểm tra bằng hàm security definer (gọi thẳng từ trình duyệt qua Supabase — không tốn CPU của Vercel).
--   · Dọn mã hết hạn: pg_cron chạy NGAY TRONG database mỗi ngày 1 lần (không gọi Vercel).
-- Chạy 1 lần trong Supabase → SQL Editor (chạy lại cũng không sao). Cần migration_cart_orders.sql (normalize_phone) + is_admin().
-- =====================================================================
create table if not exists public.shopee_codes (
  code          text primary key,
  active        boolean not null default true,      -- admin "Tạm ngưng" = false
  activated_at  timestamptz,                         -- lần đầu khách nhập
  expires_at    timestamptz,                         -- activated_at + 7 ngày
  user_id       uuid references auth.users(id) on delete set null, -- gán khi khách đã đăng nhập
  note          text not null default '',
  created_at    timestamptz not null default now()
);
create index if not exists shopee_codes_user_idx on public.shopee_codes (user_id);
alter table public.shopee_codes enable row level security;
drop policy if exists "shopee_codes: admin toàn quyền" on public.shopee_codes;
create policy "shopee_codes: admin toàn quyền" on public.shopee_codes for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.design_code_norm(p text) returns text language sql immutable as $$
  select upper(regexp_replace(coalesce(p, ''), '\s', '', 'g'))
$$;

-- khách nhập SĐT hoặc mã đơn Shopee → { ok, kind, until, reason }
create or replace function public.design_access(p_value text) returns jsonb language plpgsql security definer set search_path = public as $$
declare ph text := public.normalize_phone(p_value); c public.shopee_codes; v text := public.design_code_norm(p_value);
begin
  if ph is not null and exists (select 1 from public.orders where phone_normalized = ph and status <> 'delivered') then
    return jsonb_build_object('ok', true, 'kind', 'order');
  end if;
  select * into c from public.shopee_codes where code = v;
  if not found then
    return jsonb_build_object('ok', false, 'reason', case when ph is not null then 'phone' else 'code' end);
  end if;
  if not c.active then return jsonb_build_object('ok', false, 'reason', 'paused'); end if;
  if c.expires_at is not null and c.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  update public.shopee_codes set
    activated_at = coalesce(activated_at, now()),
    expires_at = coalesce(expires_at, now() + interval '7 days'),
    user_id = coalesce(user_id, auth.uid())
  where code = v returning * into c;
  return jsonb_build_object('ok', true, 'kind', 'code', 'until', c.expires_at);
end $$;
grant execute on function public.design_access(text) to anon, authenticated;

-- khách đã đăng nhập: có quyền không (mã Shopee đã gán còn hạn · đơn web chưa giao theo tài khoản / SĐT tài khoản)
create or replace function public.my_design_access() returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); ph text; u timestamptz;
begin
  if uid is null then return jsonb_build_object('ok', false); end if;
  -- tài khoản nội bộ (admin / nhà thiết kế) luôn vào được
  if exists (select 1 from public.staff_roles where user_id = uid and not disabled) then return jsonb_build_object('ok', true, 'kind', 'staff'); end if;
  select max(expires_at) into u from public.shopee_codes where user_id = uid and active and expires_at > now();
  if u is not null then return jsonb_build_object('ok', true, 'kind', 'code', 'until', u); end if;
  select public.normalize_phone(coalesce(raw_user_meta_data->>'phone', split_part(email, '@', 1))) into ph from auth.users where id = uid;
  if exists (select 1 from public.orders where status <> 'delivered' and (user_id = uid or (ph is not null and phone_normalized = ph))) then
    return jsonb_build_object('ok', true, 'kind', 'order');
  end if;
  return jsonb_build_object('ok', false);
end $$;
grant execute on function public.my_design_access() to authenticated;

-- dọn mỗi ngày 1 lần (03:17 giờ server): xoá mã đã hết hạn 7 ngày — chạy trong database, không tốn CPU Vercel
create extension if not exists pg_cron;
select cron.unschedule('expire-shopee-codes') where exists (select 1 from cron.job where jobname = 'expire-shopee-codes');
select cron.schedule('expire-shopee-codes', '17 3 * * *', $$ delete from public.shopee_codes where expires_at is not null and expires_at < now() $$);
