// Các trang "Gửi file" — hiện dạng lưới thẻ ở trang /gui-file. Thêm loại sản phẩm mới: chỉ cần thêm 1 dòng.
import type { ToolLink } from "./designTools";

export const uploadTools: ToolLink[] = [
  { href: "/gui-file/cd", label: "CD", title: "Gửi file CD", desc: "Gửi ảnh bìa, booklet, mặt đĩa và link nhạc.", kind: "cd" },
];

// Trang gửi file theo loại sản phẩm của đơn (hiện chỉ có CD) — link có mã đơn đi thẳng, bỏ qua trang chọn
export function uploadHref(code?: string, kind = "cd") {
  const base = (uploadTools.find((t) => t.kind === kind) ?? uploadTools[0]).href;
  return code ? `${base}?don=${encodeURIComponent(code)}` : base;
}
