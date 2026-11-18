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
// "To-01-Truoc_04-01.jpg"
export const sideFileName = (s: ImposedSide) => `To-${pad(s.sheet)}-${s.side}_${pad(s.left)}-${pad(s.right)}.jpg`;
export const sideLabel = (s: ImposedSide) => `Tờ ${s.sheet} · ${s.side === "Truoc" ? "Mặt trước" : "Mặt sau"}: ${s.left} – ${s.right}`;
