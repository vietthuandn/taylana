-- Khung ảnh: lưu các lỗ đặt ảnh (4 góc / theo hình dạng) dò tự động hoặc chỉnh tay.
alter table public.frames add column if not exists regions jsonb;
