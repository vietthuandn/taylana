import type { CanvaKind } from "@/lib/canva";

/** Khung mô phỏng đúng tỉ lệ khi template chưa có ảnh xem trước: vuông · chữ nhật ngang · tròn có lỗ */
export function CanvaShape({ kind, size }: { kind: CanvaKind; size: string }) {
  const label = <span className="px-2 text-center text-[12px] font-medium text-[#71717a]">{size}</span>;
  if (kind === "cd") return <div className="relative grid aspect-square h-[78%] place-items-center rounded-full bg-[#e4e4e7] shadow-[0_6px_18px_rgba(0,0,0,0.12)]"><span className="absolute h-[16%] w-[16%] rounded-full bg-[#f7f7f8] ring-4 ring-[#d4d4d8]" /><span className="absolute bottom-[22%]">{label}</span></div>;
  if (kind === "back") return <div className="grid aspect-[150/117] w-[82%] max-h-[78%] place-items-center rounded-[4px] bg-[#e4e4e7] shadow-[0_6px_18px_rgba(0,0,0,0.12)]">{label}</div>;
  return <div className="grid aspect-square h-[78%] place-items-center rounded-[4px] bg-[#e4e4e7] shadow-[0_6px_18px_rgba(0,0,0,0.12)]">{label}</div>;
}
