-- =====================================================================
-- MIGRATION: Preset thiết kế cho từng gói sản phẩm (trang Custom CD)
-- Chạy 1 lần trong Supabase → SQL Editor → Run (chạy lại vẫn an toàn).
--   has_disc    : gói có Mặt đĩa không
--   front_pages : số trang Bìa trước (0, 1, 2, 4, 8, 12 — từ 4 là booklet)
--   back_pages  : số trang Bìa sau (0, 1, 2)
-- =====================================================================
alter table public.packages add column if not exists has_disc boolean not null default true;
alter table public.packages add column if not exists front_pages integer not null default 0;
alter table public.packages add column if not exists back_pages integer not null default 0;
alter table public.packages drop constraint if exists packages_front_pages_check;
alter table public.packages add constraint packages_front_pages_check check (front_pages in (0, 1, 2, 4, 8, 12));
alter table public.packages drop constraint if exists packages_back_pages_check;
alter table public.packages add constraint packages_back_pages_check check (back_pages in (0, 1, 2));

-- Điền sẵn preset cho các gói hiện có (theo tên gói)
update public.packages set has_disc = true, front_pages = 0, back_pages = 0
  where name ilike 'CD lẻ%' or name ilike 'CD + Hộp%' or name ilike 'CD + hộp%';
update public.packages set has_disc = true, front_pages = 1, back_pages = 1
  where name ilike '%2 bìa 1 mặt%' or name ilike 'Combo bìa trước & sau%';
update public.packages set has_disc = true, front_pages = 2, back_pages = 2
  where name ilike '%2 bìa 2 mặt%';
update public.packages set has_disc = true, front_pages = 4, back_pages = 2 where name ilike '%booklet 4%';
update public.packages set has_disc = true, front_pages = 8, back_pages = 2 where name ilike '%booklet 8%';
update public.packages set has_disc = true, front_pages = 12, back_pages = 2 where name ilike '%booklet 12%';
