/* Viền ren lượn sóng. color = màu của dải ren, hole = màu lỗ ren (thường là màu nền). */
export function Scallop({
  color = "var(--color-pink-200)",
  hole = "var(--color-cream-100)",
  up = false,
  className = "",
}: {
  color?: string;
  hole?: string;
  up?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`scallop ${up ? "scallop-up" : ""} ${className}`}
      style={{ ["--scallop-color" as string]: color, ["--scallop-hole" as string]: hole }}
    />
  );
}
