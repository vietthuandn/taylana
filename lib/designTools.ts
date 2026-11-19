// Các công cụ "Thiết Kế" — hiện dạng lưới thẻ ở trang /thiet-ke. Thêm Photostrip, Photocard: chỉ cần thêm 1 dòng.
//   image: ảnh minh hoạ (link ảnh, không bắt buộc — để trống thì dùng hình đĩa CD)
export type ToolLink = { href: string; title: string; label: string; desc: string; kind: string; image?: string };

export const designTools: ToolLink[] = [
  { href: "/thiet-ke/cd", label: "CD", title: "Thiết kế CD", desc: "Tự thiết kế bìa trước, bìa sau, booklet và mặt đĩa.", kind: "cd" },
  { href: "/thiet-ke/cd-template", label: "CD", title: "CD Template", desc: "Chọn mẫu mặt đĩa có sẵn, tải ảnh vào là xong.", kind: "cd-scrapbook" },
  { href: "/thiet-ke/booklet", label: "Booklet", title: "Booklet Template", desc: "Chọn mẫu từng trang hoặc cả bộ booklet 2–12 trang, tải ảnh vào là xong.", kind: "booklet-scrapbook" },
  { href: "/thiet-ke/booklet-lyrics", label: "Lyrics", title: "Booklet Lyrics", desc: "Nhập lyrics từng bài, web tự dàn booklet 3 cột + bìa sau có tracklist.", kind: "cd-lyrics" },
  { href: "/thiet-ke?canva=1", label: "Canva", title: "Thiết kế từ Canva Template", desc: "Dùng mẫu Canva có sẵn đúng khổ in", kind: "canva" }, // mở modal ngay trên /thiet-ke
  { href: "/thiet-ke/mockup", label: "Mockup", title: "Xem Mockup CD", desc: "Xem ảnh của bạn trên hộp CD, mặt đĩa và cuốn booklet.", kind: "cd-mockup" },
];
