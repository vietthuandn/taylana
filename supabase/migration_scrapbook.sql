-- =====================================================================
-- CD SCRAPBOOK: thư viện chất liệu (băng dính, sticker, khung ảnh, doodle, texture, mảnh giấy)
-- + cài đặt 30 mẫu (số ảnh 5–10 × 5 phong cách: seed, bật/tắt) + bucket công khai "scrapbook".
-- Chạy 1 lần trong Supabase → SQL Editor (chạy lại cũng không sao).
-- Ảnh của KHÁCH không bao giờ lưu ở đây — chỉ chất liệu do admin thêm.
-- =====================================================================

create table if not exists public.scrapbook_assets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  grp         text not null check (grp in ('tape', 'sticker', 'frame', 'doodle', 'texture', 'paper')),
  url         text not null,                       -- PNG trong suốt (bucket "scrapbook" hoặc link ngoài)
  tone        text not null default 'any',         -- tông màu: pink, red, orange, yellow, green, blue, purple, cream, mono, any
  region      jsonb,                               -- khung ảnh: vùng đặt ảnh {x0,y0,x1,y1} (0..1)
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.scrapbook_template_settings (
  n           integer not null check (n between 5 and 10),
  style       text not null check (style in ('polaroid', 'torn', 'ring', 'magazine', 'floral')),
  seed        integer not null default 1,
  is_active   boolean not null default true,
  updated_at  timestamptz not null default now(),
  primary key (n, style)
);

alter table public.scrapbook_assets enable row level security;
alter table public.scrapbook_template_settings enable row level security;
grant select on public.scrapbook_assets, public.scrapbook_template_settings to anon, authenticated;
grant insert, update, delete on public.scrapbook_assets, public.scrapbook_template_settings to authenticated;

drop policy if exists "scrapbook_assets: ai cũng đọc" on public.scrapbook_assets;
create policy "scrapbook_assets: ai cũng đọc" on public.scrapbook_assets for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "scrapbook_assets: admin toàn quyền" on public.scrapbook_assets;
create policy "scrapbook_assets: admin toàn quyền" on public.scrapbook_assets for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "scrapbook_templates: ai cũng đọc" on public.scrapbook_template_settings;
create policy "scrapbook_templates: ai cũng đọc" on public.scrapbook_template_settings for select to anon, authenticated using (true);
drop policy if exists "scrapbook_templates: admin toàn quyền" on public.scrapbook_template_settings;
create policy "scrapbook_templates: admin toàn quyền" on public.scrapbook_template_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Bucket công khai "scrapbook" (chất liệu PNG do admin upload)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('scrapbook', 'scrapbook', true, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "scrapbook: ai cũng xem" on storage.objects;
create policy "scrapbook: ai cũng xem" on storage.objects for select to anon, authenticated using (bucket_id = 'scrapbook');
drop policy if exists "scrapbook: admin tải lên" on storage.objects;
create policy "scrapbook: admin tải lên" on storage.objects for insert to authenticated with check (bucket_id = 'scrapbook' and public.is_admin());
drop policy if exists "scrapbook: admin sửa" on storage.objects;
create policy "scrapbook: admin sửa" on storage.objects for update to authenticated using (bucket_id = 'scrapbook' and public.is_admin());
drop policy if exists "scrapbook: admin xoá" on storage.objects;
create policy "scrapbook: admin xoá" on storage.objects for delete to authenticated using (bucket_id = 'scrapbook' and public.is_admin());

-- /api/img-proxy: cho phép tải hộ thêm link chất liệu scrapbook (giữ nguyên các điều kiện cũ của mockup)
create or replace function public.mockup_url_allowed(p_url text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mockup_frames where image_url = p_url)
      or exists (select 1 from public.mockup_frames f, jsonb_array_elements(f.regions) r where r->>'mask_url' = p_url)
      or exists (select 1 from public.mockup_backgrounds where url = p_url)
      or exists (select 1 from public.scrapbook_assets where url = p_url and is_active);
$$;
grant execute on function public.mockup_url_allowed(text) to anon, authenticated;
