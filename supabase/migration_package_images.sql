-- Nhiều ảnh cho mỗi gói sản phẩm (trang Đặt đơn: ảnh chính + thumbnail).
-- Ảnh đầu tiên là ảnh chính (cột image_url cũ vẫn giữ = ảnh đầu tiên để tương thích).
-- Chạy 1 lần trong Supabase → SQL Editor. Chạy lại cũng không sao.
alter table public.packages add column if not exists images text[] not null default '{}';

-- gói cũ đã có 1 ảnh → đưa vào danh sách
update public.packages
set images = array[image_url]
where image_url is not null and image_url <> '' and coalesce(array_length(images, 1), 0) = 0;
