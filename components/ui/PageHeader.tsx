/* Tiêu đề trang dùng chung (phía khách): Inter đậm 700, 28px máy tính / 22px điện thoại, CĂN TRÁI thẳng mép trái container nội dung
   (max-w-[1200px], px-4 / lg:px-6 — giống nội dung các trang). Không có dòng mô tả. Cách header 24px, cách nội dung 16px. */
export function PageHeader({ title, actions, className = "", inset = true }: {
  title: string; actions?: React.ReactNode; className?: string;
  /** true = tự đặt trong khung container chuẩn; false = dùng trong layout có sẵn */
  inset?: boolean;
  /** không còn hiển thị — giữ để tương thích */
  eyebrow?: string;
}) {
  return (
    <div className={`${inset ? "mx-auto w-full max-w-[1200px] px-4 pb-4 pt-6 lg:px-6" : "pb-4"} ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="min-w-0 text-left font-sans text-[22px] font-bold normal-case leading-tight tracking-[-0.02em] text-ink-900 sm:text-[28px]">{title}</h1>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
