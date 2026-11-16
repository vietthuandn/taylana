-- =====================================================================
-- MIGRATION: Ảnh nền cho khung Photostrip
-- Chạy 1 lần trong Supabase → SQL Editor → Run (chạy lại vẫn an toàn).
-- =====================================================================
alter table public.photostrip_frames add column if not exists background_url text;
