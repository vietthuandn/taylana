# Mẫu trang chủ (home variants)

Trang chủ `/` hiện mẫu đang dùng (`site_settings.active_home_variant`). Admin đổi mẫu ở **Admin → Giao diện trang chủ**,
hoặc bằng nút "Mẫu: … ▾" trên trang chủ khi đang đăng nhập admin. Xem trước: `/?preview=<id>` (chỉ admin thấy).

## Thêm 1 mẫu mới

1. Tạo thư mục `components/home/variants/<id>/` với file `index.tsx` export default 1 hàm:

   ```tsx
   import type { HomeVariantProps } from "@/lib/homeData";
   export default function HomeVx({ home, options, settings }: HomeVariantProps) { return <div>…</div>; }
   ```

   - `home`, `options`: dữ liệu CHUNG lấy bằng `getHomeData()` (lib/homeData.ts) — banner + 6 ô ở Admin → Trang chủ.
   - `settings`: dữ liệu riêng của mẫu, lưu ở `site_settings.variant_settings["<id>"]` (JSON, không bắt buộc).
   - Hàm phải là server component đồng bộ (không dùng hook). Cần tương tác thì tách 1 client component con trong cùng thư mục.
2. Đăng ký 1 dòng trong `lib/homeVariants.ts`: `{ id, name, description, createdAt, component }`.
3. KHÔNG import hay sửa mẫu khác. Mỗi mẫu tự chứa giao diện của mình.

Mẫu đang chọn không tồn tại hoặc bị lỗi khi dựng → tự dùng `v1-hien-tai`.
