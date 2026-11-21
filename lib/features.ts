// Bật / tắt tính năng phía khách. Đổi thành true để mở lại.
// Photostrip: tắt thì ẩn khỏi menu, footer, trang chủ, phụ kiện; /photostrip chuyển về trang chủ.
// Admin vẫn giữ mục "Khung Photostrip" và toàn bộ dữ liệu.
export const FEATURE_PHOTOSTRIP = false;
// Modal cũ "Tải sticker của bạn" (xoá nền 1 ảnh) — thay bằng bộ tách tờ sticker (giống Admin). Đổi true để dùng lại.
export const FEATURE_OLD_STICKER_UPLOAD = false;

// Phụ kiện liên quan photostrip (ẩn khi tắt tính năng)
export const isPhotostripItem = (name: string) => /photo\s*-?\s*strip/i.test(name);

// Đánh giá phía khách: tạm ẩn. Admin vẫn giữ mục Đánh giá và dữ liệu. Đổi thành true để mở lại.
export const FEATURE_REVIEWS = false;

// Mẫu khung mockup do admin tạo (ảnh khung PNG + vùng chọn) ở trang Xem Mockup: TẠM ẨN.
// Trang Xem Mockup chỉ dùng mẫu hệ thống (Lưới · Chồng · Một) + 3D. Admin ẩn mục "Khung CD". Đổi thành true để mở lại.
export const FEATURE_MOCKUP_FRAMES = false;

// Booklet Lyrics: "Tìm lời gợi ý" (API công khai LRCLIB, gọi thẳng từ trình duyệt). Đổi thành false để ẩn mọi nút / tuỳ chọn liên quan.
export const FEATURE_LYRICS_SUGGEST = true;

// Gửi file in (trang /gui-file, nút "Gửi file in", badge "Đã / Chưa gửi file"): TẠM ẨN — thay bằng "Lên mockup" (/thiet-ke/mockup).
// Code Gửi file vẫn giữ (CdUploadPanel dùng chung cho trang Mockup). Admin vẫn xem file của đơn cũ. Đổi thành true để mở lại.
export const FEATURE_UPLOAD_FILES = false;
