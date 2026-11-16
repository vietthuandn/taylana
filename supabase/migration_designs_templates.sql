-- =====================================================================
-- MIGRATION: Lưu thiết kế của khách + mẫu Custom CD kiểu mới
-- Chạy 1 lần trong Supabase → SQL Editor → Run (chạy lại vẫn an toàn).
-- =====================================================================

-- ---------- 1. Bảng thiết kế của khách ----------
create table if not exists public.designs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null default 'Thiết kế không tên' check (char_length(name) between 1 and 120),
  data       jsonb not null default '{}'::jsonb,   -- dữ liệu các trang
  thumbnail  text,                                 -- ảnh thu nhỏ (data URL nhỏ)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists designs_user_idx on public.designs (user_id, updated_at desc);

drop trigger if exists designs_touch on public.designs;
create trigger designs_touch before update on public.designs
  for each row execute function public.touch_updated_at();

alter table public.designs enable row level security;
grant select, insert, update, delete on public.designs to authenticated;

-- Mỗi khách chỉ xem/sửa/xoá thiết kế của mình; admin xem được tất cả
drop policy if exists "designs: chủ xem" on public.designs;
create policy "designs: chủ xem" on public.designs for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "designs: chủ tạo" on public.designs;
create policy "designs: chủ tạo" on public.designs for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "designs: chủ sửa" on public.designs;
create policy "designs: chủ sửa" on public.designs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "designs: chủ xoá" on public.designs;
create policy "designs: chủ xoá" on public.designs for delete to authenticated
  using (user_id = auth.uid());

-- ---------- 2. Kho ảnh riêng tư của khách (thư mục theo user_id) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('design-assets', 'design-assets', false, 31457280,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "design-assets: chủ quản lý" on storage.objects;
create policy "design-assets: chủ quản lý" on storage.objects for all to authenticated
  using (bucket_id = 'design-assets' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'design-assets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "design-assets: admin xem" on storage.objects;
create policy "design-assets: admin xem" on storage.objects for select to authenticated
  using (bucket_id = 'design-assets' and public.is_admin());

-- ---------- 3. Mẫu Custom CD kiểu mới ----------
-- doc = nội dung mẫu tạo bằng trình chỉnh (ảnh trang trí, khung ảnh, chữ, màu/ảnh nền)
alter table public.design_templates add column if not exists doc jsonb;
-- Loại mẫu: thêm Bìa sau - Mặt Ngoài / Mặt Trong ('back' cũ = Mặt Ngoài)
alter table public.design_templates drop constraint if exists design_templates_target_check;
alter table public.design_templates add constraint design_templates_target_check
  check (target in ('front', 'back', 'back_outer', 'back_inner', 'disc'));
