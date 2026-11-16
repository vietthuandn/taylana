// Thẻ trắng bo 20px. tone="lime" (viền xanh chanh) hoặc "ink" (viền đen mảnh).
export function Card({ tone = "lime", className = "", children, as: Tag = "div" }: {
  tone?: "lime" | "ink"; className?: string; children: React.ReactNode; as?: "div" | "section" | "li" | "article";
}) {
  return <Tag className={`${tone === "lime" ? "card" : "panel"} ${className}`}>{children}</Tag>;
}
