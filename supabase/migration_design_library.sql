-- =====================================================================
-- THƯ VIỆN MẪU CỐ ĐỊNH: CD Template · Booklet Template (Trang đơn / Trang đôi / bộ booklet) + danh mục
--   · template_categories: danh mục theo phạm vi ('cd' | 'booklet_single' | 'booklet_spread' | 'booklet_bundle') — mặc định "Cơ bản"
--   · design_templates (bảng cũ của "Mẫu Custom CD", GIỮ NGUYÊN dữ liệu cũ — kind 'custom_cd'): thêm kind, category_id, config (JSON lớp),
--     photo_count (tự tính từ config), created_by, updated_at. Mẫu mới: kind 'cd' | 'booklet_single' | 'booklet_spread'
--   · booklet_bundles: bộ booklet hoàn chỉnh (tên, danh mục, số trang 2/4/8/12, danh sách id mẫu theo thứ tự ô, thumbnail…)
--   · frames.allow_stretch: khung PNG cho phép kéo giãn
--   · RLS: đọc công khai bản đang bật; admin + nhà thiết kế sửa bảng template + chất liệu.
--     Template Canva, Mockup (khung, nền), cài đặt Booklet Lyrics / Canva / Mockup: CHỈ admin.
-- Cần chạy migration_staff_templates.sql trước (hàm is_staff). Chạy 1 lần trong Supabase → SQL Editor (chạy lại cũng không sao).
-- =====================================================================

-- ---------- 1. danh mục ----------
create table if not exists public.template_categories (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null check (scope in ('cd', 'booklet_single', 'booklet_spread', 'booklet_bundle')),
  name        text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (scope, name)
);
insert into public.template_categories (scope, name, sort_order)
select s, 'Cơ bản', 0 from unnest(array['cd', 'booklet_single', 'booklet_spread', 'booklet_bundle']) s
on conflict (scope, name) do nothing;

-- ---------- 2. mẫu (mở rộng bảng design_templates cũ) ----------
alter table public.design_templates add column if not exists kind text not null default 'custom_cd';
alter table public.design_templates drop constraint if exists design_templates_kind_check;
alter table public.design_templates add constraint design_templates_kind_check check (kind in ('custom_cd', 'cd', 'booklet_single', 'booklet_spread'));
alter table public.design_templates add column if not exists category_id uuid references public.template_categories (id) on delete set null;
alter table public.design_templates add column if not exists config jsonb;
alter table public.design_templates add column if not exists photo_count integer not null default 0;
alter table public.design_templates add column if not exists created_by uuid default auth.uid() references auth.users (id) on delete set null;
alter table public.design_templates add column if not exists updated_at timestamptz not null default now();
alter table public.design_templates alter column target drop not null; -- mẫu mới không có "target" (loại do kind quyết định)
create index if not exists design_templates_kind_idx on public.design_templates (kind, category_id, sort_order);

-- số ô ảnh tự tính từ cấu hình (số "slot" khác nhau của các lớp ảnh)
create or replace function public.design_templates_touch()
returns trigger language plpgsql as $$
begin
  if new.config is not null and new.config ? 'template' then
    select count(distinct (l ->> 'slot')) into new.photo_count
    from jsonb_array_elements(coalesce(new.config -> 'template' -> 'layers', '[]'::jsonb)) l where l ->> 'k' = 'photo';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists design_templates_touch on public.design_templates;
create trigger design_templates_touch before insert or update on public.design_templates for each row execute function public.design_templates_touch();

-- ---------- 3. bộ booklet ----------
create table if not exists public.booklet_bundles (
  id            uuid primary key default gen_random_uuid(),
  name          text not null default 'Bộ mẫu mới',
  category_id   uuid references public.template_categories (id) on delete set null,
  page_count    integer not null check (page_count in (2, 4, 8, 12)),
  template_ids  uuid[] not null default '{}', -- id mẫu (design_templates) theo thứ tự ô: Trang 1, 2–3, …, trang cuối
  thumbnail_url text,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- 4. khung kéo giãn ----------
alter table public.frames add column if not exists allow_stretch boolean not null default false;

-- ---------- 5. RLS: bảng template mới ----------
alter table public.template_categories enable row level security;
alter table public.booklet_bundles enable row level security;
grant select on public.template_categories, public.booklet_bundles, public.design_templates to anon, authenticated;
grant insert, update, delete on public.template_categories, public.booklet_bundles, public.design_templates to authenticated;

do $$
declare p record;
begin
  -- design_templates: bỏ các policy cũ rồi tạo lại (đọc bản đang bật · admin + nhà thiết kế sửa)
  for p in select policyname, tablename from pg_policies where schemaname = 'public' and tablename in ('design_templates', 'template_categories', 'booklet_bundles') loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
create policy "design_templates: đọc bản đang bật" on public.design_templates for select to anon, authenticated using (is_active or public.is_staff('designer'));
create policy "design_templates: admin + nhà thiết kế" on public.design_templates for all to authenticated using (public.is_staff('designer')) with check (public.is_staff('designer'));
create policy "template_categories: đọc bản đang bật" on public.template_categories for select to anon, authenticated using (is_active or public.is_staff('designer'));
create policy "template_categories: admin + nhà thiết kế" on public.template_categories for all to authenticated using (public.is_staff('designer')) with check (public.is_staff('designer'));
create policy "booklet_bundles: đọc bản đang bật" on public.booklet_bundles for select to anon, authenticated using (is_active or public.is_staff('designer'));
create policy "booklet_bundles: admin + nhà thiết kế" on public.booklet_bundles for all to authenticated using (public.is_staff('designer')) with check (public.is_staff('designer'));

-- ---------- 6. RLS: Canva, Mockup → chỉ admin (trước đây nhà thiết kế sửa được) ----------
do $$
declare p record; q text; c text; sql text;
begin
  for p in
    select * from pg_policies
    where (schemaname = 'public' and tablename in ('canva_templates', 'mockup_frames', 'mockup_backgrounds'))
       or (schemaname = 'storage' and tablename = 'objects' and (coalesce(qual, '') || coalesce(with_check, '')) ~ '''mockups''' and (coalesce(qual, '') || coalesce(with_check, '')) !~ '''scrapbook''')
  loop
    q := replace(coalesce(p.qual, ''), 'is_staff(''designer''::text)', 'is_admin()');
    c := replace(coalesce(p.with_check, ''), 'is_staff(''designer''::text)', 'is_admin()');
    if q is distinct from coalesce(p.qual, '') or c is distinct from coalesce(p.with_check, '') then
      sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
      if p.qual is not null then sql := sql || format(' using (%s)', q); end if;
      if p.with_check is not null then sql := sql || format(' with check (%s)', c); end if;
      execute sql;
    end if;
  end loop;
end $$;

-- cài đặt thiết kế nhà thiết kế sửa được: chỉ cài đặt rải sticker CD / Booklet (Booklet Lyrics, nút Canva, Mockup: chỉ admin)
drop policy if exists "settings: nhà thiết kế (cài đặt thiết kế)" on public.site_settings;
create policy "settings: nhà thiết kế (cài đặt thiết kế)" on public.site_settings for all to authenticated
  using (public.is_staff('designer') and key in ('scrap_stickers', 'scrap_stickers_booklet'))
  with check (public.is_staff('designer') and key in ('scrap_stickers', 'scrap_stickers_booklet'));
