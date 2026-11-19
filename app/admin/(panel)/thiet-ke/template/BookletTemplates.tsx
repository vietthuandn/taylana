"use client";
/* Quản lý template → Booklet Template: 3 tab con — Trang đơn (12 × 12 cm) · Trang đôi (24 × 12 cm, gáy giữa) · Trình tạo template
   (bộ booklet hoàn chỉnh). Nút "Tách mẫu cũ" (ở 2 tab mẫu): tách các bộ booklet tự sinh trước đây thành mẫu Trang đơn / Trang đôi. */
import { useState } from "react";
import Link from "next/link";
import { Scissors } from "lucide-react";
import { Button, toast } from "@/components/admin/ui";
import { confirmDialog } from "@/components/ui/dialog";
import { revalidatePublic } from "@/app/admin/actions";
import { cx } from "@/components/admin/styles";
import { LibraryAdmin, PUBLIC_PATHS } from "./LibraryAdmin";
import { BundleAdmin } from "./BundleAdmin";
import { convertLegacyBooklet } from "./convert";

const SUBS = [["single", "Trang đơn"], ["spread", "Trang đôi"], ["bundle", "Trình tạo template"]] as const;

export function BookletTemplates({ sub }: { sub: string }) {
  const [busy, setBusy] = useState("");
  const [key, setKey] = useState(0);
  const cur = SUBS.some(([k]) => k === sub) ? sub : "single";
  const split = (reload: () => void) => (
    <Button variant="secondary" icon={<Scissors size={16} />} loading={!!busy} onClick={async () => {
      if (!(await confirmDialog({ title: "Tách mẫu cũ?", message: "Dựng lại các bộ mẫu booklet cũ (4 / 8 / 12 trang × 5 phong cách, ưu tiên bản đã sửa): trang bìa và trang cuối → mẫu Trang đơn, từng cặp trang → mẫu Trang đôi (bỏ trùng), lưu vào danh mục “Cơ bản”. Mẫu đã tách trước đó sẽ bỏ qua.", confirmText: "Tách ngay" }))) return;
      setBusy("…");
      try {
        const r = await convertLegacyBooklet((d, t) => setBusy(`${d}/${t}`));
        toast(`Đã tách ${r.added} mẫu mới${r.skipped ? ` · bỏ qua ${r.skipped} mẫu đã có` : ""}`);
        await revalidatePublic(PUBLIC_PATHS); reload(); setKey((k) => k + 1);
      } catch (e) { toast(e instanceof Error ? e.message : "Tách mẫu thất bại", "err"); }
      setBusy("");
    }}>{busy ? `Đang tách ${busy}` : "Tách mẫu cũ"}</Button>
  );
  return (
    <div className="space-y-4">
      <nav className="flex gap-1 border-b border-[#e5e5e7]">
        {SUBS.map(([k, l]) => (
          <Link key={k} href={`/admin/thiet-ke/template/booklet-template?sub=${k}`} className={cx("-mb-px border-b-2 px-3 py-2 text-[14px] font-medium", cur === k ? "border-[#ff5fa2] text-[#ff5fa2]" : "border-transparent text-[#52525b] hover:text-[#18181b]")}>{l}</Link>
        ))}
      </nav>
      {cur === "single" && <LibraryAdmin key="s" kind="booklet_single" extra={split} reloadKey={key} />}
      {cur === "spread" && <LibraryAdmin key="d" kind="booklet_spread" extra={split} reloadKey={key} />}
      {cur === "bundle" && <BundleAdmin />}
    </div>
  );
}
