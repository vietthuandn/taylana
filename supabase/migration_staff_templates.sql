-- =====================================================================
-- TÀI KHOẢN & PHÂN QUYỀN + MẪU SCRAPBOOK TẠO MỚI
--   · staff_roles (user_id, role 'admin' | 'designer', display_name, created_at, disabled) — chuyển toàn bộ admin cũ (bảng admins) sang role 'admin'
--   · is_admin(): chỉ role 'admin' đang hoạt động · is_staff(role): admin luôn đúng, hoặc đúng vai trò · my_staff_role()
--   · RLS: bảng chất liệu + template (và bucket "scrapbook", "mockups", thư mục templates/ photostrip/ của "public-assets",
--     các cài đặt thiết kế trong site_settings) cho phép 'admin' + 'designer'; mọi bảng khác CHỈ 'admin' (giữ nguyên is_admin()).
--   · scrapbook_templates: mẫu CD / Booklet Scrapbook tạo mới / nhân bản (không giới hạn số mẫu)
--   · scrapbook_template_settings: thêm name, sort_order; cho phép surface_type 'booklet' (bật / tắt bộ mẫu tự tạo theo số trang)
--   · Nền (màu, texture, ảnh nền, nền riêng trang phải) nằm trong cấu hình JSON của từng bề mặt (config / template) — không cần cột riêng.
-- Chạy 1 lần trong Supabase → SQL Editor (chạy lại cũng không sao). Cần các migration scrapbook / canva / mockup trước đó.
-- =====================================================================

-- ---------- 1. staff_roles ----------
create table if not exists public.staff_roles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  role         text not null check (role in ('admin', 'designer')),
  display_name text,
  created_at   timestamptz not null default now(),
  disabled     boolean not null default false
);
insert into public.staff_roles (user_id, role, display_name, created_at)
select a.user_id, 'admin', a.email, a.created_at from public.admins a
on conflict (user_id) do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid() and role = 'admin' and not disabled);
$$;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.is_staff(p_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid() and not disabled and (role = 'admin' or role = p_role));
$$;
grant execute on function public.is_staff(text) to anon, authenticated;

create or replace function public.my_staff_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.staff_roles where user_id = auth.uid() and not disabled;
$$;
grant execute on function public.my_staff_role() to anon, authenticated;

alter table public.staff_roles enable row level security;
revoke all on public.staff_roles from anon;
grant select, insert, update, delete on public.staff_roles to authenticated;
drop policy if exists "staff_roles: tự xem" on public.staff_roles;
create policy "staff_roles: tự xem" on public.staff_roles for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "staff_roles: admin toàn quyền" on public.staff_roles;
create policy "staff_roles: admin toàn quyền" on public.staff_roles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 2. mẫu scrapbook tạo mới ----------
create table if not exists public.scrapbook_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Mẫu mới',
  surface     text not null check (surface in ('disc', 'booklet')),
  n           integer not null,             -- CD: số ảnh · Booklet: số trang
  style       text,                         -- phong cách gốc (bảng màu) — null = trang trống
  config      jsonb not null default '{"surfaces": []}'::jsonb, -- { surfaces: Template[] } (lớp, nền, …)
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.scrapbook_templates enable row level security;
grant select on public.scrapbook_templates to anon, authenticated;
grant insert, update, delete on public.scrapbook_templates to authenticated;
drop policy if exists "scrapbook_templates: đọc bản đang bật" on public.scrapbook_templates;
create policy "scrapbook_templates: đọc bản đang bật" on public.scrapbook_templates for select to anon, authenticated using (is_active or public.is_staff('designer'));
drop policy if exists "scrapbook_templates: admin + nhà thiết kế" on public.scrapbook_templates;
create policy "scrapbook_templates: admin + nhà thiết kế" on public.scrapbook_templates for all to authenticated using (public.is_staff('designer')) with check (public.is_staff('designer'));

alter table public.scrapbook_template_settings add column if not exists name text;
alter table public.scrapbook_template_settings add column if not exists sort_order integer;
alter table public.scrapbook_template_settings drop constraint if exists scrapbook_template_settings_surface_check;
alter table public.scrapbook_template_settings add constraint scrapbook_template_settings_surface_check
  check ((surface_type = 'disc' and n between 5 and 10) or (surface_type = 'spread' and n between 1 and 20) or (surface_type = 'booklet' and n between 4 and 40));

-- ---------- 3. RLS: bảng chất liệu + template → admin + designer ----------
-- Đổi is_admin() thành is_staff('designer') trong MỌI policy của các bảng dưới (giữ nguyên phần điều kiện còn lại).
do $$
declare
  p record; q text; c text; sql text;
  t text[] := array['scrapbook_assets', 'scrapbook_template_settings', 'scrapbook_templates', 'frames', 'frame_sets', 'cutout_fonts', 'cutout_glyphs',
                    'cutout_training', 'wish_topics', 'wishes', 'design_templates', 'photostrip_frames', 'canva_templates', 'mockup_frames', 'mockup_backgrounds'];
begin
  for p in
    select * from pg_policies
    where (schemaname = 'public' and tablename = any (t))
       or (schemaname = 'storage' and tablename = 'objects' and (coalesce(qual, '') || coalesce(with_check, '')) ~ '''(scrapbook|mockups)''')
  loop
    q := replace(coalesce(p.qual, ''), 'is_admin()', 'is_staff(''designer''::text)');
    c := replace(coalesce(p.with_check, ''), 'is_admin()', 'is_staff(''designer''::text)');
    if q is distinct from coalesce(p.qual, '') or c is distinct from coalesce(p.with_check, '') then
      sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
      if p.qual is not null then sql := sql || format(' using (%s)', q); end if;
      if p.with_check is not null then sql := sql || format(' with check (%s)', c); end if;
      execute sql;
    end if;
  end loop;
end $$;

-- Ảnh mẫu Custom CD / khung Photostrip (bucket "public-assets", thư mục templates/ và photostrip/)
drop policy if exists "public-assets: nhà thiết kế tải mẫu" on storage.objects;
create policy "public-assets: nhà thiết kế tải mẫu" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-assets' and public.is_staff('designer') and (name like 'templates/%' or name like 'photostrip/%'));
drop policy if exists "public-assets: nhà thiết kế sửa mẫu" on storage.objects;
create policy "public-assets: nhà thiết kế sửa mẫu" on storage.objects for update to authenticated
  using (bucket_id = 'public-assets' and public.is_staff('designer') and (name like 'templates/%' or name like 'photostrip/%'));
drop policy if exists "public-assets: nhà thiết kế xoá mẫu" on storage.objects;
create policy "public-assets: nhà thiết kế xoá mẫu" on storage.objects for delete to authenticated
  using (bucket_id = 'public-assets' and public.is_staff('designer') and (name like 'templates/%' or name like 'photostrip/%'));

-- Cài đặt thiết kế trong site_settings (Booklet Lyrics, sticker tự rải CD / Booklet, nút Canva, mockup) — nhà thiết kế sửa được
drop policy if exists "settings: nhà thiết kế (cài đặt thiết kế)" on public.site_settings;
create policy "settings: nhà thiết kế (cài đặt thiết kế)" on public.site_settings for all to authenticated
  using (public.is_staff('designer') and key in ('lyrics_booklet', 'scrap_stickers', 'scrap_stickers_booklet', 'canva_button', 'mockup'))
  with check (public.is_staff('designer') and key in ('lyrics_booklet', 'scrap_stickers', 'scrap_stickers_booklet', 'canva_button', 'mockup'));

-- (bảng admins cũ giữ lại để tham khảo — không còn được dùng; thêm / xoá tài khoản ở Admin → Hệ thống → Quản lý tài khoản)
