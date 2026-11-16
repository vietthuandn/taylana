import { Sparkle } from "./Shapes";

const eyebrowTone = { lime: "bg-lime-500 text-ink-900", violet: "bg-violet-500 text-white", hot: "bg-hot-500 text-white", ink: "bg-ink-900 text-white" };

// Tiêu đề khối: nhãn nhỏ + tiêu đề IN HOA cỡ lớn + mô tả
export function SectionTitle({ eyebrow, title, subtitle, align = "left", tone = "violet", as: Tag = "h2", size = "lg", className = "" }: {
  eyebrow?: string; title: string; subtitle?: string; align?: "left" | "center";
  tone?: keyof typeof eyebrowTone; as?: "h1" | "h2"; size?: "lg" | "xl"; className?: string;
}) {
  const sizes = size === "xl" ? "text-5xl sm:text-6xl lg:text-[80px]" : "text-4xl sm:text-5xl lg:text-[56px]";
  return (
    <div className={`${align === "center" ? "text-center" : ""} ${className}`}>
      {eyebrow && <span className={`eyebrow mb-3 ${eyebrowTone[tone]}`}>{eyebrow}</span>}
      <Tag className={`relative ${align === "center" ? "mx-auto" : ""} max-w-4xl ${sizes}`}>
        {title}
        <Sparkle className="ml-2 inline-block h-[0.45em] w-[0.45em] -translate-y-[0.6em] animate-twinkle" />
      </Tag>
      {subtitle && <p className={`mt-3 max-w-2xl text-ink-600 ${align === "center" ? "mx-auto" : ""}`}>{subtitle}</p>}
    </div>
  );
}

// Tiêu đề trang (dùng ở đầu các trang con)
export function PageHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 pt-8 sm:pt-12">
      <SectionTitle as="h1" size="xl" eyebrow={eyebrow} title={title} subtitle={subtitle} tone="lime" />
    </div>
  );
}
