/* Tiêu đề trang dùng chung (phía khách): Inter đậm 700, 28px máy tính / 22px điện thoại,
   viết hoa bình thường, kèm 1 dòng mô tả 15px màu xám. Nút hành động tuỳ chọn bên phải. */
export function PageHeader({ title, subtitle, actions, className = "", inset = true }: {
  title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string;
  /** true = tự căn giữa trong khung max-w-6xl có padding; false = dùng trong layout có sẵn */
  inset?: boolean;
  /** không còn hiển thị — giữ để tương thích */
  eyebrow?: string;
}) {
  return (
    <div className={`${inset ? "mx-auto max-w-6xl px-4 pb-5 pt-6 sm:pb-6 sm:pt-8" : ""} ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-sans text-[22px] font-bold normal-case leading-tight tracking-[-0.02em] text-ink-900 sm:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-[15px] text-ink-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
