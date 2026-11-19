-- =====================================================================
-- CHIA SẺ MOCKUP (chỉ admin): link xem chỉ đọc /m/<token>, hết hạn sau 24 giờ rồi bị xoá hẳn (ảnh + dữ liệu).
--   · bucket RIÊNG TƯ "mockup-shares" (ảnh trong thư mục <share_id>/) — chỉ admin tải lên / xem / xoá; người xem chỉ qua signed URL
--   · bảng mockup_shares — chỉ admin thêm / sửa / xoá / đọc; khách đọc qua hàm get_mockup_share (token đúng + còn hạn)
--   · hàm mockup_shares_usage(): dung lượng bucket (trang Admin → Link chia sẻ)
--   · pg_cron + pg_net: gọi /api/cron/cleanup-shares mỗi 15 phút (xem phần cuối file — cần tự điền tên miền + CRON_SECRET)
-- Chạy trong Supabase → SQL Editor (chạy lại cũng không sao).
-- KHÔNG xoá file bằng cách xoá dòng trong storage.objects — file chỉ được xoá qua Storage API (route dọn dẹp làm việc này).
-- =====================================================================

-- ---------- bucket riêng tư ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mockup-shares', 'mockup-shares', false, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "mockup-shares: admin xem" on storage.objects;
create policy "mockup-shares: admin xem" on storage.objects for select to authenticated using (bucket_id = 'mockup-shares' and public.is_admin());
drop policy if exists "mockup-shares: admin tải lên" on storage.objects;
create policy "mockup-shares: admin tải lên" on storage.objects for insert to authenticated with check (bucket_id = 'mockup-shares' and public.is_admin());
drop policy if exists "mockup-shares: admin sửa" on storage.objects;
create policy "mockup-shares: admin sửa" on storage.objects for update to authenticated using (bucket_id = 'mockup-shares' and public.is_admin());
drop policy if exists "mockup-shares: admin xoá" on storage.objects;
create policy "mockup-shares: admin xoá" on storage.objects for delete to authenticated using (bucket_id = 'mockup-shares' and public.is_admin());

-- ---------- bảng ----------
create table if not exists public.mockup_shares (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique check (token ~ '^[0-9A-Za-z]{16,64}$'), -- ngẫu nhiên base62 ≥ 128 bit
  state       jsonb not null,                                            -- trạng thái mockup (đường dẫn ảnh trong bucket, không chứa dữ liệu ảnh)
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '24 hours',
  view_count  integer not null default 0
);
create index if not exists mockup_shares_expires_idx on public.mockup_shares (expires_at);
alter table public.mockup_shares enable row level security;
revoke all on public.mockup_shares from anon;
grant select, insert, update, delete on public.mockup_shares to authenticated;
drop policy if exists "mockup_shares: chỉ admin" on public.mockup_shares;
create policy "mockup_shares: chỉ admin" on public.mockup_shares for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- khách: chỉ lấy được state khi token đúng VÀ còn hạn (theo giờ server); mỗi lần mở tăng view_count
create or replace function public.get_mockup_share(p_token text)
returns table (id uuid, state jsonb, expires_at timestamptz)
language sql volatile security definer set search_path = public as $$
  update public.mockup_shares s set view_count = s.view_count + 1
  where s.token = p_token and s.expires_at > now()
  returning s.id, s.state, s.expires_at;
$$;
revoke all on function public.get_mockup_share(text) from public;
grant execute on function public.get_mockup_share(text) to anon, authenticated;

-- dung lượng bucket (byte) — chỉ admin
create or replace function public.mockup_shares_usage()
returns bigint language sql stable security definer set search_path = public, storage as $$
  select case when public.is_admin() then coalesce(sum((o.metadata->>'size')::bigint), 0) else 0 end
  from storage.objects o where o.bucket_id = 'mockup-shares';
$$;
revoke all on function public.mockup_shares_usage() from public;
grant execute on function public.mockup_shares_usage() to authenticated;

-- ---------- tự xoá khi hết hạn: pg_cron + pg_net ----------
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- BỎ COMMENT đoạn dưới rồi chạy RIÊNG (1 lần) sau khi:
--   1) thay <TEN-MIEN> bằng tên miền web (vd taylana.vn — không có https:// và dấu / ở cuối)
--   2) thay <CRON_SECRET> bằng đúng giá trị biến môi trường CRON_SECRET đã đặt trên Vercel
-- (KHÔNG commit secret vào code — chỉ dán vào SQL Editor.)
--
-- select cron.unschedule('cleanup-mockup-shares') where exists (select 1 from cron.job where jobname = 'cleanup-mockup-shares');
-- select cron.schedule(
--   'cleanup-mockup-shares',
--   '*/15 * * * *',
--   $$
--   select net.http_post(
--     url := 'https://<TEN-MIEN>/api/cron/cleanup-shares',
--     headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>', 'Content-Type', 'application/json'),
--     body := '{}'::jsonb
--   );
--   $$
-- );
--
-- Kiểm tra lịch: select * from cron.job;   Lịch sử chạy: select * from cron.job_run_details order by start_time desc limit 20;
