-- =====================================================================
-- BOOKLET SCRAPBOOK + KHUNG ẢNH + LỜI CHÚC
--   · frame_sets, frames: thư viện Khung ảnh (theo bộ) — chuyển các chất liệu nhóm "Khung ảnh" cũ sang đây
--   · wish_topics, wishes: thư viện Lời chúc (nạp sẵn 7 chủ đề × 10 lời chúc mẫu)
--   · scrapbook_template_settings: thêm cột surface_type ('disc' = CD Scrapbook, 'spread' = cặp trang Booklet Scrapbook,
--     n = kiểu dàn trang cặp 1–5). (Bảng mẫu sửa tay của dự án này tên là scrapbook_template_settings.)
-- RLS: ai cũng đọc được bản đang bật, chỉ admin được thêm / sửa / xoá.
-- Chạy 1 lần trong Supabase → SQL Editor (chạy lại cũng không sao). Cần chạy migration_scrapbook.sql + migration_scrapbook_edit.sql trước.
-- =====================================================================

-- ---------- Khung ảnh ----------
create table if not exists public.frame_sets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create table if not exists public.frames (
  id          uuid primary key default gen_random_uuid(),
  set_id      uuid not null references public.frame_sets (id) on delete cascade,
  name        text not null default 'Khung',
  url         text not null,                 -- ảnh khung PNG (ô ảnh trong suốt)
  region      jsonb,                         -- vùng ảnh nằm dưới khung {x0,y0,x1,y1} (0..1)
  mask_url    text,                          -- ảnh mặt nạ đen trắng (trắng = vùng ảnh) cho ô tròn, tim, hình bất kỳ
  ratio       real not null default 1,       -- cao / rộng của ảnh khung
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists frames_set_idx on public.frames (set_id, sort_order);

-- ---------- Lời chúc ----------
create table if not exists public.wish_topics (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create table if not exists public.wishes (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references public.wish_topics (id) on delete cascade,
  content     text not null,
  lang        text not null default 'vi' check (lang in ('vi', 'en')),
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists wishes_topic_idx on public.wishes (topic_id, sort_order);

-- ---------- RLS ----------
alter table public.frame_sets enable row level security;
alter table public.frames enable row level security;
alter table public.wish_topics enable row level security;
alter table public.wishes enable row level security;
grant select on public.frame_sets, public.frames, public.wish_topics, public.wishes to anon, authenticated;
grant insert, update, delete on public.frame_sets, public.frames, public.wish_topics, public.wishes to authenticated;

drop policy if exists "frame_sets: đọc bản đang bật" on public.frame_sets;
create policy "frame_sets: đọc bản đang bật" on public.frame_sets for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "frame_sets: admin toàn quyền" on public.frame_sets;
create policy "frame_sets: admin toàn quyền" on public.frame_sets for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "frames: đọc bản đang bật" on public.frames;
create policy "frames: đọc bản đang bật" on public.frames for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "frames: admin toàn quyền" on public.frames;
create policy "frames: admin toàn quyền" on public.frames for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "wish_topics: đọc bản đang bật" on public.wish_topics;
create policy "wish_topics: đọc bản đang bật" on public.wish_topics for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "wish_topics: admin toàn quyền" on public.wish_topics;
create policy "wish_topics: admin toàn quyền" on public.wish_topics for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "wishes: đọc bản đang bật" on public.wishes;
create policy "wishes: đọc bản đang bật" on public.wishes for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "wishes: admin toàn quyền" on public.wishes;
create policy "wishes: admin toàn quyền" on public.wishes for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Mẫu: thêm loại bề mặt (CD / cặp trang booklet) ----------
alter table public.scrapbook_template_settings add column if not exists surface_type text not null default 'disc';
alter table public.scrapbook_template_settings drop constraint if exists scrapbook_template_settings_n_check;
alter table public.scrapbook_template_settings drop constraint if exists scrapbook_template_settings_surface_check;
alter table public.scrapbook_template_settings add constraint scrapbook_template_settings_surface_check
  check ((surface_type = 'disc' and n between 5 and 10) or (surface_type = 'spread' and n between 1 and 20));
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'scrapbook_template_settings_pkey'
             and pg_get_constraintdef(oid) not like '%surface_type%') then
    alter table public.scrapbook_template_settings drop constraint scrapbook_template_settings_pkey;
    alter table public.scrapbook_template_settings add primary key (surface_type, n, style);
  end if;
end $$;

-- ---------- Chuyển khung cũ (chất liệu nhóm "Khung ảnh") sang thư viện Khung ảnh ----------
insert into public.frame_sets (name, sort_order)
select 'Khung ảnh (chuyển từ chất liệu cũ)', 0
where exists (select 1 from public.scrapbook_assets where grp = 'frame')
  and not exists (select 1 from public.frame_sets where name = 'Khung ảnh (chuyển từ chất liệu cũ)');
insert into public.frames (set_id, name, url, region, ratio, is_active, sort_order)
select s.id, a.name, a.url, a.region, 1, a.is_active and a.region is not null, a.sort_order
from public.scrapbook_assets a
cross join (select id from public.frame_sets where name = 'Khung ảnh (chuyển từ chất liệu cũ)' limit 1) s
where a.grp = 'frame' and not exists (select 1 from public.frames f where f.url = a.url);
update public.scrapbook_assets set is_active = false where grp = 'frame';
-- (tỉ lệ khung cũ để mặc định 1 — mở tab "Khung ảnh", bấm "Vùng ảnh" rồi "Lưu" để cập nhật; khung tải mới tự đo tỉ lệ)

-- ---------- /api/img-proxy: cho phép tải hộ ảnh khung + mặt nạ ----------
create or replace function public.mockup_url_allowed(p_url text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mockup_frames where image_url = p_url)
      or exists (select 1 from public.mockup_frames f, jsonb_array_elements(f.regions) r where r->>'mask_url' = p_url)
      or exists (select 1 from public.mockup_backgrounds where url = p_url)
      or exists (select 1 from public.scrapbook_assets where url = p_url and is_active)
      or exists (select 1 from public.frames where (url = p_url or mask_url = p_url) and is_active);
$$;
grant execute on function public.mockup_url_allowed(text) to anon, authenticated;

-- ---------- Lời chúc mẫu (7 chủ đề × 10) ----------
insert into public.wish_topics (name, sort_order) select 'Sinh nhật', 0 where not exists (select 1 from public.wish_topics where name = 'Sinh nhật');
insert into public.wish_topics (name, sort_order) select 'Tốt nghiệp', 1 where not exists (select 1 from public.wish_topics where name = 'Tốt nghiệp');
insert into public.wish_topics (name, sort_order) select 'Valentine', 2 where not exists (select 1 from public.wish_topics where name = 'Valentine');
insert into public.wish_topics (name, sort_order) select 'Kỷ niệm', 3 where not exists (select 1 from public.wish_topics where name = 'Kỷ niệm');
insert into public.wish_topics (name, sort_order) select 'Cảm ơn', 4 where not exists (select 1 from public.wish_topics where name = 'Cảm ơn');
insert into public.wish_topics (name, sort_order) select 'Bạn thân', 5 where not exists (select 1 from public.wish_topics where name = 'Bạn thân');
insert into public.wish_topics (name, sort_order) select 'Gia đình', 6 where not exists (select 1 from public.wish_topics where name = 'Gia đình');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Chúc mừng sinh nhật! Mong tuổi mới của bạn có thật nhiều buổi sáng thức dậy thấy lòng nhẹ tênh.', 'vi', 0 from public.wish_topics t where t.name = 'Sinh nhật' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Chúc mừng sinh nhật! Mong tuổi mới của bạn có thật nhiều buổi sáng thức dậy thấy lòng nhẹ tênh.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Thêm một tuổi, thêm một năm được ở cạnh nhau. Cảm ơn vì bạn đã sinh ra trên đời này.', 'vi', 1 from public.wish_topics t where t.name = 'Sinh nhật' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Thêm một tuổi, thêm một năm được ở cạnh nhau. Cảm ơn vì bạn đã sinh ra trên đời này.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Chúc bạn tuổi mới cứ vui như hôm nay, cứ khoẻ như hồi mười tám, cứ thương mình nhiều hơn một chút.', 'vi', 2 from public.wish_topics t where t.name = 'Sinh nhật' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Chúc bạn tuổi mới cứ vui như hôm nay, cứ khoẻ như hồi mười tám, cứ thương mình nhiều hơn một chút.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Hôm nay là ngày của bạn. Cứ ăn bánh thật nhiều, cười thật to, những chuyện còn lại để mai tính.', 'vi', 3 from public.wish_topics t where t.name = 'Sinh nhật' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Hôm nay là ngày của bạn. Cứ ăn bánh thật nhiều, cười thật to, những chuyện còn lại để mai tính.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Mong năm nay mọi điều bạn ấp ủ đều tìm được đường đi, và mọi người bạn thương đều ở lại.', 'vi', 4 from public.wish_topics t where t.name = 'Sinh nhật' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Mong năm nay mọi điều bạn ấp ủ đều tìm được đường đi, và mọi người bạn thương đều ở lại.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Gửi bạn một năm mới của riêng bạn: ít lo âu, nhiều giấc ngủ ngon và những chuyến đi đáng nhớ.', 'vi', 5 from public.wish_topics t where t.name = 'Sinh nhật' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Gửi bạn một năm mới của riêng bạn: ít lo âu, nhiều giấc ngủ ngon và những chuyến đi đáng nhớ.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Chúc mừng sinh nhật người đã làm những ngày bình thường của mình trở nên đặc biệt.', 'vi', 6 from public.wish_topics t where t.name = 'Sinh nhật' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Chúc mừng sinh nhật người đã làm những ngày bình thường của mình trở nên đặc biệt.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Tuổi mới không cần phải thật hoàn hảo, chỉ cần thật là bạn. Sinh nhật vui nhé!', 'vi', 7 from public.wish_topics t where t.name = 'Sinh nhật' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Tuổi mới không cần phải thật hoàn hảo, chỉ cần thật là bạn. Sinh nhật vui nhé!');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Happy birthday! Here''s to another year of laughing too loud and loving too much.', 'en', 8 from public.wish_topics t where t.name = 'Sinh nhật' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Happy birthday! Here''s to another year of laughing too loud and loving too much.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Wishing you a year as warm and bright as you are. Happy birthday!', 'en', 9 from public.wish_topics t where t.name = 'Sinh nhật' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Wishing you a year as warm and bright as you are. Happy birthday!');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Chúc mừng tốt nghiệp! Bao nhiêu đêm thức trắng cuối cùng cũng đã thành một tấm bằng thật đẹp.', 'vi', 0 from public.wish_topics t where t.name = 'Tốt nghiệp' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Chúc mừng tốt nghiệp! Bao nhiêu đêm thức trắng cuối cùng cũng đã thành một tấm bằng thật đẹp.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Cánh cổng trường khép lại, cánh cửa mới mở ra. Mình tin bạn sẽ đi thật xa.', 'vi', 1 from public.wish_topics t where t.name = 'Tốt nghiệp' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Cánh cổng trường khép lại, cánh cửa mới mở ra. Mình tin bạn sẽ đi thật xa.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Tự hào về bạn vì đã không bỏ cuộc, kể cả những hôm tưởng chừng không cố thêm được nữa.', 'vi', 2 from public.wish_topics t where t.name = 'Tốt nghiệp' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Tự hào về bạn vì đã không bỏ cuộc, kể cả những hôm tưởng chừng không cố thêm được nữa.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Mong chặng đường phía trước có việc bạn yêu, có người bạn quý và có những ngày bạn thấy mình đủ đầy.', 'vi', 3 from public.wish_topics t where t.name = 'Tốt nghiệp' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Mong chặng đường phía trước có việc bạn yêu, có người bạn quý và có những ngày bạn thấy mình đủ đầy.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Chúc mừng cử nhân mới! Giờ thì nghỉ ngơi một chút đã, thế giới vẫn đợi bạn mà.', 'vi', 4 from public.wish_topics t where t.name = 'Tốt nghiệp' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Chúc mừng cử nhân mới! Giờ thì nghỉ ngơi một chút đã, thế giới vẫn đợi bạn mà.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Những năm tháng đi học sẽ là kỷ niệm, còn những gì bạn học được sẽ theo bạn mãi.', 'vi', 5 from public.wish_topics t where t.name = 'Tốt nghiệp' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Những năm tháng đi học sẽ là kỷ niệm, còn những gì bạn học được sẽ theo bạn mãi.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Ngày hôm nay là của bạn, của những bài thi, những lần thất bại và cả những lần đứng dậy.', 'vi', 6 from public.wish_topics t where t.name = 'Tốt nghiệp' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Ngày hôm nay là của bạn, của những bài thi, những lần thất bại và cả những lần đứng dậy.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Đi tiếp nhé, đừng sợ sai. Mình luôn ở đây để vỗ tay cho bạn.', 'vi', 7 from public.wish_topics t where t.name = 'Tốt nghiệp' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Đi tiếp nhé, đừng sợ sai. Mình luôn ở đây để vỗ tay cho bạn.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Congratulations, graduate! The best chapters are still unwritten.', 'en', 8 from public.wish_topics t where t.name = 'Tốt nghiệp' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Congratulations, graduate! The best chapters are still unwritten.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'You did it! So proud of every late night that got you here.', 'en', 9 from public.wish_topics t where t.name = 'Tốt nghiệp' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'You did it! So proud of every late night that got you here.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Cảm ơn anh vì đã chọn em, và vẫn tiếp tục chọn em mỗi ngày.', 'vi', 0 from public.wish_topics t where t.name = 'Valentine' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Cảm ơn anh vì đã chọn em, và vẫn tiếp tục chọn em mỗi ngày.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Có em, những ngày bình thường nhất cũng thành ngày đẹp nhất.', 'vi', 1 from public.wish_topics t where t.name = 'Valentine' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Có em, những ngày bình thường nhất cũng thành ngày đẹp nhất.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Không cần hoa hồng hay nến lung linh, chỉ cần cuối ngày được về bên nhau là đủ.', 'vi', 2 from public.wish_topics t where t.name = 'Valentine' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Không cần hoa hồng hay nến lung linh, chỉ cần cuối ngày được về bên nhau là đủ.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Cảm ơn vì đã kiên nhẫn với những lúc khó thương nhất của mình.', 'vi', 3 from public.wish_topics t where t.name = 'Valentine' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Cảm ơn vì đã kiên nhẫn với những lúc khó thương nhất của mình.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Mình không hứa sẽ luôn hoàn hảo, nhưng hứa sẽ luôn cố gắng vì hai đứa.', 'vi', 4 from public.wish_topics t where t.name = 'Valentine' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Mình không hứa sẽ luôn hoàn hảo, nhưng hứa sẽ luôn cố gắng vì hai đứa.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Thương nhau là cùng ăn tô mì lúc nửa đêm, cùng cười vì những chuyện chẳng ai hiểu.', 'vi', 5 from public.wish_topics t where t.name = 'Valentine' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Thương nhau là cùng ăn tô mì lúc nửa đêm, cùng cười vì những chuyện chẳng ai hiểu.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Gặp được nhau đã là may mắn, ở lại bên nhau là lựa chọn. Valentine vui nhé!', 'vi', 6 from public.wish_topics t where t.name = 'Valentine' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Gặp được nhau đã là may mắn, ở lại bên nhau là lựa chọn. Valentine vui nhé!');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Mong mình cứ nắm tay nhau đi qua thêm thật nhiều mùa Valentine nữa.', 'vi', 7 from public.wish_topics t where t.name = 'Valentine' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Mong mình cứ nắm tay nhau đi qua thêm thật nhiều mùa Valentine nữa.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'You are my favorite hello and my hardest goodbye.', 'en', 8 from public.wish_topics t where t.name = 'Valentine' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'You are my favorite hello and my hardest goodbye.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Every love story is beautiful, but ours is my favorite.', 'en', 9 from public.wish_topics t where t.name = 'Valentine' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Every love story is beautiful, but ours is my favorite.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Một năm bên nhau, cảm ơn vì đã cùng mình viết nên những trang đẹp nhất.', 'vi', 0 from public.wish_topics t where t.name = 'Kỷ niệm' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Một năm bên nhau, cảm ơn vì đã cùng mình viết nên những trang đẹp nhất.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Nhìn lại mới thấy mình đã đi cùng nhau một quãng thật dài, và vẫn muốn đi tiếp.', 'vi', 1 from public.wish_topics t where t.name = 'Kỷ niệm' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Nhìn lại mới thấy mình đã đi cùng nhau một quãng thật dài, và vẫn muốn đi tiếp.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Kỷ niệm ngày đầu tiên mình gặp nhau. Ai ngờ một lời chào lại thành cả một câu chuyện.', 'vi', 2 from public.wish_topics t where t.name = 'Kỷ niệm' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Kỷ niệm ngày đầu tiên mình gặp nhau. Ai ngờ một lời chào lại thành cả một câu chuyện.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Cảm ơn những chuyến đi, những bữa cơm và cả những lần giận rồi lại thương.', 'vi', 3 from public.wish_topics t where t.name = 'Kỷ niệm' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Cảm ơn những chuyến đi, những bữa cơm và cả những lần giận rồi lại thương.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Có những ngày rất bình thường, nhưng vì có nhau nên đã thành kỷ niệm.', 'vi', 4 from public.wish_topics t where t.name = 'Kỷ niệm' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Có những ngày rất bình thường, nhưng vì có nhau nên đã thành kỷ niệm.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Mỗi tấm ảnh trong cuốn này là một lần mình thấy may mắn vì có nhau.', 'vi', 5 from public.wish_topics t where t.name = 'Kỷ niệm' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Mỗi tấm ảnh trong cuốn này là một lần mình thấy may mắn vì có nhau.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Thời gian trôi nhanh thật, chỉ có tình cảm mình dành cho nhau là chẳng vơi đi.', 'vi', 6 from public.wish_topics t where t.name = 'Kỷ niệm' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Thời gian trôi nhanh thật, chỉ có tình cảm mình dành cho nhau là chẳng vơi đi.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Chúc mừng kỷ niệm của chúng mình. Năm sau, năm sau nữa, mình vẫn ở đây nhé.', 'vi', 7 from public.wish_topics t where t.name = 'Kỷ niệm' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Chúc mừng kỷ niệm của chúng mình. Năm sau, năm sau nữa, mình vẫn ở đây nhé.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Happy anniversary to my favorite person and my best adventure.', 'en', 8 from public.wish_topics t where t.name = 'Kỷ niệm' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Happy anniversary to my favorite person and my best adventure.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Here''s to us: then, now and always.', 'en', 9 from public.wish_topics t where t.name = 'Kỷ niệm' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Here''s to us: then, now and always.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Cảm ơn vì đã xuất hiện đúng lúc mình cần nhất.', 'vi', 0 from public.wish_topics t where t.name = 'Cảm ơn' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Cảm ơn vì đã xuất hiện đúng lúc mình cần nhất.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Có những điều nhỏ bé bạn làm mà mình nhớ mãi. Cảm ơn bạn, thật lòng.', 'vi', 1 from public.wish_topics t where t.name = 'Cảm ơn' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Có những điều nhỏ bé bạn làm mà mình nhớ mãi. Cảm ơn bạn, thật lòng.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Cảm ơn vì đã lắng nghe, kể cả khi mình nói lan man chẳng đâu vào đâu.', 'vi', 2 from public.wish_topics t where t.name = 'Cảm ơn' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Cảm ơn vì đã lắng nghe, kể cả khi mình nói lan man chẳng đâu vào đâu.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Không biết nói gì hơn ngoài hai chữ cảm ơn, nhưng mình mong bạn biết nó nặng lòng đến thế nào.', 'vi', 3 from public.wish_topics t where t.name = 'Cảm ơn' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Không biết nói gì hơn ngoài hai chữ cảm ơn, nhưng mình mong bạn biết nó nặng lòng đến thế nào.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Cảm ơn thầy cô đã kiên nhẫn với chúng em suốt những năm tháng ấy.', 'vi', 4 from public.wish_topics t where t.name = 'Cảm ơn' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Cảm ơn thầy cô đã kiên nhẫn với chúng em suốt những năm tháng ấy.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Nhờ có bạn mà một năm vất vả bỗng nhẹ đi rất nhiều.', 'vi', 5 from public.wish_topics t where t.name = 'Cảm ơn' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Nhờ có bạn mà một năm vất vả bỗng nhẹ đi rất nhiều.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Cảm ơn vì luôn tin mình, cả những lúc chính mình còn chẳng tin nổi.', 'vi', 6 from public.wish_topics t where t.name = 'Cảm ơn' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Cảm ơn vì luôn tin mình, cả những lúc chính mình còn chẳng tin nổi.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Gửi lời cảm ơn đến người luôn âm thầm giúp đỡ mà chẳng bao giờ kể công.', 'vi', 7 from public.wish_topics t where t.name = 'Cảm ơn' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Gửi lời cảm ơn đến người luôn âm thầm giúp đỡ mà chẳng bao giờ kể công.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Thank you for being the kind of person the world needs more of.', 'en', 8 from public.wish_topics t where t.name = 'Cảm ơn' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Thank you for being the kind of person the world needs more of.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Your kindness made a bigger difference than you''ll ever know.', 'en', 9 from public.wish_topics t where t.name = 'Cảm ơn' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Your kindness made a bigger difference than you''ll ever know.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Bạn thân là người biết hết chuyện xấu hổ của mình mà vẫn ở lại.', 'vi', 0 from public.wish_topics t where t.name = 'Bạn thân' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Bạn thân là người biết hết chuyện xấu hổ của mình mà vẫn ở lại.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Cảm ơn vì đã cùng mình đi qua những năm tháng ngốc nghếch nhất.', 'vi', 1 from public.wish_topics t where t.name = 'Bạn thân' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Cảm ơn vì đã cùng mình đi qua những năm tháng ngốc nghếch nhất.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Dù có bận đến đâu, chỉ cần bạn gọi là mình có mặt. Hứa đó!', 'vi', 2 from public.wish_topics t where t.name = 'Bạn thân' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Dù có bận đến đâu, chỉ cần bạn gọi là mình có mặt. Hứa đó!');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Mười năm nữa, hai đứa vẫn sẽ ngồi trà sữa và nói xấu người yêu cũ chứ?', 'vi', 3 from public.wish_topics t where t.name = 'Bạn thân' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Mười năm nữa, hai đứa vẫn sẽ ngồi trà sữa và nói xấu người yêu cũ chứ?');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Có bạn thân rồi thì chuyện buồn cũng chia đôi, chuyện vui thì nhân ba.', 'vi', 4 from public.wish_topics t where t.name = 'Bạn thân' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Có bạn thân rồi thì chuyện buồn cũng chia đôi, chuyện vui thì nhân ba.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Mình không cần nhiều bạn, chỉ cần một người như bạn là đủ.', 'vi', 5 from public.wish_topics t where t.name = 'Bạn thân' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Mình không cần nhiều bạn, chỉ cần một người như bạn là đủ.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Gửi đồng bọn: cảm ơn vì đã luôn là nhà, ở bất cứ nơi đâu.', 'vi', 6 from public.wish_topics t where t.name = 'Bạn thân' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Gửi đồng bọn: cảm ơn vì đã luôn là nhà, ở bất cứ nơi đâu.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Lớn rồi, mỗi đứa một nơi, nhưng tình bạn này thì không đi đâu cả.', 'vi', 7 from public.wish_topics t where t.name = 'Bạn thân' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Lớn rồi, mỗi đứa một nơi, nhưng tình bạn này thì không đi đâu cả.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Friends like you are the family we choose.', 'en', 8 from public.wish_topics t where t.name = 'Bạn thân' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Friends like you are the family we choose.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Thanks for all the inside jokes nobody else will ever understand.', 'en', 9 from public.wish_topics t where t.name = 'Bạn thân' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Thanks for all the inside jokes nobody else will ever understand.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Cảm ơn bố mẹ vì đã cho con một mái nhà luôn sáng đèn chờ con về.', 'vi', 0 from public.wish_topics t where t.name = 'Gia đình' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Cảm ơn bố mẹ vì đã cho con một mái nhà luôn sáng đèn chờ con về.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Đi đâu rồi cũng nhớ bữa cơm nhà, nhớ tiếng mẹ gọi và nụ cười của bố.', 'vi', 1 from public.wish_topics t where t.name = 'Gia đình' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Đi đâu rồi cũng nhớ bữa cơm nhà, nhớ tiếng mẹ gọi và nụ cười của bố.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Con lớn rồi, nhưng trong mắt bố mẹ chắc vẫn là đứa trẻ ngày nào. Con thương bố mẹ nhiều.', 'vi', 2 from public.wish_topics t where t.name = 'Gia đình' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Con lớn rồi, nhưng trong mắt bố mẹ chắc vẫn là đứa trẻ ngày nào. Con thương bố mẹ nhiều.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Nhà là nơi mình được là chính mình, và mọi người vẫn thương mình như thế.', 'vi', 3 from public.wish_topics t where t.name = 'Gia đình' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Nhà là nơi mình được là chính mình, và mọi người vẫn thương mình như thế.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Cảm ơn ông bà vì những câu chuyện, những món ăn và cả bầu trời yêu thương.', 'vi', 4 from public.wish_topics t where t.name = 'Gia đình' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Cảm ơn ông bà vì những câu chuyện, những món ăn và cả bầu trời yêu thương.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Gửi em: dù có cãi nhau bao nhiêu, anh chị vẫn luôn đứng về phía em.', 'vi', 5 from public.wish_topics t where t.name = 'Gia đình' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Gửi em: dù có cãi nhau bao nhiêu, anh chị vẫn luôn đứng về phía em.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Mong cả nhà mình luôn khoẻ mạnh, bình an và còn thật nhiều dịp tụ họp như thế này.', 'vi', 6 from public.wish_topics t where t.name = 'Gia đình' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Mong cả nhà mình luôn khoẻ mạnh, bình an và còn thật nhiều dịp tụ họp như thế này.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Những tấm ảnh này là để nhớ rằng mình đã hạnh phúc biết bao khi ở cạnh nhau.', 'vi', 7 from public.wish_topics t where t.name = 'Gia đình' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Những tấm ảnh này là để nhớ rằng mình đã hạnh phúc biết bao khi ở cạnh nhau.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Home is wherever we''re together.', 'en', 8 from public.wish_topics t where t.name = 'Gia đình' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Home is wherever we''re together.');
insert into public.wishes (topic_id, content, lang, sort_order) select t.id, 'Thank you for the roots to grow and the wings to fly.', 'en', 9 from public.wish_topics t where t.name = 'Gia đình' and not exists (select 1 from public.wishes w where w.topic_id = t.id and w.content = 'Thank you for the roots to grow and the wings to fly.');
