// =====================================================================
// ĐỌC TÊN FILE → TỰ XẾP ẢNH VÀO ĐÚNG Ô (trang Gửi file in)
// Sửa quy tắc ở đây. Kiểm tra theo THỨ TỰ ƯU TIÊN, gặp quy tắc nào đúng trước thì dùng quy tắc đó.
// Mã ô: "f1".."f12" (Bìa trước / booklet), "b1" (Bìa sau - Mặt Ngoài), "b2" (Bìa sau - Mặt Trong), "d" (Mặt đĩa)
// =====================================================================

export type PackLayout = { front: number; back: number; disc: boolean };

// chữ thường, bỏ đuôi file, bỏ dấu tiếng Việt (đ → d) → so khớp được cả bản có dấu lẫn không dấu
export function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

export function matchFileName(fileName: string, pack: PackLayout): string | null {
  const n = normalizeName(fileName);
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  const word = (w: string) => words.includes(w); // từ đứng riêng
  const has = (w: string) => n.includes(w); // có chứa
  const exists = (slot: string) => {
    if (slot === "d") return pack.disc;
    if (slot === "b1") return pack.back >= 1;
    if (slot === "b2") return pack.back >= 2;
    const k = Number(slot.slice(1));
    return k >= 1 && k <= pack.front;
  };
  const pick = (slot: string) => (exists(slot) ? slot : null);

  // 1. Mặt đĩa
  if (word("cd") || word("dia") || word("disc") || has("disc")) return pick("d");
  // 2. Bìa sau - Mặt Trong
  if ((has("sau") && has("trong")) || (has("back") && has("trong")) || (has("back") && has("inside"))) return pick("b2");
  // 3. Bìa sau - Mặt Ngoài
  if ((has("sau") && has("ngoai")) || (has("back") && has("ngoai")) || (has("back") && has("outside")) || has("sau") || has("back")) return pick("b1");
  // 4. Bìa trước - Mặt Trong (chỉ gói 2 trang)
  if (pack.front === 2 && ((has("truoc") && has("trong")) || (has("front") && has("trong")) || (has("front") && has("inside")))) return pick("f2");
  // 5. Booklet (4, 8, 12 trang): số N đứng riêng ("2", "trang 2", "page-02")
  if (pack.front >= 4) {
    const m = /(?<![a-z0-9])0*(\d{1,3})(?![a-z0-9])/.exec(n);
    if (m) {
      const k = Number(m[1]);
      return k >= 1 && k <= pack.front ? `f${k}` : null;
    }
  }
  // 6. Bìa trước - Mặt Ngoài (hoặc trang 1 của booklet)
  if ((has("truoc") && has("ngoai")) || (has("front") && has("ngoai")) || (has("front") && has("outside")) ||
      has("truoc") || has("front") || has("bia") || /(?<![a-z0-9])0*1(?![a-z0-9])/.test(n)) return pick("f1");
  return null;
}
