-- =====================================================================
-- BÀN IN — bổ sung (chạy SAU migration_ban_in.sql; chạy lại không lỗi, không tạo trùng)
--   · print_orders.packs: 1 đơn in được NHIỀU gói, mỗi gói có số lượng [{id, qty}] (chép từ package_id + qty cũ)
--   · bỏ "Ghi nhạc": xoá quy tắc Ghi nhạc, bỏ chữ "Ghi nhạc" khỏi phân loại đã nhập
--   · Card bo góc: 2 lựa chọn "Card bo góc 1 mặt" và "Card bo góc 2 mặt"
-- =====================================================================
alter table public.print_orders add column if not exists packs jsonb not null default '[]'::jsonb;
update public.print_orders
set packs = jsonb_build_array(jsonb_build_object('id', package_id, 'qty', greatest(1, qty))), qty = 1
where package_id is not null and packs = '[]'::jsonb;

delete from public.print_variation_rules where result = 'music' or lower(pattern) like 'ghi nh%';
update public.print_orders set variation = btrim(regexp_replace(variation, '\s*,?\s*ghi\s*nh(ạ|a)c', '', 'gi'), ' ,|') where variation ~* 'ghi\s*nh(ạ|a)c';
update public.print_orders o set lines = coalesce((
  select jsonb_agg(jsonb_set(l, '{variation}', to_jsonb(btrim(regexp_replace(l ->> 'variation', '\s*,?\s*ghi\s*nh(ạ|a)c', '', 'gi'), ' ,|'))))
  from jsonb_array_elements(o.lines) l), '[]'::jsonb)
where o.lines::text ~* 'ghi\s*nh(ạ|a)c';

-- Card bo góc 1 mặt / 2 mặt
update public.print_addons set name = 'Card bo góc 2 mặt', sides = array['mặt trước', 'mặt sau'] where code = 'card-bo-goc' and name = 'Card bo góc';
insert into public.print_addons (code, name, w_cm, h_cm, sides, rounded, group_key, sort_order)
values ('card-bo-goc-1-mat', 'Card bo góc 1 mặt', 5.5, 8.5, array['mặt trước'], true, 'card', 4)
on conflict (code) do nothing;
insert into public.print_variation_rules (pattern, result, addon_code, sort_order) values
  ('Card bo góc 1 mặt', 'addon', 'card-bo-goc-1-mat', 8),
  ('Card bo góc 2 mặt', 'addon', 'card-bo-goc', 8)
on conflict (pattern) do nothing;
update public.print_variation_rules r set addon_id = a.id from public.print_addons a where r.addon_id is null and r.addon_code = a.code;
