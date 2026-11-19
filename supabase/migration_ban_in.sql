-- =====================================================================
-- BÀN IN (Admin → Công cụ → Bàn in, /admin/ban-in) — CHỈ admin đọc / ghi
--   · print_batches: phiên in (tên, Đang làm / Đã xong, tiến độ hàng đợi in)
--   · print_orders: đơn của phiên (username, mã đơn, các dòng sản phẩm, gói, món lẻ, ghi nhạc, số lượng, trạng thái)
--   · print_items: ô ảnh đã có file (tên file, kích thước, xoay) — FILE ẢNH chỉ lưu trên máy (IndexedDB), không lên server
--   · print_variation_rules: quy tắc quy đổi phân loại → gói / món lẻ / không cần in / ghi nhạc (nạp sẵn quy tắc mẫu)
--   · print_addons: món in lẻ (Bìa trước 2 mặt, Bìa sau, Card bo góc — thêm / sửa được)
-- Chạy 1 lần trong Supabase → SQL Editor (chạy lại không lỗi, không tạo trùng). Cần hàm is_admin() (migration_staff_templates.sql).
-- =====================================================================
create table if not exists public.print_batches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  status      text not null default 'doing' check (status in ('doing', 'done')),
  progress    jsonb,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);
create table if not exists public.print_addons (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  w_cm        numeric not null,
  h_cm        numeric not null,
  sides       text[] not null default array['mặt trước'],
  rounded     boolean not null default false,
  group_key   text not null default 'card' check (group_key in ('front', 'back', 'card')),
  sort_order  integer not null default 0,
  is_active   boolean not null default true
);
create table if not exists public.print_orders (
  id          uuid primary key default gen_random_uuid(),
  batch_id    uuid not null references public.print_batches (id) on delete cascade,
  seq         integer not null default 0,
  order_code  text not null default '',
  username    text not null default '',
  product     text not null default '',
  variation   text not null default '',
  lines       jsonb not null default '[]'::jsonb,
  qty         integer not null default 1 check (qty >= 1),
  package_id  text,                 -- id tuỳ chọn Loại của sản phẩm CD (gói)
  addons      uuid[] not null default '{}', -- món in lẻ (mỗi lần = 1 vật in)
  music       boolean not null default false,
  unresolved  boolean not null default false,
  status      text not null default 'new' check (status in ('new', 'printed')),
  created_at  timestamptz not null default now()
);
create index if not exists print_orders_batch_idx on public.print_orders (batch_id, seq);
create table if not exists public.print_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.print_orders (id) on delete cascade,
  slot        text not null,         -- f1..fN, b1, b2, d, a:<món>:<lần>:<mặt>
  file_name   text not null default '',
  w           integer not null default 0,
  h           integer not null default 0,
  rot         integer not null default 0,
  updated_at  timestamptz not null default now(),
  unique (order_id, slot)
);
create table if not exists public.print_variation_rules (
  id            uuid primary key default gen_random_uuid(),
  pattern       text not null unique,
  result        text not null check (result in ('package', 'addon', 'skip', 'music')),
  package_id    text,                -- gói cụ thể (chọn trong admin)
  package_front integer,             -- gợi ý khi chưa chọn gói: số trang bìa trước / booklet (0 = CD lẻ chỉ mặt đĩa)
  package_label text,                -- gợi ý theo tên gói
  addon_id      uuid references public.print_addons (id) on delete set null,
  addon_code    text,                -- gợi ý món lẻ theo mã
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

-- món in lẻ mẫu
insert into public.print_addons (code, name, w_cm, h_cm, sides, rounded, group_key, sort_order) values
  ('bia-truoc-2-mat', 'Bìa trước 2 mặt', 12, 12, array['mặt ngoài', 'mặt trong'], false, 'front', 1),
  ('bia-sau', 'Bìa sau', 15, 11.7, array['mặt ngoài', 'mặt trong'], false, 'back', 2),
  ('card-bo-goc', 'Card bo góc', 5.5, 8.5, array['mặt trước', 'mặt sau'], true, 'card', 3)
on conflict (code) do nothing;

-- quy tắc mẫu
insert into public.print_variation_rules (pattern, result, package_front, addon_code, sort_order) values
  ('CD (in)', 'package', 0, null, 1),
  ('Combo + Booklet 4tr', 'package', 4, null, 2),
  ('Combo + Booklet 8tr', 'package', 8, null, 3),
  ('Combo + Booklet 12tr', 'package', 12, null, 4),
  ('Combo + 2 bìa 2 mặt', 'package', 2, null, 5),
  ('Bìa Trước 2 mặt', 'addon', null, 'bia-truoc-2-mat', 6),
  ('Bìa sau', 'addon', null, 'bia-sau', 7),
  ('Card bo góc', 'addon', null, 'card-bo-goc', 8),
  ('Giá Đỡ', 'skip', null, null, 9),
  ('Ghi nhạc', 'skip', null, null, 10) -- web không ghi nhạc: bỏ qua
on conflict (pattern) do nothing;
update public.print_variation_rules r set addon_id = a.id from public.print_addons a where r.addon_id is null and r.addon_code = a.code;

-- RLS: chỉ admin
do $$
declare t text;
begin
  foreach t in array array['print_batches', 'print_orders', 'print_items', 'print_variation_rules', 'print_addons'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "%s: chỉ admin" on public.%I', t, t);
    execute format('create policy "%s: chỉ admin" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;
