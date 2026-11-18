/* Cấu hình nhận diện ký tự font cut-out (admin). */
export const OCR_CONFIG = {
  weights: { tesseract: 0.3, template: 0.25, learned: 0.45 }, // điểm cuối = w1·tesseract + w2·font mẫu + w3·học
  minSamples: 3, // ký tự có ít hơn số mẫu học này → giảm trọng số "học" tương ứng
  k: 5, // k láng giềng gần nhất
  reviewBelow: 0.7, // dưới ngưỡng này → "Cần kiểm tra"
  angles: [0, 8, -8, 15, -15], // thử xoay để chỉnh nghiêng
};
// cặp chữ hoa / thường dễ nhầm (phân biệt bằng chiều cao so với các mảnh khác cùng tờ)
export const CASE_PAIRS = "cosuvwxzkp".split("");
// 8 font mẫu (Google Fonts qua @fontsource): serif, sans, đậm, mảnh, kiểu báo cũ
export const TEMPLATE_FONTS = [
  "400 100px Inter", "800 100px Inter", "700 100px \"Be Vietnam Pro\"", "500 100px Oswald", "400 100px Anton",
  "400 100px Lora", "700 100px \"Playfair Display\"", "700 100px \"Roboto Slab\"",
];
