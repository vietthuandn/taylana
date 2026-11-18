-- =====================================================================
-- MẪU MẶC ĐỊNH CHO GÓI "CD + Hộp": 1 khung chỉ có vùng Mặt đĩa.
-- Khung này KHÔNG tính vào giới hạn 5 mẫu và KHÔNG hiện trong danh sách chọn mẫu phía khách.
-- Chạy 1 lần trong Supabase → SQL Editor (chạy lại cũng không sao).
-- =====================================================================
alter table public.mockup_frames add column if not exists is_default_box boolean not null default false;

-- chỉ 1 khung được làm mẫu mặc định
create unique index if not exists mockup_frames_one_default_box on public.mockup_frames (is_default_box) where is_default_box;

-- Tối đa 5 mẫu thường (không tính mẫu mặc định CD + Hộp)
create or replace function public.mockup_frames_limit()
returns trigger language plpgsql as $$
begin
  if new.is_default_box then return new; end if;
  if (select count(*) from public.mockup_frames where not is_default_box and id <> new.id) >= 5 then
    raise exception 'Tối đa 5 mẫu khung CD';
  end if;
  return new;
end $$;
drop trigger if exists mockup_frames_limit on public.mockup_frames;
create trigger mockup_frames_limit before insert or update of is_default_box on public.mockup_frames
  for each row execute function public.mockup_frames_limit();
