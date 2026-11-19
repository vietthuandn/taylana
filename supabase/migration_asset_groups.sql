-- =====================================================================
-- CHẤT LIỆU: tách LOẠI (kỹ thuật, cố định) và NHÓM (chủ đề admin tự đặt) + TAGS + ảnh thu nhỏ
--   · asset_groups (id, name, slug, sort_order, created_at) — ai cũng đọc, admin + nhà thiết kế sửa
--   · scrapbook_assets: + asset_type (Loại: sticker / tape / doodle / paper / texture / frame — chép từ cột grp cũ, grp vẫn giữ),
--     + group_id (mỗi chất liệu đúng 1 nhóm), + tags text[] (mặc định rỗng), + thumb_url (ảnh thu nhỏ ~160px)
--   · nhóm mặc định theo Loại cũ (Sticker, Băng dính, Doodle, Mảnh giấy, Texture nền giấy, Khung) → gán cho chất liệu tương ứng
--   · tên chứa "birthday" / "sinh nhật" → nhóm "Birthday" + tag "meme" · "tốt nghiệp" / "graduation" → nhóm "Tốt nghiệp" + tag "meme"
--     (so khớp không phân biệt hoa thường và dấu — extension unaccent). GIỮ NGUYÊN tên chất liệu.
-- Chạy 1 lần trong Supabase → SQL Editor (chạy lại không lỗi, không tạo trùng). Cần migration_staff_templates.sql (hàm is_staff).
-- =====================================================================
create extension if not exists unaccent;

create table if not exists public.asset_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.scrapbook_assets add column if not exists asset_type text;
alter table public.scrapbook_assets add column if not exists group_id uuid references public.asset_groups (id) on delete set null;
alter table public.scrapbook_assets add column if not exists tags text[] not null default '{}';
alter table public.scrapbook_assets add column if not exists thumb_url text;
update public.scrapbook_assets set asset_type = grp where asset_type is null;
alter table public.scrapbook_assets alter column asset_type set default 'sticker';
alter table public.scrapbook_assets drop constraint if exists scrapbook_assets_asset_type_check;
alter table public.scrapbook_assets add constraint scrapbook_assets_asset_type_check check (asset_type in ('tape', 'sticker', 'frame', 'doodle', 'texture', 'paper'));
create index if not exists scrapbook_assets_group_idx on public.scrapbook_assets (group_id);
create index if not exists scrapbook_assets_tags_idx on public.scrapbook_assets using gin (tags);

-- nhóm mặc định theo Loại
insert into public.asset_groups (name, slug, sort_order) values
  ('Sticker', 'sticker', 1), ('Băng dính', 'bang-dinh', 2), ('Doodle', 'doodle', 3),
  ('Mảnh giấy', 'manh-giay', 4), ('Texture nền giấy', 'texture-nen-giay', 5), ('Khung', 'khung', 6),
  ('Birthday', 'birthday', 7), ('Tốt nghiệp', 'tot-nghiep', 8)
on conflict (slug) do nothing;

update public.scrapbook_assets a set group_id = g.id
from public.asset_groups g
where a.group_id is null and g.slug = case a.asset_type
  when 'sticker' then 'sticker' when 'tape' then 'bang-dinh' when 'doodle' then 'doodle'
  when 'paper' then 'manh-giay' when 'texture' then 'texture-nen-giay' when 'frame' then 'khung' end;

-- theo tên (không phân biệt hoa thường + dấu): Birthday / Tốt nghiệp + tag "meme"
update public.scrapbook_assets
set group_id = (select id from public.asset_groups where slug = 'birthday'),
    tags = case when 'meme' = any (tags) then tags else array_append(tags, 'meme') end
where lower(public.unaccent(name)) ~ '(birthday|sinh nhat)';
update public.scrapbook_assets
set group_id = (select id from public.asset_groups where slug = 'tot-nghiep'),
    tags = case when 'meme' = any (tags) then tags else array_append(tags, 'meme') end
where lower(public.unaccent(name)) ~ '(tot nghiep|graduation)';

-- RLS: ai cũng đọc · admin + nhà thiết kế sửa
alter table public.asset_groups enable row level security;
grant select on public.asset_groups to anon, authenticated;
grant insert, update, delete on public.asset_groups to authenticated;
drop policy if exists "asset_groups: ai cũng đọc" on public.asset_groups;
create policy "asset_groups: ai cũng đọc" on public.asset_groups for select to anon, authenticated using (true);
drop policy if exists "asset_groups: admin + nhà thiết kế" on public.asset_groups;
create policy "asset_groups: admin + nhà thiết kế" on public.asset_groups for all to authenticated using (public.is_staff('designer')) with check (public.is_staff('designer'));

-- Kiểm tra: số chất liệu đang lưu dạng KHÔNG có nền trong suốt (file JPG)
--   select asset_type, count(*) from public.scrapbook_assets where url ~* '\.jpe?g(\?|$)' group by asset_type;
