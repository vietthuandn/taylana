// Các công cụ "Thiết Kế" — hiện dạng lưới thẻ ở trang /thiet-ke. Thêm Photostrip, Photocard: chỉ cần thêm 1 dòng.
//   image: ảnh minh hoạ (link ảnh, không bắt buộc — để trống thì dùng hình đĩa CD)
export type ToolLink = { href: string; title: string; label: string; desc: string; kind: string; image?: string };

export const designTools: ToolLink[] = [
  { href: "/thiet-ke/cd", label: "CD", title: "Thiết kế CD", desc: "Tự thiết kế bìa trước, bìa sau, booklet và mặt đĩa.", kind: "cd" },
  { href: "/thiet-ke/scrapbook", label: "Scrapbook", title: "CD Scrapbook", desc: "Tải 5–10 ảnh, web tự làm mặt đĩa kiểu scrapbook xé dán.", kind: "cd-scrapbook" },
  { href: "/thiet-ke/booklet-lyrics", label: "Lyrics", title: "Booklet Lyrics", desc: "Nhập lyrics từng bài, web tự dàn booklet 3 cột + bìa sau có tracklist.", kind: "cd-lyrics" },
  { href: "/thiet-ke/mockup", label: "Mockup", title: "Xem Mockup CD", desc: "Xem ảnh của bạn trên hộp CD, mặt đĩa và cuốn booklet.", kind: "cd-mockup" },
];
