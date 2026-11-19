-- =====================================================================
-- TEMPLATE CANVA: thẻ "Thiết kế từ Canva Template" ở trang Thiết Kế (modal danh sách template).
--   · bảng canva_templates (tên, kích thước hiển thị, loại, ảnh xem trước, link Canva, bật/tắt, thứ tự) + nạp sẵn 3 template
--   · cài đặt nút "Dùng template" ở site_settings key "canva_button" ({ icon_url, label })
--   · bucket "mockups": cho phép thêm ảnh SVG (icon nút)
-- RLS: ai cũng đọc được template đang bật, chỉ admin được thêm / sửa / xoá.
-- Chạy 1 lần trong Supabase → SQL Editor (chạy lại cũng không sao). Cần chạy migration_mockups.sql trước.
-- =====================================================================
create table if not exists public.canva_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  size_label  text not null default '',
  kind        text not null default 'other' check (kind in ('front', 'back', 'cd', 'other')),
  image_url   text,                          -- ảnh xem trước (bucket "mockups" hoặc link ngoài); trống = khung mô phỏng
  canva_url   text not null check (canva_url ~* '^https://([a-z0-9-]+\.)*canva\.(com|link)(/|$)'),
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.canva_templates enable row level security;
grant select on public.canva_templates to anon, authenticated;
grant insert, update, delete on public.canva_templates to authenticated;
drop policy if exists "canva_templates: đọc bản đang bật" on public.canva_templates;
create policy "canva_templates: đọc bản đang bật" on public.canva_templates for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "canva_templates: admin toàn quyền" on public.canva_templates;
create policy "canva_templates: admin toàn quyền" on public.canva_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 3 template có sẵn (ảnh xem trước để trống — admin tự tải lên)
insert into public.canva_templates (name, size_label, kind, canva_url, sort_order)
select v.name, v.size_label, v.kind, v.url, v.ord from (values
  ('Bìa trước / Booklet', '12 × 12 cm', 'front', 'https://canva.link/l6076rpnslmc8ey', 1),
  ('Bìa sau', '15 × 11.7 cm', 'back', 'https://canva.link/gt85a63fuf72wxa', 2),
  ('Mặt đĩa CD', '12 × 12 cm (tròn)', 'cd', 'https://canva.link/vdtfiwmser3ejgv', 3)
) as v(name, size_label, kind, url, ord)
where not exists (select 1 from public.canva_templates t where t.canva_url = v.url);

-- Cài đặt nút (site_settings: ai cũng đọc, chỉ admin sửa — theo policy có sẵn)
insert into public.site_settings (key, value)
values ('canva_button', '{"icon_url": null, "label": "Dùng template"}'::jsonb)
on conflict (key) do nothing;

-- Bucket "mockups": thêm SVG (icon nút "Dùng template")
update storage.buckets
set allowed_mime_types = (select array(select distinct unnest(coalesce(allowed_mime_types, array[]::text[]) || array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])))
where id = 'mockups';
