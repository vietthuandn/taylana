"use client";
/* Quản lý template → Booklet Template: 3 tab con — Trang đơn (12 × 12 cm) · Trang đôi (24 × 12 cm, gáy giữa) · Trình tạo template
   (bộ booklet hoàn chỉnh). (Nút "Tách mẫu cũ" đã bỏ; code tách vẫn giữ ở ./convert.ts.) */
import { ResponsiveTabs } from "@/components/ui/ResponsiveTabs";
import { LibraryAdmin } from "./LibraryAdmin";
import { BundleAdmin } from "./BundleAdmin";

const SUBS = [["single", "Trang đơn"], ["spread", "Trang đôi"], ["bundle", "Trình tạo template"]] as const;

export function BookletTemplates({ sub }: { sub: string }) {
  const cur = SUBS.some(([k]) => k === sub) ? sub : "single";
  return (
    <div className="space-y-4">
      <ResponsiveTabs size="sm" value={cur} tabs={SUBS.map(([k, l]) => ({ id: k, label: l, href: `/admin/thiet-ke/template/booklet-template?sub=${k}` }))} />
      {cur === "single" && <LibraryAdmin key="s" kind="booklet_single" />}
      {cur === "spread" && <LibraryAdmin key="d" kind="booklet_spread" />}
      {cur === "bundle" && <BundleAdmin />}
    </div>
  );
}
