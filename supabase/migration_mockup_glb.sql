-- =====================================================================
-- MÔ HÌNH 3D (.glb) cho mockup hộp CD: cho phép bucket "mockups" nhận file .glb (tối đa 30MB).
-- Chạy 1 lần trong Supabase → SQL Editor (chạy lại cũng không sao).
-- =====================================================================
update storage.buckets
  set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'model/gltf-binary', 'application/octet-stream'],
      file_size_limit = 31457280
  where id = 'mockups';
