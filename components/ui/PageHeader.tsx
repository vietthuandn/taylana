/* Tiêu đề trang dùng chung (phía khách): tiêu đề KHÔNG hiển thị nữa (đỡ diện tích, chỉ giữ cho trình đọc màn hình).
   Có nút thao tác (actions) thì hiện 1 hàng căn phải; không có thì chỉ chừa khoảng cách nhỏ dưới header. */
export function PageHeader({ title, actions, className = "", inset = true }: {
  title: string; actions?: React.ReactNode; className?: string;
  /** true = tự đặt trong khung container chuẩn; false = dùng trong layout có sẵn */
  inset?: boolean;
  /** không còn hiển thị — giữ để tương thích */
  eyebrow?: string;
}) {
  return (
    <div className={`${inset ? "mx-auto w-full max-w-[1200px] px-4 lg:px-6" : ""} ${actions ? "pb-3 pt-4" : "pt-4"} ${className}`}>
      <h1 className="sr-only">{title}</h1>
      {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
    </div>
  );
}
