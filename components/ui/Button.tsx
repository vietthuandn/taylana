import Link from "next/link";

type Variant = "primary" | "ghost" | "lime";
const cls = (variant: Variant, size?: "sm") =>
  ["btn", variant === "ghost" ? "btn-ghost" : variant === "lime" ? "btn-lime" : "", size === "sm" ? "btn-sm" : ""].join(" ");

// Nút dạng viên thuốc. Có href → thành link.
export function Button({ href, variant = "primary", size, className = "", children, ...rest }: {
  href?: string; variant?: Variant; size?: "sm"; className?: string; children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const c = `${cls(variant, size)} ${className}`;
  if (href) return <Link href={href} className={c}>{children}</Link>;
  return <button className={c} {...rest}>{children}</button>;
}

// Nút "+" tròn
export function PlusButton({ href, label, className = "" }: { href: string; label: string; className?: string }) {
  return (
    <Link href={href} aria-label={label}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink-900 text-2xl leading-none text-white transition hover:bg-lime-500 hover:text-ink-900 ${className}`}>
      +
    </Link>
  );
}
