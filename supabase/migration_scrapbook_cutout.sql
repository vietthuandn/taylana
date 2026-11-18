-- =====================================================================
-- CD SCRAPBOOK — FONT CHỮ CẮT DÁN ("cut-out"): bộ font + các mảnh ký tự (nhiều biến thể / ký tự).
-- Chạy 1 lần trong Supabase → SQL Editor (chạy lại cũng không sao). Cần chạy migration_scrapbook.sql trước (bucket "scrapbook").
-- Ảnh mảnh chữ lưu ở bucket công khai "scrapbook", thư mục cutout/<id bộ font>/.
-- =====================================================================

create table if not exists public.cutout_fonts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.cutout_glyphs (
  id          uuid primary key default gen_random_uuid(),
  font_id     uuid not null references public.cutout_fonts (id) on delete cascade,
  ch          text not null,                                  -- ký tự (dấu thanh / dấu phụ lưu dạng dấu kết hợp Unicode, ví dụ U+0301 = sắc)
  kind        text not null check (kind in ('upper', 'lower', 'digit', 'tone', 'diacritic', 'symbol', 'precomposed')),
  url         text not null,
  w           integer not null default 0,                     -- kích thước gốc (px)
  h           integer not null default 0,
  anchor      jsonb,                                          -- điểm neo dấu (không bắt buộc) {x, y} 0..1
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists cutout_glyphs_font_idx on public.cutout_glyphs (font_id, ch);

alter table public.cutout_fonts enable row level security;
alter table public.cutout_glyphs enable row level security;
grant select on public.cutout_fonts, public.cutout_glyphs to anon, authenticated;
grant insert, update, delete on public.cutout_fonts, public.cutout_glyphs to authenticated;

drop policy if exists "cutout_fonts: ai cũng đọc" on public.cutout_fonts;
create policy "cutout_fonts: ai cũng đọc" on public.cutout_fonts for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "cutout_fonts: admin toàn quyền" on public.cutout_fonts;
create policy "cutout_fonts: admin toàn quyền" on public.cutout_fonts for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "cutout_glyphs: ai cũng đọc" on public.cutout_glyphs;
create policy "cutout_glyphs: ai cũng đọc" on public.cutout_glyphs for select to anon, authenticated
  using (public.is_admin() or exists (select 1 from public.cutout_fonts f where f.id = font_id and f.is_active));
drop policy if exists "cutout_glyphs: admin toàn quyền" on public.cutout_glyphs;
create policy "cutout_glyphs: admin toàn quyền" on public.cutout_glyphs for all to authenticated using (public.is_admin()) with check (public.is_admin());
