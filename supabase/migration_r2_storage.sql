-- =====================================================================
-- CHUYỂN LƯU FILE SANG CLOUDFLARE R2 (database, đăng nhập, RLS vẫn ở Supabase)
--   File khách gửi kèm đơn giờ nằm ở R2 → register_order_file không còn kiểm tra bảng storage.objects
--   (server đã kiểm tra quyền + loại file + dung lượng khi cấp link tải lên: app/api/storage/upload-url).
--   Chạy 1 lần trong Supabase → SQL Editor (chạy lại cũng không sao).
-- =====================================================================
create or replace function public.register_order_file(
  p_order_id      uuid,
  p_kind          text,
  p_storage_path  text,
  p_file_name     text,
  p_mime_type     text,
  p_size_bytes    bigint,
  p_page          integer default null,
  p_width_px      integer default null,
  p_height_px     integer default null,
  p_order_item_id uuid default null,
  p_copy_no       integer default 1
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_item uuid := p_order_item_id;
begin
  if not public.order_accepts_files(p_order_id::text) then
    raise exception 'Đơn không tồn tại hoặc đã chuyển sang "Đang làm" — không thay file được nữa';
  end if;
  if split_part(p_storage_path, '/', 1) <> p_order_id::text or p_storage_path !~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,200}$' then
    raise exception 'Đường dẫn file không hợp lệ';
  end if;
  if v_item is not null and not exists (select 1 from public.order_items where id = v_item and order_id = p_order_id) then
    raise exception 'Dòng sản phẩm không thuộc đơn này';
  end if;
  if v_item is null and (select count(*) from public.order_items where order_id = p_order_id) = 1 then
    select id into v_item from public.order_items where order_id = p_order_id;
  end if;
  insert into public.order_files (order_id, order_item_id, copy_no, kind, page, storage_path, file_name, mime_type, size_bytes, width_px, height_px)
  values (p_order_id, v_item, greatest(1, coalesce(p_copy_no, 1)), p_kind, p_page, p_storage_path, left(coalesce(p_file_name, ''), 255),
          left(coalesce(p_mime_type, ''), 100), coalesce(p_size_bytes, 0), p_width_px, p_height_px)
  on conflict (storage_path) do nothing
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.register_order_file(uuid, text, text, text, text, bigint, integer, integer, integer, uuid, integer) to anon, authenticated;
