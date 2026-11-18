-- =====================================================================
-- CD SCRAPBOOK — mẫu do admin chỉnh tay: lưu nguyên cấu hình mẫu (nền + danh sách lớp) đè lên mẫu tạo bằng code.
-- Chạy 1 lần trong Supabase → SQL Editor (chạy lại cũng không sao). Cần chạy migration_scrapbook.sql trước.
-- =====================================================================
alter table public.scrapbook_template_settings add column if not exists template jsonb; -- null = dùng mẫu tạo bằng code theo seed
