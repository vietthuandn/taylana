-- Quản lý tài khoản → tab "Khách hàng": dung lượng ảnh khách đã dùng (thiết kế đã lưu + sticker tự tải lên).
-- Dung lượng ghi sẵn khi tải lên (/api/storage/upload-url) → mở trang không phải liệt kê bucket.
-- Chỉ server (service role) đọc / ghi bảng này: bật RLS, không tạo policy.
create table if not exists public.user_files (
  key        text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  size       bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists user_files_user_idx on public.user_files (user_id);
alter table public.user_files enable row level security;
