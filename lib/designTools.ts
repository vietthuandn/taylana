// Các công cụ "Thiết Kế" (menu thả xuống trên header). Thêm Photostrip, Photocard: chỉ cần thêm 1 dòng.
export type ToolLink = { href: string; title: string; kind: string };

export const designTools: ToolLink[] = [
  { href: "/thiet-ke/cd", title: "Thiết kế CD", kind: "cd" },
];
