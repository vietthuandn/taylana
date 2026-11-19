-- =====================================================================
-- KHUNG ẢNH: chuyển các khung cũ (chất liệu nhóm "Khung", bảng scrapbook_assets) sang thư viện Khung ảnh (bảng frames),
-- bộ khung tên "Khung cũ" — chỉ những khung CHƯA có trong frames (nếu migration_booklet_scrapbook.sql đã chuyển thì bỏ qua).
-- Mục cũ "Khung ảnh (chất liệu)" trong trình sửa mẫu đã bỏ; khung chỉ còn chọn từ thư viện Khung ảnh.
-- Chạy 1 lần trong Supabase → SQL Editor (chạy lại cũng không sao). Cần chạy migration_booklet_scrapbook.sql trước.
-- =====================================================================
insert into public.frame_sets (name, sort_order)
select 'Khung cũ', 99
where exists (select 1 from public.scrapbook_assets a where a.grp = 'frame' and not exists (select 1 from public.frames f where f.url = a.url))
  and not exists (select 1 from public.frame_sets where name = 'Khung cũ');

insert into public.frames (set_id, name, url, region, ratio, is_active, sort_order)
select s.id, a.name, a.url, a.region, 1, a.region is not null, a.sort_order
from public.scrapbook_assets a
cross join (select id from public.frame_sets where name = 'Khung cũ' limit 1) s
where a.grp = 'frame' and not exists (select 1 from public.frames f where f.url = a.url);

update public.scrapbook_assets set is_active = false where grp = 'frame';
-- Tỉ lệ khung chuyển sang để mặc định 1: mở Admin → Chất liệu Scrapbook → tab "Khung ảnh", kiểm tra vùng ảnh từng khung.
