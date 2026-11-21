-- Thông báo cho admin (icon chuông trong trang quản trị): đơn mới · khách đăng ký tài khoản · khách dùng quá 100MB ảnh.
-- Ghi bằng trigger (security definer) — trình duyệt không tự thêm được. Chỉ admin đọc / đánh dấu đã đọc.
-- Cần chạy sau migration_customers.sql (bảng user_files) và migration_staff_templates.sql (hàm is_admin). Chạy lại cũng không sao.
create table if not exists public.admin_notifications (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('order', 'signup', 'storage')),
  title      text not null,
  body       text not null default '',
  link       text,
  ref        text, -- khoá chống trùng (vd. user id cho thông báo dung lượng)
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists admin_notifications_created_idx on public.admin_notifications (created_at desc);
alter table public.admin_notifications enable row level security;
drop policy if exists "admin đọc thông báo" on public.admin_notifications;
create policy "admin đọc thông báo" on public.admin_notifications for select using (public.is_admin());
drop policy if exists "admin đánh dấu đã đọc" on public.admin_notifications;
create policy "admin đánh dấu đã đọc" on public.admin_notifications for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin xoá thông báo" on public.admin_notifications;
create policy "admin xoá thông báo" on public.admin_notifications for delete using (public.is_admin());

-- 1. đơn mới
create or replace function public.notify_new_order() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_notifications (kind, title, body, link)
  values ('order', 'Đơn mới ' || new.code, coalesce(new.customer_name, '') || ' · ' || to_char(coalesce(new.total, 0), 'FM999G999G999') || 'đ', '/admin/don-hang/' || new.id);
  return new;
end $$;
drop trigger if exists orders_notify_new on public.orders;
create trigger orders_notify_new after insert on public.orders for each row execute function public.notify_new_order();

-- 2. khách đăng ký tài khoản (email ảo …@khach.taylana.vn)
create or replace function public.notify_new_customer() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email like '%@khach.taylana.vn' then
    insert into public.admin_notifications (kind, title, body, link)
    values ('signup', 'Khách mới đăng ký', coalesce(new.raw_user_meta_data->>'display_name', '') || ' · ' || split_part(new.email, '@', 1), '/admin/tai-khoan?tab=khach-hang');
  end if;
  return new;
end $$;
drop trigger if exists auth_users_notify_new on auth.users;
create trigger auth_users_notify_new after insert on auth.users for each row execute function public.notify_new_customer();

-- 3. khách dùng quá 100MB ảnh (báo 1 lần mỗi khách — khi vừa vượt ngưỡng)
create or replace function public.notify_user_storage() returns trigger language plpgsql security definer set search_path = public as $$
declare total bigint; who text;
begin
  select coalesce(sum(size), 0) into total from public.user_files where user_id = new.user_id;
  if total >= 100 * 1024 * 1024 and total - new.size < 100 * 1024 * 1024
     and not exists (select 1 from public.admin_notifications where kind = 'storage' and ref = new.user_id::text and created_at > now() - interval '1 day') then
    select coalesce(raw_user_meta_data->>'display_name', '') || ' · ' || split_part(email, '@', 1) into who from auth.users where id = new.user_id;
    insert into public.admin_notifications (kind, title, body, link, ref)
    values ('storage', 'Khách dùng quá 100MB ảnh', coalesce(who, '') || ' · ' || round(total / 1048576.0) || 'MB', '/admin/tai-khoan?tab=khach-hang', new.user_id::text);
  end if;
  return new;
end $$;
drop trigger if exists user_files_notify on public.user_files;
create trigger user_files_notify after insert on public.user_files for each row execute function public.notify_user_storage();
