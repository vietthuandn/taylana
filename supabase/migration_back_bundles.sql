-- Back cover Template → "Bộ mẫu 2 mặt" (Mặt ngoài + Mặt trong): dùng chung bảng booklet_bundles, thêm cột kind + danh mục scope back_bundle.
alter table public.booklet_bundles add column if not exists kind text not null default 'booklet';
alter table public.booklet_bundles drop constraint if exists booklet_bundles_kind_check;
alter table public.booklet_bundles add constraint booklet_bundles_kind_check check (kind in ('booklet', 'back'));
alter table public.template_categories drop constraint if exists template_categories_scope_check;
alter table public.template_categories add constraint template_categories_scope_check check (scope in ('cd', 'booklet_single', 'booklet_spread', 'booklet_bundle', 'back', 'back_bundle'));
insert into public.template_categories (scope, name, sort_order) values ('back_bundle', 'Cơ bản', 0)
on conflict (scope, name) do nothing;
