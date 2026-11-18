// Các ô ảnh CD theo gói (Bìa trước / booklet, Bìa sau, Mặt đĩa) — dùng chung cho Gửi file CD và Xem Mockup.
import { SPECS, type PrintSpec } from "@/lib/print";
import { checkImage, validateFile, type CheckResult } from "@/lib/imageCheck";
import type { PackLayout } from "@/lib/matchFileName";
import type { Package } from "@/lib/types";

export const PINK = "#ff5fa2";
export const ACCEPT = "image/jpeg,image/png,application/pdf";

export type SlotDef = { id: string; group: "front" | "back" | "disc"; label: string; full: string; spec: PrintSpec; kind: string; page: number | null };
export type Picked = { file: File; preview: string | null; check?: CheckResult; error?: string };

// Bố cục theo gói (dùng chung preset với Custom CD)
export function layoutOf(pk: Package): PackLayout {
  if (pk.front_pages == null && pk.back_pages == null) return { front: 1, back: 1, disc: pk.has_disc !== false };
  return { front: pk.front_pages ?? 0, back: pk.back_pages ?? 0, disc: pk.has_disc !== false };
}
export const describePkg = (pk: Package) => describeLayout(layoutOf(pk));
export const describeLayout = (l: PackLayout) => {
  return [
    l.front ? (l.front >= 4 ? `Booklet ${l.front} trang` : `Bìa trước ${l.front} mặt`) : "",
    l.back ? `Bìa sau ${l.back} mặt` : "",
    l.disc ? "Mặt đĩa" : "",
  ].filter(Boolean).join(" · ");
};
export function slotsOf(l: PackLayout): SlotDef[] {
  const out: SlotDef[] = [];
  const booklet = l.front >= 4;
  for (let i = 1; i <= l.front; i++) {
    const label = booklet ? String(i) : i === 1 ? "Mặt Ngoài" : "Mặt Trong";
    out.push({ id: `f${i}`, group: "front", label, full: `Bìa trước - ${booklet ? `Trang ${i}` : label}`,
      spec: booklet ? SPECS.booklet : SPECS.front, kind: booklet ? "booklet" : "front", page: l.front > 1 ? i : null });
  }
  for (let i = 1; i <= l.back; i++) {
    const label = i === 1 ? "Mặt Ngoài" : "Mặt Trong";
    out.push({ id: `b${i}`, group: "back", label, full: `Bìa sau - ${label}`, spec: SPECS.back, kind: "back", page: l.back > 1 ? i : null });
  }
  if (l.disc) out.push({ id: "d", group: "disc", label: "Mặt đĩa", full: "Mặt đĩa", spec: SPECS.disc, kind: "disc", page: null });
  return out;
}

export async function readPicked(file: File, spec: PrintSpec): Promise<Picked> {
  const invalid = validateFile(file);
  if (invalid) return { file, preview: null, error: invalid };
  const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
  try {
    return { file, preview, check: await checkImage(file, spec) };
  } catch {
    return { file, preview, error: "Không đọc được ảnh, file có thể bị lỗi." };
  }
}

