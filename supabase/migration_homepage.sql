-- =====================================================================
-- MIGRATION: Trang chủ mới (banner, 6 lựa chọn, trang Liên Hệ)
-- Chạy file này 1 lần trong Supabase → SQL Editor → Run (chạy lại vẫn an toàn).
--
-- Nội dung trang chủ & liên hệ lưu trong bảng site_settings có sẵn
-- (key "home", "home_options", "contact") nên KHÔNG cần bảng mới.
-- File này chỉ cho phép tải icon SVG lên bucket công khai public-assets.
-- =====================================================================
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
where id = 'public-assets';
