// Bật / tắt tính năng phía khách. Đổi thành true để mở lại.
// Photostrip: tắt thì ẩn khỏi menu, footer, trang chủ, phụ kiện; /photostrip chuyển về trang chủ.
// Admin vẫn giữ mục "Khung Photostrip" và toàn bộ dữ liệu.
export const FEATURE_PHOTOSTRIP = false;

// Phụ kiện liên quan photostrip (ẩn khi tắt tính năng)
export const isPhotostripItem = (name: string) => /photo\s*-?\s*strip/i.test(name);
