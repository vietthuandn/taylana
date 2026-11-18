-- =====================================================================
-- NHIỀU MẪU TRANG CHỦ: mẫu đang dùng + ghi chú từng mẫu + dữ liệu riêng theo mẫu.
-- Chạy 1 lần trong Supabase → SQL Editor (chạy lại cũng không sao).
-- =====================================================================

-- Mẫu đang dùng (ai cũng đọc được, chỉ admin sửa — theo policy có sẵn của site_settings)
insert into public.site_settings (key, value) values ('active_home_variant', to_jsonb('v1-hien-tai'::text))
on conflict (key) do nothing;
-- Dữ liệu riêng theo mẫu: { "<id mẫu>": { ... } } (mẫu nào cần thêm dữ liệu thì lưu ở đây)
insert into public.site_settings (key, value) values ('variant_settings', '{}'::jsonb)
on conflict (key) do nothing;

-- Ghi chú của admin cho từng mẫu (chỉ admin đọc / sửa)
create table if not exists public.home_variant_notes (
  variant_id text primary key,
  note       text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.home_variant_notes enable row level security;
grant select, insert, update, delete on public.home_variant_notes to authenticated;
drop policy if exists "home_variant_notes: admin toàn quyền" on public.home_variant_notes;
create policy "home_variant_notes: admin toàn quyền" on public.home_variant_notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
