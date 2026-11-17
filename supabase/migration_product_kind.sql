-- =====================================================================
-- LOẠI SẢN PHẨM (kind) + KHÔI PHỤC PRESET GÓI CD
-- Cần chạy SAU migration_products.sql. Chạy 1 lần trong Supabase → SQL Editor (chạy lại cũng không sao).
-- Trình chỉnh CD và Gửi file CD CHỈ đọc nhóm "Loại" của sản phẩm kind = 'cd'.
-- =====================================================================

-- 1. Cột kind: 'cd' | 'other' (sau này thêm 'photostrip', 'photocard')
alter table public.products add column if not exists kind text not null default 'other';
alter table public.products drop constraint if exists products_kind_check;
alter table public.products add constraint products_kind_check check (kind in ('cd', 'other', 'photostrip', 'photocard'));
update public.products set kind = 'cd' where slug = 'in-cd-theo-yeu-cau';

-- 2. Đảm bảo mọi gói CD cũ có mặt trong nhóm "Loại" của sản phẩm CD (giữ nguyên id)
insert into public.options (id, group_id, name, price, description, image_url, front_pages, back_pages, has_disc, is_active, sort_order)
select k.id, g.id, k.name, k.price, coalesce(k.description, ''),
       coalesce((k.images)[1], k.image_url), k.front_pages, k.back_pages, k.has_disc, k.is_active, k.sort_order
from public.packages k
join public.option_groups g on g.name = 'Loại'
join public.products p on p.id = g.product_id and p.slug = 'in-cd-theo-yeu-cau'
on conflict (id) do nothing;

-- 3. Khôi phục preset (số trang Bìa trước, Bìa sau, Mặt đĩa) từ bảng gói cũ nếu bị mất
update public.options o set
  front_pages = coalesce(o.front_pages, k.front_pages),
  back_pages  = coalesce(o.back_pages, k.back_pages),
  has_disc    = coalesce(o.has_disc, k.has_disc)
from public.packages k
where k.id = o.id and (o.front_pages is null or o.back_pages is null or o.has_disc is null);

-- 4. Lựa chọn của nhóm "Loại" (sản phẩm CD) chưa có preset: mặc định 0 trang, có Mặt đĩa
update public.options o set
  front_pages = coalesce(o.front_pages, 0), back_pages = coalesce(o.back_pages, 0), has_disc = coalesce(o.has_disc, true)
from public.option_groups g join public.products p on p.id = g.product_id
where o.group_id = g.id and p.kind = 'cd' and g.select_type = 'single'
  and (o.front_pages is null or o.back_pages is null or o.has_disc is null);
