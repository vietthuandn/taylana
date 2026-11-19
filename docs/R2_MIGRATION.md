# Chuyển lưu file sang Cloudflare R2

Database, đăng nhập và RLS vẫn ở Supabase. Chỉ **file** (ảnh, file in, file khách gửi) chuyển sang R2.

## 1. Biến môi trường (Vercel → Settings → Environment Variables, chọn Production)

| Biến | Giá trị | Ghi chú |
|---|---|---|
| `R2_ACCOUNT_ID` | Account ID của Cloudflare | bí mật, chỉ server |
| `R2_ACCESS_KEY_ID` | Access Key ID của R2 API token | bí mật, chỉ server |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key của token | bí mật, chỉ server |
| `R2_PUBLIC_BUCKET` | `taylana-public` | |
| `R2_PRIVATE_BUCKET` | `taylana-private` | |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | link công khai của bucket public, vd `https://pub-xxxx.r2.dev` hoặc tên miền riêng | không có `/` ở cuối |
| `STORAGE_PROVIDER` | `r2` (mặc định) hoặc `supabase` | không bắt buộc |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key `sb_secret_…` | đã có — cần cho quyền đơn hàng + chế độ `supabase` |

Token R2 cần quyền **Object Read & Write** cho cả 2 bucket.

## 2. Cấu trúc file

Khoá file = `<thư mục gốc cũ>/<đường dẫn cũ>` (giữ nguyên như Supabase Storage):

- **taylana-public** (đọc công khai): `scrapbook/…` (sticker, băng dính, doodle, giấy, texture, khung ảnh, font cut-out), `public-assets/…` (sản phẩm, gallery, trang chủ, icon, mẫu Custom CD, photostrip, đánh giá), `mockups/…` (ảnh / khung mockup, mô hình 3D, Canva).
- **taylana-private** (chỉ đọc bằng link có hạn): `order-files/<id đơn>/…`, `design-assets/<user_id>/…` (Thiết kế của tôi), `mockup-shares/<id link>/…`.

Trình duyệt xin link tải lên ở `/api/storage/upload-url` rồi PUT thẳng lên R2 (hạn 10 phút). File riêng tư đọc qua `/api/storage/read-url` (hạn 1 giờ; link chia sẻ mockup: bằng thời gian còn lại).

## 3. CORS cho cả 2 bucket (R2 → bucket → Settings → CORS policy)

```json
[
  {
    "AllowedOrigins": ["https://taylana-print.vercel.app", "http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["content-type", "cache-control"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 86400
  }
]
```

Bucket public: bật **Public access** (r2.dev hoặc Custom Domain) và dán link đó vào `NEXT_PUBLIC_R2_PUBLIC_URL`.

## 4. Database

Chạy `supabase/migration_r2_storage.sql` trong Supabase → SQL Editor (để gửi file kèm đơn hoạt động với R2).

## 5. Chép dữ liệu cũ sang R2

1. Tạo file `.env.local` ở thư mục gốc dự án (không commit) với: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `NEXT_PUBLIC_R2_PUBLIC_URL`.
2. `npm install`
3. Chạy thử (không chép, không sửa gì): `node scripts/migrate-storage-to-r2.mjs --dry-run`
4. Chạy thật: `node scripts/migrate-storage-to-r2.mjs`
   - Chỉ chép file, chưa đổi link: thêm `--files-only`.
   - Mỗi lần chạy ghi log ra file `migrate-r2-<thời gian>.log`.
   - Chạy lại không bị trùng: file đã có trên R2 (cùng dung lượng) và link đã đổi sẽ bỏ qua. Có lỗi thì chạy lại.

Script chép mọi file của các bucket `scrapbook, mockups, public-assets, order-files, design-assets, mockup-shares` sang đúng bucket R2 (giữ nguyên khoá), rồi đổi link ảnh công khai trong database `…supabase.co/storage/v1/object/public/<khoá>` → `<NEXT_PUBLIC_R2_PUBLIC_URL>/<khoá>`. File riêng tư giữ nguyên đường dẫn trong database. **Không xoá file nào trên Supabase Storage** — tự xoá sau khi kiểm tra.

## 6. Quay lại Supabase Storage

Đặt `STORAGE_PROVIDER=supabase` trên Vercel → Redeploy. File mới lại lưu ở Supabase Storage (cần `SUPABASE_SERVICE_ROLE_KEY`). Link ảnh đã đổi sang R2 vẫn hiển thị bình thường miễn bucket R2 còn đó. Muốn đổi link về Supabase: chạy SQL thay `<NEXT_PUBLIC_R2_PUBLIC_URL>/` bằng `<SUPABASE_URL>/storage/v1/object/public/` trong các cột ảnh.
