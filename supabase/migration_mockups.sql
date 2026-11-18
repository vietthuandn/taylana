-- =====================================================================
-- MẪU MOCKUP: khung CD (tối đa 5 mẫu) + nền của tiệm + bucket "mockups" + cài đặt watermark.
-- Chạy 1 lần trong Supabase → SQL Editor (chạy lại cũng không sao).
-- Ảnh của KHÁCH không bao giờ được tải lên — chỉ ảnh khung / nền do admin thêm.
-- =====================================================================

create table if not exists public.mockup_frames (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  image_url   text not null,                                    -- ảnh khung PNG (link ngoài hoặc bucket "mockups")
  source      text not null default 'url' check (source in ('url', 'storage')),
  regions     jsonb not null default '[]'::jsonb,                -- [{id, type, pts:[[x,y]×4] (0..1), order, glass, blend, mask_url, spine, hole}]
  glass       jsonb not null default '{"strength": 50, "angle": -35}'::jsonb,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists mockup_frames_touch on public.mockup_frames;
create trigger mockup_frames_touch before update on public.mockup_frames for each row execute function public.touch_updated_at();

-- Tối đa 5 mẫu khung
create or replace function public.mockup_frames_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.mockup_frames) >= 5 then
    raise exception 'Tối đa 5 mẫu khung CD';
  end if;
  return new;
end $$;
drop trigger if exists mockup_frames_limit on public.mockup_frames;
create trigger mockup_frames_limit before insert on public.mockup_frames for each row execute function public.mockup_frames_limit();

create table if not exists public.mockup_backgrounds (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  url         text not null,                                    -- chỉ LINK ảnh (không lưu file)
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- RLS: ai cũng đọc được mẫu / nền đang bật; chỉ admin tạo, sửa, xoá
alter table public.mockup_frames enable row level security;
alter table public.mockup_backgrounds enable row level security;
grant select on public.mockup_frames, public.mockup_backgrounds to anon, authenticated;
grant insert, update, delete on public.mockup_frames, public.mockup_backgrounds to authenticated;
drop policy if exists "mockup_frames: ai cũng đọc" on public.mockup_frames;
create policy "mockup_frames: ai cũng đọc" on public.mockup_frames for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "mockup_frames: admin toàn quyền" on public.mockup_frames;
create policy "mockup_frames: admin toàn quyền" on public.mockup_frames for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mockup_backgrounds: ai cũng đọc" on public.mockup_backgrounds;
create policy "mockup_backgrounds: ai cũng đọc" on public.mockup_backgrounds for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "mockup_backgrounds: admin toàn quyền" on public.mockup_backgrounds;
create policy "mockup_backgrounds: admin toàn quyền" on public.mockup_backgrounds for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Bucket công khai "mockups" (ảnh khung, mặt nạ PNG do admin upload)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mockups', 'mockups', true, 15728640, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "mockups: ai cũng xem" on storage.objects;
create policy "mockups: ai cũng xem" on storage.objects for select to anon, authenticated using (bucket_id = 'mockups');
drop policy if exists "mockups: admin tải lên" on storage.objects;
create policy "mockups: admin tải lên" on storage.objects for insert to authenticated with check (bucket_id = 'mockups' and public.is_admin());
drop policy if exists "mockups: admin sửa" on storage.objects;
create policy "mockups: admin sửa" on storage.objects for update to authenticated using (bucket_id = 'mockups' and public.is_admin());
drop policy if exists "mockups: admin xoá" on storage.objects;
create policy "mockups: admin xoá" on storage.objects for delete to authenticated using (bucket_id = 'mockups' and public.is_admin());

-- Cài đặt: watermark "Taylana" trên ảnh mockup tải về
insert into public.site_settings (key, value) values ('mockup', '{"watermark": true}'::jsonb) on conflict (key) do nothing;

-- /api/img-proxy chỉ tải hộ các link ảnh khung / mặt nạ / nền mà admin đã lưu
create or replace function public.mockup_url_allowed(p_url text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mockup_frames where image_url = p_url)
      or exists (select 1 from public.mockup_frames f, jsonb_array_elements(f.regions) r where r->>'mask_url' = p_url)
      or exists (select 1 from public.mockup_backgrounds where url = p_url);
$$;
grant execute on function public.mockup_url_allowed(text) to anon, authenticated;
