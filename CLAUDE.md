# Ghi chú cho AI làm việc trên repo này

## Tính năng đang TẠM ẨN — KHÔNG đọc, KHÔNG sửa, KHÔNG quét khi làm việc khác

**Mẫu khung mockup do admin tạo** (ảnh khung PNG + kéo 4 góc vùng chọn) ở trang Xem Mockup — tắt bằng
`FEATURE_MOCKUP_FRAMES = false` trong `lib/features.ts`. Trang Xem Mockup hiện chỉ dùng **mẫu hệ thống**
(Lưới · Chồng · Một — `lib/mockup/system/`) và **3D** (`components/mockup-viewer/Cd3D.tsx`).

Bỏ qua các file sau trừ khi người dùng yêu cầu mở lại tính năng này:
- `app/admin/(panel)/mockup/[id]/` (trình tạo mẫu khung: `FrameEditor.tsx`, …)
- `lib/mockup/render.ts`, `lib/mockup/warp.ts`, `lib/mockup/homography.ts` (dựng ảnh từ mẫu khung)
- Phần "Khung CD" trong `app/admin/(panel)/mockup/MockupAdmin.tsx` (đã ẩn sau cờ)

Muốn mở lại: đổi `FEATURE_MOCKUP_FRAMES` thành `true`.
