"use client";
/* Tài chính → Nguyên liệu → "Đóng gói mỗi đơn": chọn 1 trong 2 cách — (a) số tiền cố định mỗi đơn · (b) công thức: các mặt hàng
   đóng gói + lượng dùng mỗi đơn, tính từ giá bình quân. Áp cho MỌI đơn (Shopee + ngoài sàn). Lưu finance_settings.packaging. */
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { money, packagingCost, saveSetting, type Catalog, type Item, type Packaging } from "@/lib/finance/catalog";
import { Combo } from "@/components/admin/finance/Combo";
import { itemOpts } from "@/components/admin/finance/useCatalog";
import { Button, Card, Input, cx } from "@/components/admin/ui";

export function PackagingTab({ cat, reload, newItem, setErr }: { cat: Catalog; reload: () => Promise<void>; newItem: (n: string, v?: Partial<Item>) => Promise<string | null>; setErr: (s: string) => void }) {
  const [p, setP] = useState<Packaging>(cat.packaging);
  const [busy, setBusy] = useState(false);
  const pack = cat.categories.find((c) => c.name === "Đóng gói")?.id ?? null;
  const preview = packagingCost({ ...cat, packaging: p });
  async function save() {
    setBusy(true);
    try { await saveSetting(createClient(), "packaging", { ...p, items: p.items.filter((x) => x.item_id) }); await reload(); setErr(""); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }
  return (
    <Card title="Đóng gói mỗi đơn" description="Áp cho mọi đơn (Shopee và ngoài sàn). Đơn ngoài sàn tắt được cho từng đơn (ví dụ giao tận tay)."
      actions={<Button size="sm" loading={busy} onClick={save}>Lưu</Button>}>
      <div className="mb-4 inline-flex overflow-hidden rounded-full border border-[#e5e5e7] text-[13px]">
        {([["fixed", "Số tiền cố định"], ["recipe", "Theo công thức"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setP((x) => ({ ...x, mode: k }))} className={cx("px-3 py-1.5", p.mode === k ? "bg-[#ff5fa2] text-white" : "text-[#52525b]")}>{l}</button>)}
      </div>
      {p.mode === "fixed" ? (
        <label className="flex max-w-[280px] items-center gap-2 text-[13px]"><Input inputMode="numeric" value={p.fixed || ""} onChange={(e) => setP((x) => ({ ...x, fixed: Number(e.target.value.replace(/\D/g, "")) || 0 }))} placeholder="3000" /> đ / đơn</label>
      ) : (
        <div className="space-y-2">
          {p.items.map((r, i) => {
            const it = cat.items.find((x) => x.id === r.item_id), c = cat.costs.get(r.item_id)?.cost ?? null;
            return (
              <div key={i} className="flex flex-wrap items-center gap-2 text-[13px]">
                <Combo className="min-w-[200px] flex-1" value={r.item_id || null} options={itemOpts(cat)} placeholder="Mặt hàng đóng gói" onCreate={(t) => newItem(t, { category_id: pack })}
                  onChange={(id) => setP((x) => ({ ...x, items: x.items.map((y, j) => (j === i ? { ...y, item_id: id ?? "" } : y)) }))} />
                <Input inputMode="decimal" value={String(r.qty)} onChange={(e) => setP((x) => ({ ...x, items: x.items.map((y, j) => (j === i ? { ...y, qty: Number(e.target.value.replace(",", ".")) || 0 } : y)) }))} className="w-[90px]" />
                <span className="w-[60px] text-[#71717a]">{it?.unit ?? ""}</span>
                <span className="w-[90px] text-right tabular-nums text-[#52525b]">{c === null ? "chưa có giá" : money(c * r.qty)}</span>
                <button type="button" onClick={() => setP((x) => ({ ...x, items: x.items.filter((_, j) => j !== i) }))} aria-label="Bỏ" className="p-1 text-[#a1a1aa] hover:text-[#dc2626]"><Trash2 size={14} /></button>
              </div>
            );
          })}
          <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setP((x) => ({ ...x, items: [...x.items, { item_id: "", qty: 1 }] }))}>Thêm mặt hàng</Button>
        </div>
      )}
      <p className="mt-4 text-[14px]">Chi phí đóng gói mỗi đơn: <b>{money(preview)}</b></p>
    </Card>
  );
}
