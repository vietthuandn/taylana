// Dàn trang booklet đóng gáy giữa (saddle stitch).
// Với i = 0 … n/2 − 1:  i chẵn → trái = n − i, phải = i + 1 (Mặt trước) · i lẻ → trái = i + 1, phải = n − i (Mặt sau)
// Tờ = floor(i / 2) + 1. Ví dụ 8 trang: (8–1), (2–7), (6–3), (4–5).
export type ImposedSide = { index: number; sheet: number; side: "Truoc" | "Sau"; left: number; right: number };

export function impose(n: number): ImposedSide[] {
  if (n < 4 || n % 4 !== 0) throw new Error("Số trang booklet phải là bội số của 4");
  return Array.from({ length: n / 2 }, (_, i) => ({
    index: i,
    sheet: Math.floor(i / 2) + 1,
    side: i % 2 === 0 ? "Truoc" : "Sau",
    left: i % 2 === 0 ? n - i : i + 1,
    right: i % 2 === 0 ? i + 1 : n - i,
  }));
}

const pad = (x: number) => String(x).padStart(2, "0");
// Tên file theo đúng THỨ TỰ IN (số 0 ở đầu để sắp đúng): "01_To1-MatTruoc_trang-08-01.jpg", "02_To1-MatSau_trang-02-07.jpg"…
// Thứ tự in: Tờ 1 mặt trước → Tờ 1 mặt sau → Tờ 2 mặt trước → … (impose() đã trả đúng thứ tự này)
export const sideFileName = (s: ImposedSide) => `${pad(s.index + 1)}_To${s.sheet}-${s.side === "Truoc" ? "MatTruoc" : "MatSau"}_trang-${pad(s.left)}-${pad(s.right)}.jpg`;
export const impositionZipName = (n: number) => `Taylana-Booklet-${n}-trang-dan-trang.zip`;
/** HUONG-DAN-IN.txt: thứ tự in, tờ nào mặt nào, nhắc in 2 mặt lật theo cạnh dài */
export function printGuide(n: number) {
  const sides = impose(n);
  return [
    `HƯỚNG DẪN IN BOOKLET ${n} TRANG (${n / 4} tờ, mỗi tờ 24 × 12 cm, in 2 mặt)`,
    "",
    "In lần lượt theo số thứ tự ở đầu tên file:",
    ...sides.map((s) => `  ${sideFileName(s)}  →  Tờ ${s.sheet}, ${s.side === "Truoc" ? "mặt trước" : "mặt sau"} (trang ${s.left} | trang ${s.right})`),
    "",
    "Lưu ý:",
    "  - In 2 mặt, LẬT THEO CẠNH DÀI (long edge) để mặt sau không bị ngược.",
    "  - Mỗi tờ: in mặt trước trước, rồi mặt sau ngay sau đó.",
    "  - Xếp các tờ chồng theo thứ tự Tờ 1 ngoài cùng, gấp đôi ở giữa và đóng gáy.",
    "",
  ].join("\r\n");
}
export const sideLabel = (s: ImposedSide) => `Tờ ${s.sheet} · ${s.side === "Truoc" ? "Mặt trước" : "Mặt sau"}: ${s.left} – ${s.right}`;
