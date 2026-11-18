-- =====================================================================
-- FONT CUT-OUT — dữ liệu học nhận diện ký tự: mỗi mảnh chữ admin đã gán → 1 vector đặc trưng
-- (ảnh 32 × 32 sau tiền xử lý + HOG). Mảnh mới được so với các mẫu này (k láng giềng gần nhất).
-- Chạy 1 lần trong Supabase → SQL Editor (chạy lại cũng không sao). Cần chạy migration_scrapbook_cutout.sql trước.
-- =====================================================================
create table if not exists public.cutout_training (
  id          uuid primary key default gen_random_uuid(),
  glyph_id    uuid references public.cutout_glyphs (id) on delete cascade,
  ch          text not null,
  vec         float4[] not null,
  font_id     uuid references public.cutout_fonts (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists cutout_training_glyph_idx on public.cutout_training (glyph_id);

alter table public.cutout_training enable row level security;
revoke all on public.cutout_training from anon;
grant select, insert, update, delete on public.cutout_training to authenticated;
drop policy if exists "cutout_training: chỉ admin" on public.cutout_training;
create policy "cutout_training: chỉ admin" on public.cutout_training for all to authenticated using (public.is_admin()) with check (public.is_admin());
