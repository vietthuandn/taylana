/* Cấu hình chung của bộ máy scrapbook (CD Template + Booklet Template) */
export const SCRAP_CONFIG = {
  stickerScale: 1.3, // sticker do mẫu tự rải: to hơn ~30% so với cỡ cũ
  gridMM: 2, // lưới chiếm chỗ: mỗi ô 2 mm
  overlapShare: 0.4, // ~40% sticker đặt đè lên mép / góc ảnh (băng dính chéo góc, sticker vắt qua mép khung)
  maxPhotoCover: 0.15, // sticker đè ảnh che tối đa 15% diện tích ảnh
  maxStickerOverlap: 0.2, // 2 sticker chồng nhau tối đa 20%
  minStickerMM: 4, // vùng trống nhỏ hơn thì thôi không rải thêm
  frameRatio: 0.6, // tỉ lệ ô ảnh có khung (lấy ngẫu nhiên từ các bộ khung đang bật)
  addStep: 6, // thêm nhiều sticker liên tiếp: mỗi cái lệch 6 mm
};
