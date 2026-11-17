// Lớp CSS dùng chung cho Admin (file thường: dùng được ở cả server và client component)
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
const btnBase = "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] px-3.5 text-[14px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#ff5fa2]/25";
const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-[#ff5fa2] text-white shadow-[0_1px_2px_rgb(0_0_0/0.06)] hover:bg-[#f0468f]",
  secondary: "border border-[#e5e5e7] bg-white text-[#18181b] shadow-[0_1px_2px_rgb(0_0_0/0.04)] hover:bg-[#f4f4f5]",
  ghost: "text-[#3f3f46] hover:bg-[#f4f4f5] hover:text-[#18181b]",
  danger: "border border-[#e5e5e7] bg-white text-[#dc2626] hover:bg-[#fef2f2]",
};
export const btnClass = (variant: BtnVariant = "primary", size: "md" | "sm" = "md") =>
  cx(btnBase, btnVariants[variant], size === "sm" && "h-8 px-3 text-[13px]");


// ---------- Input / Select / Textarea ----------
export const inputClass = "block h-9 w-full rounded-[8px] border border-[#e5e5e7] bg-white px-3 text-[14px] text-[#18181b] placeholder:text-[#a1a1aa] transition-[border-color,box-shadow] focus:border-[#ff5fa2] focus:outline-none focus:ring-[3px] focus:ring-[#ff5fa2]/15 disabled:bg-[#f4f4f5]";
