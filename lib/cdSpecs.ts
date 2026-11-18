// =====================================================================
// SỐ ĐO KHỔ IN CD (đơn vị cm) — sửa ở đây để đổi toàn bộ guideline
// =====================================================================

// Bìa sau (khay đĩa)
export const BACK_W_CM = 15;
export const BACK_H_CM = 11.7;

// Dải gáy ở mép trái & mép phải bìa sau (dùng cho cả Mặt Ngoài và Mặt Trong)
export const BACK_SPINE_CM = 0.6;

// Vùng Spine ở Bìa Sau - Mặt Trong (tính từ mép trái)
export const INNER_SPINE_FROM_CM = 0.6;
export const INNER_SPINE_TO_CM = 1.7;

// Vòng ướm khay đĩa (Bìa Sau - Mặt Trong)
export const TRAY_DISC_DIAMETER_CM = 12;
export const TRAY_DISC_HOLE_CM = 1.5;

// Góc xoay chữ của từng dải (độ). -90 = ngược chiều kim đồng hồ (đọc từ dưới lên), 90 = cùng chiều (đọc từ trên xuống).
// Áp dụng giống nhau cho canvas, chế độ sửa và file xuất.
export const LEFT_SPINE_ROTATION = -90; // gáy trái
export const INNER_SPINE_ROTATION = -90; // Spine (Bìa Sau - Mặt Trong)
export const RIGHT_SPINE_ROTATION = -90; // gáy phải

// ---------------------------------------------------------------------
// MÔ HÌNH 3D HỘP CD (đơn vị mm) — trang Xem Mockup, thẻ "3D"
// ---------------------------------------------------------------------
export const CASE_W_MM = 142; // hộp jewel case: rộng (bản lề ở cạnh trái)
export const CASE_H_MM = 125; // cao (chiều trên ↔ dưới của bìa trước)
export const CASE_T_MM = 10.4; // dày
export const COVER3D_MM = 120; // bìa trước 120 × 120
export const TRAY_W_MM = 150; // bìa sau (tray card) 150 × 117
export const TRAY_H_MM = 117;
export const TRAY_FLOOR_MM = 138; // phần giữa = mặt đáy
export const TRAY_SPINE_MM = 6; // 2 dải gáy gập lên 2 cạnh bên
export const DISC3D_D_MM = 120; // đĩa: đường kính
export const DISC3D_T_MM = 1.2; // dày
export const DISC3D_HOLE_MM = 15; // lỗ giữa
