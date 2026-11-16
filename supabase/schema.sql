-- =====================================================================
--  TIỆM IN TAYLANA — CƠ SỞ DỮ LIỆU
--  Chạy toàn bộ file này trong Supabase → SQL Editor → Run.
--  File chạy lại nhiều lần vẫn an toàn (không mất dữ liệu đã có).
--
--  Nguyên tắc bảo mật (RLS):
--   • Dữ liệu công khai (gói, phụ kiện, hướng dẫn, mẫu, sản phẩm,
--     đánh giá đã duyệt, cài đặt trang chủ): ai cũng ĐỌC được.
--   • Khách: chỉ TẠO đơn (qua hàm create_order) và TẢI FILE LÊN.
--     Khách không đọc được đơn/file của bất kỳ ai.
--   • Mọi thứ còn lại: chỉ admin (có tên trong bảng admins).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. ADMIN
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

-- Hàm kiểm tra người đang đăng nhập có phải admin không.
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.admins enable row level security;
drop policy if exists "admins: admin đọc" on public.admins;
create policy "admins: admin đọc" on public.admins for select to authenticated using (public.is_admin());
-- Thêm/xoá admin: làm bằng SQL Editor (xem README).

-- Hàm tiện ích: tự cập nhật cột updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. CÀI ĐẶT TRANG (banner trang chủ, liên hệ...)
-- ---------------------------------------------------------------------
create table if not exists public.site_settings (
  key        text primary key,          -- 'home' | 'contact'
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. GÓI SẢN PHẨM & PHỤ KIỆN
-- ---------------------------------------------------------------------
create table if not exists public.packages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  price       integer not null default 0 check (price >= 0),   -- đơn vị: đồng
  description text not null default '',
  features    text[] not null default '{}',                   -- những gì có trong gói
  image_url   text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.addons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  price       integer not null default 0 check (price >= 0),
  description text not null default '',
  image_url   text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. ĐƠN HÀNG & FILE KHÁCH NỘP
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,                       -- ví dụ TL-261116-AB12
  order_type       text not null default 'cd'
                   check (order_type in ('cd', 'custom_cd', 'photostrip')),
  customer_name    text not null,
  phone            text not null,
  address          text not null default '',
  note             text not null default '',
  package_id       uuid references public.packages(id) on delete set null,
  quantity         integer not null default 1 check (quantity between 1 and 1000),
  items            jsonb not null default '[]'::jsonb,          -- ảnh chụp tên/giá lúc đặt
  total            integer not null default 0,
  status           text not null default 'new'
                   check (status in ('new', 'in_progress', 'delivered')),
  music_link       text not null default '',                   -- link Google Drive file nhạc
  admin_note       text not null default '',
  delivered_at     timestamptz,
  files_cleaned_at timestamptz,                                -- lúc admin dọn file
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists orders_phone_idx on public.orders (phone);
create index if not exists orders_status_idx on public.orders (status, created_at desc);

create or replace function public.orders_before_update()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    new.delivered_at = now();
  elsif new.status <> 'delivered' then
    new.delivered_at = null;
  end if;
  return new;
end $$;
drop trigger if exists orders_before_update on public.orders;
create trigger orders_before_update before update on public.orders
  for each row execute function public.orders_before_update();

create table if not exists public.order_files (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  kind         text not null
               check (kind in ('front', 'back', 'disc', 'booklet', 'design', 'photostrip', 'other')),
  page         integer,                                        -- số trang booklet
  storage_path text not null unique,                           -- đường dẫn trong bucket order-files
  file_name    text not null default '',
  mime_type    text not null default '',
  size_bytes   bigint not null default 0,
  width_px     integer,
  height_px    integer,
  created_at   timestamptz not null default now()
);
create index if not exists order_files_order_idx on public.order_files (order_id);

-- ---------------------------------------------------------------------
-- 5. HƯỚNG DẪN LÀM FILE
--   images: [{ "url": "...", "caption": "Bìa trước 12x12cm" }]
--   links:  [{ "label": "Template Canva", "url": "https://..." }]
-- ---------------------------------------------------------------------
create table if not exists public.guide_sections (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null default '',
  images     jsonb not null default '[]'::jsonb,
  links      jsonb not null default '[]'::jsonb,
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. MẪU CUSTOM CD & KHUNG PHOTOSTRIP
--   slots: [{ "id": "a1", "shape": "rect"|"circle",
--             "x": 0.1, "y": 0.1, "w": 0.4, "h": 0.4, "rotation": 0 }]
--   (x, y, w, h tính theo tỉ lệ 0–1 của khổ in → không phụ thuộc kích thước màn hình)
-- ---------------------------------------------------------------------
create table if not exists public.design_templates (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  target         text not null check (target in ('front', 'back', 'disc')),
  overlay_url    text,                                         -- PNG trong suốt phía trước
  background_url text,                                         -- (tuỳ chọn) ảnh nền phía sau
  thumbnail_url  text,
  slots          jsonb not null default '[]'::jsonb,
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists public.photostrip_frames (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slot_count       integer not null default 4 check (slot_count in (3, 4)),
  overlay_url      text,
  background_color text not null default '#ffffff',
  background_url   text,                                       -- ảnh nền phía sau (tuỳ chọn)
  thumbnail_url    text,
  slots            jsonb not null default '[]'::jsonb,
  is_active        boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. SẢN PHẨM SHOWCASE & ĐÁNH GIÁ
-- ---------------------------------------------------------------------
-- (bản cũ chưa có cột ảnh nền photostrip)
alter table public.photostrip_frames add column if not exists background_url text;

create table if not exists public.showcase_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default '',
  category    text not null default 'CD',                      -- dùng để lọc
  image_url   text not null,
  description text not null default '',
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(customer_name) between 1 and 80),
  rating        integer not null default 5 check (rating between 1 and 5),
  content       text not null default '' check (char_length(content) <= 2000),
  image_url     text,
  is_approved   boolean not null default false,
  created_at    timestamptz not null default now()
);

-- =====================================================================
-- RLS — BẬT CHO MỌI BẢNG
-- =====================================================================
alter table public.site_settings     enable row level security;
alter table public.packages          enable row level security;
alter table public.addons            enable row level security;
alter table public.orders            enable row level security;
alter table public.order_files       enable row level security;
alter table public.guide_sections    enable row level security;
alter table public.design_templates  enable row level security;
alter table public.photostrip_frames enable row level security;
alter table public.showcase_items    enable row level security;
alter table public.reviews           enable row level security;

-- Quyền cơ bản cho API (RLS bên dưới mới là thứ quyết định ai thấy dòng nào)
grant usage on schema public to anon, authenticated;
grant select on public.site_settings, public.packages, public.addons, public.guide_sections,
  public.design_templates, public.photostrip_frames, public.showcase_items, public.reviews
  to anon, authenticated;
grant insert on public.reviews to anon, authenticated;
grant select, insert, update, delete on
  public.site_settings, public.packages, public.addons, public.orders, public.order_files,
  public.guide_sections, public.design_templates, public.photostrip_frames,
  public.showcase_items, public.reviews
  to authenticated;
grant select on public.admins to authenticated;

-- Tạo policy cho các bảng "công khai đọc, admin sửa" bằng vòng lặp cho gọn
do $$
declare t text;
begin
  foreach t in array array['packages', 'addons', 'guide_sections', 'design_templates',
                           'photostrip_frames', 'showcase_items']
  loop
    execute format('drop policy if exists "%1$s: ai cũng đọc mục đang hiện" on public.%1$I', t);
    execute format('create policy "%1$s: ai cũng đọc mục đang hiện" on public.%1$I
                    for select to anon, authenticated using (is_active or public.is_admin())', t);
    execute format('drop policy if exists "%1$s: admin toàn quyền" on public.%1$I', t);
    execute format('create policy "%1$s: admin toàn quyền" on public.%1$I
                    for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- site_settings
drop policy if exists "settings: ai cũng đọc" on public.site_settings;
create policy "settings: ai cũng đọc" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "settings: admin toàn quyền" on public.site_settings;
create policy "settings: admin toàn quyền" on public.site_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- reviews: công khai đọc bài đã duyệt; khách gửi bài mới (chưa duyệt); admin toàn quyền
drop policy if exists "reviews: đọc bài đã duyệt" on public.reviews;
create policy "reviews: đọc bài đã duyệt" on public.reviews
  for select to anon, authenticated using (is_approved or public.is_admin());
drop policy if exists "reviews: khách gửi đánh giá" on public.reviews;
create policy "reviews: khách gửi đánh giá" on public.reviews
  for insert to anon, authenticated with check (is_approved = false);
drop policy if exists "reviews: admin toàn quyền" on public.reviews;
create policy "reviews: admin toàn quyền" on public.reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- orders & order_files: CHỈ admin đọc/sửa/xoá. Khách tạo qua các hàm bên dưới.
drop policy if exists "orders: admin toàn quyền" on public.orders;
create policy "orders: admin toàn quyền" on public.orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "order_files: admin toàn quyền" on public.order_files;
create policy "order_files: admin toàn quyền" on public.order_files
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- HÀM CHO KHÁCH (chạy với quyền hệ thống nhưng chỉ làm đúng 1 việc)
-- =====================================================================

-- Tạo đơn. Giá được tính lại từ database nên khách không sửa giá được.
--   p_addons: [{ "id": "<uuid phụ kiện>", "qty": 2 }, ...]
create or replace function public.create_order(
  p_customer_name text,
  p_phone         text,
  p_address       text default '',
  p_note          text default '',
  p_package_id    uuid default null,
  p_quantity      integer default 1,
  p_addons        jsonb default '[]'::jsonb,
  p_order_type    text default 'cd',
  p_music_link    text default ''
)
returns table (order_id uuid, order_code text, order_total integer)
language plpgsql security definer
set search_path = public
as $$
declare
  v_pkg     public.packages;
  v_items   jsonb := '[]'::jsonb;
  v_total   integer := 0;
  v_qty     integer := greatest(1, least(coalesce(p_quantity, 1), 1000));
  v_addon   record;
  v_code    text;
  v_id      uuid;
  v_phone   text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  v_alpha   text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if char_length(trim(coalesce(p_customer_name, ''))) not between 1 and 100 then
    raise exception 'Vui lòng nhập tên (tối đa 100 ký tự)';
  end if;
  if char_length(v_phone) not between 8 and 15 then
    raise exception 'Số điện thoại không hợp lệ';
  end if;
  if char_length(coalesce(p_address, '')) > 500 or char_length(coalesce(p_note, '')) > 2000
     or char_length(coalesce(p_music_link, '')) > 1000 then
    raise exception 'Nội dung quá dài';
  end if;
  if p_order_type not in ('cd', 'custom_cd', 'photostrip') then
    raise exception 'Loại đơn không hợp lệ';
  end if;

  if p_package_id is not null then
    select * into v_pkg from public.packages where id = p_package_id and is_active;
    if not found then raise exception 'Gói sản phẩm không tồn tại'; end if;
    v_items := v_items || jsonb_build_object('type', 'package', 'id', v_pkg.id, 'name', v_pkg.name,
                                             'price', v_pkg.price, 'qty', v_qty);
    v_total := v_total + v_pkg.price * v_qty;
  elsif p_order_type = 'cd' then
    raise exception 'Vui lòng chọn một gói sản phẩm';
  end if;

  for v_addon in
    select a.id, a.name, a.price, greatest(1, least(coalesce((x->>'qty')::int, 1), 1000)) as qty
    from jsonb_array_elements(coalesce(p_addons, '[]'::jsonb)) x
    join public.addons a on a.id = (x->>'id')::uuid and a.is_active
  loop
    v_items := v_items || jsonb_build_object('type', 'addon', 'id', v_addon.id, 'name', v_addon.name,
                                             'price', v_addon.price, 'qty', v_addon.qty);
    v_total := v_total + v_addon.price * v_addon.qty;
  end loop;

  -- Mã đơn: TL-YYMMDD-XXXX (giờ Việt Nam)
  loop
    v_code := 'TL-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD') || '-' ||
              (select string_agg(substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1), '')
               from generate_series(1, 4));
    exit when not exists (select 1 from public.orders where code = v_code);
  end loop;

  insert into public.orders (code, order_type, customer_name, phone, address, note, package_id,
                             quantity, items, total, music_link)
  values (v_code, p_order_type, trim(p_customer_name), v_phone, coalesce(p_address, ''),
          coalesce(p_note, ''), p_package_id, v_qty, v_items, v_total, coalesce(p_music_link, ''))
  returning id into v_id;

  return query select v_id, v_code, v_total;
end $$;

-- Tìm đơn để nộp file theo mã đơn hoặc SĐT. Chỉ trả về id + mã đơn (không lộ thông tin khách).
create or replace function public.find_order_for_upload(p_query text)
returns table (order_id uuid, order_code text)
language sql stable security definer
set search_path = public
as $$
  select o.id, o.code
  from public.orders o
  where o.status <> 'delivered'
    and (
      upper(o.code) = upper(trim(p_query))
      or (char_length(regexp_replace(p_query, '[^0-9]', '', 'g')) >= 8
          and o.phone = regexp_replace(p_query, '[^0-9+]', '', 'g'))
    )
  order by o.created_at desc
  limit 1;
$$;

-- Đơn có đang nhận file không? (dùng trong policy của Storage)
create or replace function public.order_accepts_files(p_order_id text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.orders where id::text = p_order_id and status <> 'delivered');
$$;

-- Ghi lại thông tin file khách vừa upload
create or replace function public.register_order_file(
  p_order_id     uuid,
  p_kind         text,
  p_storage_path text,
  p_file_name    text,
  p_mime_type    text,
  p_size_bytes   bigint,
  p_page         integer default null,
  p_width_px     integer default null,
  p_height_px    integer default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not public.order_accepts_files(p_order_id::text) then
    raise exception 'Đơn không tồn tại hoặc đã hoàn thành';
  end if;
  if split_part(p_storage_path, '/', 1) <> p_order_id::text then
    raise exception 'Đường dẫn file không hợp lệ';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'order-files' and name = p_storage_path) then
    raise exception 'Không tìm thấy file đã upload';
  end if;
  insert into public.order_files (order_id, kind, page, storage_path, file_name, mime_type,
                                  size_bytes, width_px, height_px)
  values (p_order_id, p_kind, p_page, p_storage_path, left(coalesce(p_file_name, ''), 255),
          left(coalesce(p_mime_type, ''), 100), coalesce(p_size_bytes, 0), p_width_px, p_height_px)
  on conflict (storage_path) do nothing
  returning id into v_id;
  return v_id;
end $$;

-- Khách cập nhật link Google Drive file nhạc
create or replace function public.set_order_music_link(p_order_id uuid, p_link text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if char_length(coalesce(p_link, '')) > 1000 then raise exception 'Link quá dài'; end if;
  update public.orders set music_link = coalesce(p_link, '')
  where id = p_order_id and status <> 'delivered';
end $$;

-- Dung lượng Storage đang dùng (chỉ admin)
create or replace function public.storage_usage()
returns table (bucket text, file_count bigint, total_bytes bigint)
language plpgsql stable security definer
set search_path = public, storage
as $$
begin
  if not public.is_admin() then raise exception 'Không có quyền'; end if;
  return query
    select o.bucket_id::text, count(*)::bigint,
           coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
    from storage.objects o
    group by o.bucket_id;
end $$;

grant execute on function public.create_order(text, text, text, text, uuid, integer, jsonb, text, text) to anon, authenticated;
grant execute on function public.find_order_for_upload(text) to anon, authenticated;
grant execute on function public.order_accepts_files(text) to anon, authenticated;
grant execute on function public.register_order_file(uuid, text, text, text, text, bigint, integer, integer, integer) to anon, authenticated;
grant execute on function public.set_order_music_link(uuid, text) to anon, authenticated;
grant execute on function public.storage_usage() to authenticated;

-- =====================================================================
-- STORAGE (kho file)
--   order-files   : RIÊNG TƯ. File gốc khách nộp. Khách chỉ upload, không xem/xoá.
--                   Giới hạn: jpg, png, pdf — tối đa 30MB/file.
--   public-assets : CÔNG KHAI. Ảnh gói, mẫu, overlay, showcase... do admin tải lên.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('order-files', 'order-files', false, 31457280,
   array['image/jpeg', 'image/png', 'application/pdf']),
  ('public-assets', 'public-assets', true, 15728640,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- order-files: khách upload vào thư mục <id đơn>/... của đơn đang nhận file
drop policy if exists "order-files: khách upload" on storage.objects;
create policy "order-files: khách upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'order-files'
              and public.order_accepts_files((storage.foldername(name))[1]));

drop policy if exists "order-files: admin đọc" on storage.objects;
create policy "order-files: admin đọc" on storage.objects
  for select to authenticated using (bucket_id = 'order-files' and public.is_admin());
drop policy if exists "order-files: admin sửa" on storage.objects;
create policy "order-files: admin sửa" on storage.objects
  for update to authenticated using (bucket_id = 'order-files' and public.is_admin());
drop policy if exists "order-files: admin xoá" on storage.objects;
create policy "order-files: admin xoá" on storage.objects
  for delete to authenticated using (bucket_id = 'order-files' and public.is_admin());

-- public-assets: admin quản lý; khách chỉ được gửi ảnh kèm đánh giá vào thư mục reviews/
drop policy if exists "public-assets: admin quản lý" on storage.objects;
create policy "public-assets: admin quản lý" on storage.objects
  for all to authenticated
  using (bucket_id = 'public-assets' and public.is_admin())
  with check (bucket_id = 'public-assets' and public.is_admin());
drop policy if exists "public-assets: khách gửi ảnh đánh giá" on storage.objects;
create policy "public-assets: khách gửi ảnh đánh giá" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'public-assets' and (storage.foldername(name))[1] = 'reviews');

-- =====================================================================
-- DỮ LIỆU MẪU (chỉ thêm khi bảng còn trống — admin sửa lại sau)
-- =====================================================================
insert into public.site_settings (key, value) values
  ('home', jsonb_build_object(
     'banner_title', 'Chào mừng đến Tiệm In Taylana!',
     'banner_subtitle', 'Thiết kế & thi công CD theo yêu cầu — từ bìa hộp, mặt đĩa đến booklet, làm thủ công thật xinh cho bạn.',
     'banner_note', 'Đang nhận đơn ✿ Giao toàn quốc')),
  ('contact', jsonb_build_object(
     'zalo', '', 'shopee', '', 'facebook', '', 'phone', '',
     'hours', '8:00 – 21:00 mỗi ngày',
     'note', 'Nhắn tiệm để được tư vấn mẫu và báo giá nhé!'))
on conflict (key) do nothing;

do $$
begin
  if not exists (select 1 from public.packages) then
    insert into public.packages (name, price, description, features, sort_order) values
      ('CD lẻ', 59000, 'Một đĩa CD in mặt đĩa theo thiết kế của bạn.',
        array['1 đĩa CD ghi nhạc', 'In mặt đĩa full màu'], 1),
      ('CD + Hộp', 89000, 'Đĩa CD kèm hộp nhựa trong.',
        array['1 đĩa CD ghi nhạc', 'In mặt đĩa full màu', 'Hộp CD nhựa trong'], 2),
      ('Combo bìa trước & sau', 129000, 'CD + hộp + bìa trước và bìa sau in sắc nét.',
        array['1 đĩa CD ghi nhạc', 'In mặt đĩa full màu', 'Hộp CD', 'Bìa trước 12x12cm', 'Bìa sau 15x11.7cm'], 3),
      ('Combo + Booklet 4 trang', 159000, 'Trọn bộ như album thật, kèm booklet 4 trang.',
        array['1 đĩa CD ghi nhạc', 'In mặt đĩa full màu', 'Hộp CD', 'Bìa trước & sau', 'Booklet 4 trang'], 4),
      ('Combo + Booklet 8 trang', 189000, 'Booklet dày dặn hơn cho nhiều ảnh và lời nhắn.',
        array['1 đĩa CD ghi nhạc', 'In mặt đĩa full màu', 'Hộp CD', 'Bìa trước & sau', 'Booklet 8 trang'], 5);
  end if;

  if not exists (select 1 from public.addons) then
    insert into public.addons (name, price, description, sort_order) values
      ('Gói quà', 15000, 'Giấy gói kraft + nơ xinh', 1),
      ('Thiệp tặng kèm', 10000, 'Thiệp viết tay lời nhắn của bạn', 2),
      ('In card bo góc', 20000, 'Bộ 5 card ảnh bo góc', 3),
      ('In photostrip', 15000, '1 dải photostrip 2x6 inch', 4);
  end if;

  if not exists (select 1 from public.guide_sections) then
    insert into public.guide_sections (title, body, images, links, sort_order) values
      ('1. Chuẩn bị file audio',
       E'• Định dạng: MP3 (320kbps) hoặc WAV.\n• Tổng thời lượng tối đa khoảng 80 phút cho 1 đĩa.\n• Đặt tên file theo thứ tự bài: 01 - Tên bài.mp3, 02 - Tên bài.mp3...\n• Gom tất cả vào một thư mục để chia sẻ.',
       '[]'::jsonb, '[]'::jsonb, 1),
      ('2. Chuẩn bị file hình ảnh',
       E'Xuất file JPG hoặc PNG (hoặc PDF), độ phân giải 300 DPI, hệ màu RGB.\n\n• Bìa trước: 12 x 12 cm (1417 x 1417 px)\n• Bìa sau: 15 x 11.7 cm (1772 x 1382 px)\n• Mặt CD: hình tròn 12 x 12 cm (1417 x 1417 px), chừa lỗ giữa\n• Booklet: 4 / 8 / 12 trang, mỗi trang 12 x 12 cm — trang 1 là bìa.\n\nĐể chữ và chi tiết quan trọng cách mép ít nhất 3mm vì phần mép có thể bị cắt.',
       jsonb_build_array(
         jsonb_build_object('url', '', 'caption', 'Bìa trước 12x12cm'),
         jsonb_build_object('url', '', 'caption', 'Bìa sau 15x11.7cm'),
         jsonb_build_object('url', '', 'caption', 'Mặt CD 12x12cm')),
       '[]'::jsonb, 2),
      ('3. Chia sẻ file',
       E'• File hình: tải lên ở trang "Nộp file" bằng mã đơn hoặc số điện thoại.\n• File nhạc: tải lên Google Drive, bật chia sẻ "Bất kỳ ai có đường liên kết", rồi dán link vào trang "Nộp file".',
       '[]'::jsonb,
       jsonb_build_array(jsonb_build_object('label', 'Đi tới trang Nộp file', 'url', '/nop-file')),
       3);
  end if;
end $$;

-- =====================================================================
-- (THÊM Ở BẢN GIAO DIỆN MỚI) ĐĂNG KÝ NHẬN TIN — ô "Nhận tin mới" ở footer
-- Khách chỉ được THÊM; chỉ admin xem/xoá.
-- =====================================================================
create table if not exists public.subscribers (
  id         uuid primary key default gen_random_uuid(),
  contact    text not null check (char_length(contact) between 5 and 120),
  created_at timestamptz not null default now()
);
alter table public.subscribers enable row level security;
grant insert on public.subscribers to anon, authenticated;
grant select, delete on public.subscribers to authenticated;
drop policy if exists "subscribers: khách đăng ký" on public.subscribers;
create policy "subscribers: khách đăng ký" on public.subscribers for insert to anon, authenticated with check (true);
drop policy if exists "subscribers: admin xem & xoá" on public.subscribers;
create policy "subscribers: admin xem & xoá" on public.subscribers for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ====== (Gộp từ supabase/migration_designs_templates.sql) ======
-- ---------- 1. Bảng thiết kế của khách ----------
create table if not exists public.designs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null default 'Thiết kế không tên' check (char_length(name) between 1 and 120),
  data       jsonb not null default '{}'::jsonb,   -- dữ liệu các trang
  thumbnail  text,                                 -- ảnh thu nhỏ (data URL nhỏ)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists designs_user_idx on public.designs (user_id, updated_at desc);

drop trigger if exists designs_touch on public.designs;
create trigger designs_touch before update on public.designs
  for each row execute function public.touch_updated_at();

alter table public.designs enable row level security;
grant select, insert, update, delete on public.designs to authenticated;

-- Mỗi khách chỉ xem/sửa/xoá thiết kế của mình; admin xem được tất cả
drop policy if exists "designs: chủ xem" on public.designs;
create policy "designs: chủ xem" on public.designs for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "designs: chủ tạo" on public.designs;
create policy "designs: chủ tạo" on public.designs for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "designs: chủ sửa" on public.designs;
create policy "designs: chủ sửa" on public.designs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "designs: chủ xoá" on public.designs;
create policy "designs: chủ xoá" on public.designs for delete to authenticated
  using (user_id = auth.uid());

-- ---------- 2. Kho ảnh riêng tư của khách (thư mục theo user_id) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('design-assets', 'design-assets', false, 31457280,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "design-assets: chủ quản lý" on storage.objects;
create policy "design-assets: chủ quản lý" on storage.objects for all to authenticated
  using (bucket_id = 'design-assets' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'design-assets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "design-assets: admin xem" on storage.objects;
create policy "design-assets: admin xem" on storage.objects for select to authenticated
  using (bucket_id = 'design-assets' and public.is_admin());

-- ---------- 3. Mẫu Custom CD kiểu mới ----------
-- doc = nội dung mẫu tạo bằng trình chỉnh (ảnh trang trí, khung ảnh, chữ, màu/ảnh nền)
alter table public.design_templates add column if not exists doc jsonb;
-- Loại mẫu: thêm Bìa sau - Mặt Ngoài / Mặt Trong ('back' cũ = Mặt Ngoài)
alter table public.design_templates drop constraint if exists design_templates_target_check;
alter table public.design_templates add constraint design_templates_target_check
  check (target in ('front', 'back', 'back_outer', 'back_inner', 'disc'));

-- ====== (Gộp từ supabase/migration_package_presets.sql) ======
alter table public.packages add column if not exists has_disc boolean not null default true;
alter table public.packages add column if not exists front_pages integer not null default 0;
alter table public.packages add column if not exists back_pages integer not null default 0;
alter table public.packages drop constraint if exists packages_front_pages_check;
alter table public.packages add constraint packages_front_pages_check check (front_pages in (0, 1, 2, 4, 8, 12));
alter table public.packages drop constraint if exists packages_back_pages_check;
alter table public.packages add constraint packages_back_pages_check check (back_pages in (0, 1, 2));

-- Điền sẵn preset cho các gói hiện có (theo tên gói)
update public.packages set has_disc = true, front_pages = 0, back_pages = 0
  where name ilike 'CD lẻ%' or name ilike 'CD + Hộp%' or name ilike 'CD + hộp%';
update public.packages set has_disc = true, front_pages = 1, back_pages = 1
  where name ilike '%2 bìa 1 mặt%' or name ilike 'Combo bìa trước & sau%';
update public.packages set has_disc = true, front_pages = 2, back_pages = 2
  where name ilike '%2 bìa 2 mặt%';
update public.packages set has_disc = true, front_pages = 4, back_pages = 2 where name ilike '%booklet 4%';
update public.packages set has_disc = true, front_pages = 8, back_pages = 2 where name ilike '%booklet 8%';
update public.packages set has_disc = true, front_pages = 12, back_pages = 2 where name ilike '%booklet 12%';
