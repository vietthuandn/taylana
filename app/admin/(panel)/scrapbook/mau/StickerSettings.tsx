"use client";

/* Admin → Chất liệu Scrapbook → Mẫu → "Cài đặt sticker tự rải" (site_settings "scrap_stickers"):
   khoảng kích thước (% của 120 mm: sticker thường, điểm nhấn, doodle), khoảng số lượng cho trang / cặp trang / đĩa,
   băng dính mỗi ảnh, bật / tắt sticker mặc định vẽ bằng code, mức ưu tiên tông màu. Mặc định: lib/scrapbook/decor.ts. */
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { revalidatePublic } from "@/app/admin/actions";
import { DEFAULT_STICKER_CFG, mergeStickerCfg, setStickerConfig, type Range, type StickerCfg } from "@/lib/scrapbook/decor";
import { STYLES, type FrameSet } from "@/lib/scrapbook/types";
import { Button, Card, Toggle, toast } from "@/components/admin/ui";

function Pair({ label, v, onChange, unit, step = 1 }: { label: string; v: Range; onChange: (v: Range) => void; unit?: string; step?: number }) {
  const inp = "h-8 w-16 rounded-[6px] border border-[#e5e5e7] px-1.5 text-[13px] tabular-nums";
  return (
    <label className="flex items-center justify-between gap-2 text-[13px] text-[#3f3f46]">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <input type="number" step={step} value={v[0]} onChange={(e) => onChange([Number(e.target.value), v[1]])} className={inp} />
        <span className="text-[#a1a1aa]">–</span>
        <input type="number" step={step} value={v[1]} onChange={(e) => onChange([v[0], Number(e.target.value)])} className={inp} />
        {unit && <span className="w-6 text-[12px] text-[#71717a]">{unit}</span>}
      </span>
    </label>
  );
}

export function StickerSettings({ value, onSaved, sets = [] }: { value: StickerCfg; onSaved: (v: StickerCfg) => void; sets?: FrameSet[] }) {
  const [c, setC] = useState<StickerCfg>(value);
  const [saving, setSaving] = useState(false);
  async function save() {
    const v = mergeStickerCfg(c);
    setSaving(true);
    const { error } = await createClient().from("site_settings").upsert({ key: "scrap_stickers", value: v, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return toast(error.message, "err");
    setStickerConfig(v); setC(v); onSaved(v);
    await revalidatePublic(["/thiet-ke/scrapbook", "/thiet-ke/booklet-scrapbook"]);
    toast("Đã lưu cài đặt sticker tự rải");
  }
  return (
    <Card title="Cài đặt sticker tự rải" description="Áp dụng khi khách áp mẫu mới và khi bấm “Xáo trộn”. Kích thước tính theo % bề rộng 1 trang / đường kính đĩa (12 cm).">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-2">
          <p className="text-[13px] font-semibold">Kích thước (%)</p>
          <Pair label="Sticker thường" v={c.normal} onChange={(v) => setC({ ...c, normal: v })} unit="%" />
          <Pair label="Sticker điểm nhấn" v={c.accent} onChange={(v) => setC({ ...c, accent: v })} unit="%" />
          <Pair label="Doodle nhỏ" v={c.doodle} onChange={(v) => setC({ ...c, doodle: v })} unit="%" />
          <Pair label="Băng dính mỗi ảnh" v={c.tapes} onChange={(v) => setC({ ...c, tapes: v })} unit="miếng" />
        </div>
        <div className="space-y-2">
          <p className="text-[13px] font-semibold">Số lượng</p>
          <Pair label="Trang: sticker" v={c.page.stickers} onChange={(v) => setC({ ...c, page: { ...c.page, stickers: v } })} />
          <Pair label="Trang: doodle" v={c.page.doodles} onChange={(v) => setC({ ...c, page: { ...c.page, doodles: v } })} />
          <Pair label="Cặp trang: sticker" v={c.spread.stickers} onChange={(v) => setC({ ...c, spread: { ...c.spread, stickers: v } })} />
          <Pair label="Cặp trang: doodle" v={c.spread.doodles} onChange={(v) => setC({ ...c, spread: { ...c.spread, doodles: v } })} />
          <Pair label="Đĩa: sticker" v={c.disc.stickers} onChange={(v) => setC({ ...c, disc: { ...c.disc, stickers: v } })} />
          <Pair label="Đĩa: điểm nhấn" v={c.disc.accents} onChange={(v) => setC({ ...c, disc: { ...c.disc, accents: v } })} />
          <Pair label="Đĩa: doodle" v={c.disc.doodles} onChange={(v) => setC({ ...c, disc: { ...c.disc, doodles: v } })} />
        </div>
        <div className="space-y-3">
          <p className="text-[13px] font-semibold">Nguồn sticker</p>
          <Toggle checked={c.defaults} onChange={(v) => setC({ ...c, defaults: v })} label="Dùng sticker mặc định vẽ bằng code khi thư viện có ít hơn 6 sticker" />
          <label className="flex items-center justify-between gap-2 text-[13px] text-[#3f3f46]">Ưu tiên sticker hợp tông màu (×)
            <input type="number" step={0.1} min={1} max={5} value={c.toneBoost} onChange={(e) => setC({ ...c, toneBoost: Number(e.target.value) })} className="h-8 w-16 rounded-[6px] border border-[#e5e5e7] px-1.5 text-[13px]" />
          </label>
          <p className="text-[12px] text-[#71717a]">Sticker lấy ngẫu nhiên không lặp từ toàn bộ nhóm Sticker + Doodle đang bật; tông màu chỉ tăng xác suất được chọn.</p>
        </div>
      </div>
      <div className="mt-6 space-y-2 border-t border-[#efeff1] pt-4">
        <p className="text-[13px] font-semibold">Khung ảnh khi tự tạo mẫu</p>
        <label className="flex max-w-[360px] items-center justify-between gap-2 text-[13px] text-[#3f3f46]">Tỉ lệ ô ảnh có khung (%)
          <input type="number" min={0} max={100} step={5} value={c.frameRatio} onChange={(e) => setC({ ...c, frameRatio: Number(e.target.value) })} className="h-8 w-16 rounded-[6px] border border-[#e5e5e7] px-1.5 text-[13px]" />
        </label>
        {sets.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2">
            {STYLES.map((st) => (
              <div key={st.id} className="rounded-[8px] border border-[#e5e5e7] p-2 text-[12px]">
                <p className="mb-1 font-medium">{st.name}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {sets.map((fs) => (
                    <label key={fs.id} className="flex items-center gap-1"><input type="checkbox" className="accent-[#ff5fa2]" checked={!!c.frameSets[st.id]?.includes(fs.id)}
                      onChange={(e) => setC({ ...c, frameSets: { ...c.frameSets, [st.id]: e.target.checked ? [...(c.frameSets[st.id] ?? []), fs.id] : (c.frameSets[st.id] ?? []).filter((x) => x !== fs.id) } })} />{fs.name}</label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-[12px] text-[#71717a]">Chưa có bộ khung đang bật (tab “Khung ảnh”).</p>}
        <p className="text-[12px] text-[#71717a]">Không chọn bộ nào cho 1 phong cách → tự ưu tiên bộ có tên hợp phong cách (vd “Polaroid” cho Lưới polaroid, “Hoa” cho Hoa lá), không có thì lấy bất kỳ.</p>
      </div>
      <div className="mt-4 flex gap-2">
        <div className="flex gap-2">
            <Button size="sm" onClick={save} loading={saving}>Lưu cài đặt</Button>
            <Button size="sm" variant="secondary" onClick={() => setC(DEFAULT_STICKER_CFG)}>Về mặc định</Button>
          </div>
        </div>
    </Card>
  );
}
