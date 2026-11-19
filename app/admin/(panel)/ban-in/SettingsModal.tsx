"use client";
/* Bàn in → Cài đặt: "Quy tắc quy đổi" (cụm chữ trong tên sản phẩm / phân loại → gói CD · món in lẻ · Không cần in)
   và "Món in lẻ" (tên, khổ cm, các mặt, bo góc, nhóm in). */
import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { deleteAddon, deleteRule, insertRule, patchRule, upsertAddon } from "@/lib/printShop/db";
import { addonOfRule, packOfRule } from "@/lib/printShop/rules";
import type { Addon, Pack, Rule } from "@/lib/printShop/types";
import { Button, toast } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

const inp = "h-8 rounded-[6px] border border-[#e5e5e7] bg-white px-2 text-[13px] outline-none focus:border-[#ff5fa2]";
const RESULTS: [Rule["result"], string][] = [["package", "Gói CD"], ["addon", "Món in lẻ"], ["skip", "Không cần in"]];
const GROUPS: [Addon["group_key"], string][] = [["front", "Bìa trước (12×12)"], ["back", "Bìa sau"], ["card", "Card"]];

export function SettingsModal({ packs, rules, addons, onRules, onAddons, onClose }: {
  packs: Pack[]; rules: Rule[]; addons: Addon[]; onRules: (r: Rule[]) => void; onAddons: (a: Addon[]) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<"rules" | "addons">("rules");
  const run = async <T,>(fn: () => Promise<T>) => { try { return await fn(); } catch (e) { toast(e instanceof Error ? e.message : "Lỗi", "err"); return null; } };
  const setRule = async (r: Rule, v: Partial<Rule>) => { onRules(rules.map((x) => (x.id === r.id ? { ...x, ...v } : x))); await run(() => patchRule(r.id, v)); };
  const setAddon = async (a: Addon, v: Partial<Addon>) => { const n = { ...a, ...v }; onAddons(addons.map((x) => (x.id === a.id ? n : x))); await run(() => upsertAddon(n)); };
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[92dvh] w-full max-w-[960px] flex-col rounded-[14px] bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-[#efeff1] px-5 py-3">
          <p className="text-[16px] font-semibold">Cài đặt Bàn in</p>
          <div className="ml-3 flex gap-1">
            {([["rules", "Quy tắc quy đổi"], ["addons", "Món in lẻ"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={cx("rounded-[8px] px-3 py-1.5 text-[13px] font-medium", tab === k ? "bg-[#fff0f6] text-[#ff5fa2]" : "text-[#52525b] hover:bg-[#f4f4f5]")}>{l}</button>)}
          </div>
          <button type="button" onClick={onClose} className="ml-auto grid h-8 w-8 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5]" aria-label="Đóng"><X size={16} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === "rules" ? (
            <>
              <p className="mb-3 text-[12px] text-[#71717a]">Cụm chữ khớp trong <b>phân loại</b> (ưu tiên) hoặc tên sản phẩm, không phân biệt hoa thường và dấu. Cụm dài được xét trước. Dòng không khớp quy tắc nào → đơn “Chưa xác định”.</p>
              <table className="w-full text-[13px]">
                <thead><tr className="text-left text-[12px] text-[#71717a]"><th className="p-1.5">Cụm chữ cần khớp</th><th className="p-1.5">Kết quả</th><th className="p-1.5">Cụ thể</th><th className="w-8" /></tr></thead>
                <tbody>
                  {rules.map((r) => {
                    const p = r.result === "package" ? packOfRule(r, packs) : null, a = r.result === "addon" ? addonOfRule(r, addons) : null;
                    return (
                      <tr key={r.id} className="border-t border-[#efeff1]">
                        <td className="p-1.5"><input defaultValue={r.pattern} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== r.pattern) setRule(r, { pattern: e.target.value.trim() }); }} className={cx(inp, "w-full")} /></td>
                        <td className="p-1.5"><select value={r.result === "music" ? "skip" : r.result} onChange={(e) => setRule(r, { result: e.target.value as Rule["result"] })} className={inp}>{RESULTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
                        <td className="p-1.5">
                          {r.result === "package" && (
                            <select value={p?.id ?? ""} onChange={(e) => setRule(r, { package_id: e.target.value || null })} className={cx(inp, "w-full", !p && "border-[#f59e0b] bg-[#fffbeb]")}>
                              <option value="">{p ? "" : "— chọn gói —"}</option>
                              {packs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                            </select>
                          )}
                          {r.result === "addon" && (
                            <select value={a?.id ?? ""} onChange={(e) => setRule(r, { addon_id: e.target.value || null })} className={cx(inp, "w-full", !a && "border-[#f59e0b] bg-[#fffbeb]")}>
                              <option value="">— chọn món —</option>
                              {addons.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                            </select>
                          )}
                        </td>
                        <td className="p-1.5"><button type="button" onClick={async () => { onRules(rules.filter((x) => x.id !== r.id)); await run(() => deleteRule(r.id)); }} className="grid h-8 w-8 place-items-center text-[#a1a1aa] hover:text-[#dc2626]" aria-label="Xoá"><Trash2 size={14} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Button size="sm" variant="secondary" className="mt-3" icon={<Plus size={14} />} onClick={async () => { const r = await run(() => insertRule({ pattern: "Cụm chữ mới", result: "package", sort_order: rules.length + 1 })); if (r) onRules([...rules, r]); }}>Thêm quy tắc</Button>
            </>
          ) : (
            <>
              <p className="mb-3 text-[12px] text-[#71717a]">Món in lẻ thêm được vào đơn (mỗi lần thêm = 1 vật in riêng). Các mặt cách nhau bằng dấu phẩy — món 2 mặt có bước lật giấy khi in.</p>
              <table className="w-full text-[13px]">
                <thead><tr className="text-left text-[12px] text-[#71717a]"><th className="p-1.5">Tên</th><th className="p-1.5">Rộng (cm)</th><th className="p-1.5">Cao (cm)</th><th className="p-1.5">Các mặt</th><th className="p-1.5">Bo góc</th><th className="p-1.5">Nhóm in</th><th className="p-1.5">Bật</th><th className="w-8" /></tr></thead>
                <tbody>
                  {addons.map((a) => (
                    <tr key={a.id} className="border-t border-[#efeff1]">
                      <td className="p-1.5"><input defaultValue={a.name} onBlur={(e) => e.target.value.trim() && e.target.value !== a.name && setAddon(a, { name: e.target.value.trim() })} className={cx(inp, "w-full")} /></td>
                      <td className="p-1.5"><input type="number" step={0.1} defaultValue={a.w_cm} onBlur={(e) => Number(e.target.value) > 0 && setAddon(a, { w_cm: Number(e.target.value) })} className={cx(inp, "w-20")} /></td>
                      <td className="p-1.5"><input type="number" step={0.1} defaultValue={a.h_cm} onBlur={(e) => Number(e.target.value) > 0 && setAddon(a, { h_cm: Number(e.target.value) })} className={cx(inp, "w-20")} /></td>
                      <td className="p-1.5"><input defaultValue={a.sides.join(", ")} onBlur={(e) => { const s = e.target.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 2); if (s.length) setAddon(a, { sides: s }); }} className={cx(inp, "w-full")} /></td>
                      <td className="p-1.5 text-center"><input type="checkbox" checked={a.rounded} onChange={(e) => setAddon(a, { rounded: e.target.checked })} className="accent-[#ff5fa2]" /></td>
                      <td className="p-1.5"><select value={a.group_key} onChange={(e) => setAddon(a, { group_key: e.target.value as Addon["group_key"] })} className={inp}>{GROUPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
                      <td className="p-1.5 text-center"><input type="checkbox" checked={a.is_active} onChange={(e) => setAddon(a, { is_active: e.target.checked })} className="accent-[#ff5fa2]" /></td>
                      <td className="p-1.5"><button type="button" onClick={async () => { onAddons(addons.filter((x) => x.id !== a.id)); await run(() => deleteAddon(a.id)); }} className="grid h-8 w-8 place-items-center text-[#a1a1aa] hover:text-[#dc2626]" aria-label="Xoá"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button size="sm" variant="secondary" className="mt-3" icon={<Plus size={14} />} onClick={async () => { const a = await run(() => upsertAddon({ code: `mon-${Date.now().toString(36)}`, name: "Món mới", w_cm: 10, h_cm: 10, sides: ["mặt trước"], rounded: false, group_key: "card", sort_order: addons.length + 1, is_active: true })); if (a) onAddons([...addons, a]); }}>Thêm món</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
