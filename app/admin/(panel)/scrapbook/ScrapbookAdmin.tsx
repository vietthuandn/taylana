"use client";

/* Admin → Chất liệu Scrapbook: băng dính, sticker, khung ảnh, doodle, texture, mảnh giấy (PNG trong suốt, upload hoặc link).
   Khung ảnh có thêm vùng đặt ảnh (kéo 4 góc hoặc tự dò vùng trong suốt). */
import { useCallback, useEffect, useRef, useState } from "react";
import { Crop, Plus, Trash2, Upload, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loadImg } from "@/lib/mockup/images";
import { uploadScrapbookAsset } from "@/lib/upload";
import { revalidatePublic } from "@/app/admin/actions";
import { ASSET_GROUPS, TONES, type AssetGroup, type Rect01, type ScrapAsset } from "@/lib/scrapbook/types";
import { Badge, Button, Card, EmptyState, Field, Input, Message, Select, SortButtons, Toggle, confirmDialog } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

type Msg = { type: "ok" | "err"; text: string } | null;
const PATHS = ["/thiet-ke/scrapbook"];
const checker = "bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:12px_12px]";

export function ScrapbookAdmin() {
  const [list, setList] = useState<ScrapAsset[]>([]);
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [form, setForm] = useState({ name: "", grp: "sticker" as AssetGroup, tone: "any", url: "" });
  const [busy, setBusy] = useState(false);
  const [regionOf, setRegionOf] = useState<ScrapAsset | null>(null);
  const fileIn = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient().from("scrapbook_assets").select("*").order("grp").order("sort_order").order("created_at");
    if (error) setMsg({ type: "err", text: "Chưa có bảng chất liệu — cần chạy supabase/migration_scrapbook.sql." });
    setList((data ?? []) as ScrapAsset[]);
    setReady(true);
  }, []);
  useEffect(() => { load(); }, [load]);
  const after = async (text: string) => { setMsg({ type: "ok", text }); await revalidatePublic(PATHS); await load(); };

  async function add(url: string) {
    if (!form.name.trim()) return setMsg({ type: "err", text: "Nhập tên chất liệu." });
    if (!/^https?:\/\//i.test(url)) return setMsg({ type: "err", text: "Link ảnh phải bắt đầu bằng https://" });
    const same = list.filter((a) => a.grp === form.grp);
    const { error } = await createClient().from("scrapbook_assets").insert({ name: form.name.trim(), grp: form.grp, tone: form.tone, url, sort_order: (same.at(-1)?.sort_order ?? 0) + 1 });
    if (error) return setMsg({ type: "err", text: error.message });
    setForm({ ...form, name: "", url: "" });
    await after("Đã thêm chất liệu.");
  }
  async function upload(f: File) {
    setBusy(true);
    try { await add(await uploadScrapbookAsset(f)); } catch (e) { setMsg({ type: "err", text: e instanceof Error ? e.message : "Tải ảnh thất bại" }); }
    setBusy(false);
  }
  async function patch(id: string, v: Partial<ScrapAsset>, text = "Đã lưu.") {
    const { error } = await createClient().from("scrapbook_assets").update(v).eq("id", id);
    if (error) return setMsg({ type: "err", text: error.message });
    await after(text);
  }
  async function remove(a: ScrapAsset) {
    if (!await confirmDialog(`Xoá "${a.name}"?`, { danger: true, ok: "Xoá" })) return;
    const { error } = await createClient().from("scrapbook_assets").delete().eq("id", a.id);
    if (error) return setMsg({ type: "err", text: error.message });
    await after("Đã xoá.");
  }
  async function reorder(g: ScrapAsset[], i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= g.length) return;
    const sb = createClient();
    await Promise.all([sb.from("scrapbook_assets").update({ sort_order: g[j].sort_order }).eq("id", g[i].id), sb.from("scrapbook_assets").update({ sort_order: g[i].sort_order }).eq("id", g[j].id)]);
    await after("Đã đổi thứ tự.");
  }

  if (!ready) return <p className="text-[13px] text-[#71717a]">Đang tải...</p>;
  return (
    <div className="space-y-6">
      <Card title="Thêm chất liệu" description="Ảnh PNG nền trong suốt. Tải file lên (bucket “scrapbook”) hoặc dán link ảnh.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tên"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Washi hồng chấm bi" /></Field>
          <Field label="Nhóm">
            <Select value={form.grp} onChange={(e) => setForm({ ...form, grp: e.target.value as AssetGroup })}>
              {ASSET_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
          <Field label="Tông màu">
            <Select value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}>
              {TONES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="Link ảnh" className="min-w-[240px] flex-1"><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." /></Field>
          <Button icon={<Plus size={16} />} onClick={() => add(form.url.trim())}>Thêm từ link</Button>
          <Button variant="secondary" icon={<Upload size={16} />} loading={busy} onClick={() => fileIn.current?.click()}>Tải file lên</Button>
          <input ref={fileIn} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
        </div>
      </Card>

      {ASSET_GROUPS.map((g) => {
        const items = list.filter((a) => a.grp === g.id);
        return (
          <Card key={g.id} title={`${g.name} (${items.length})`}>
            {items.length ? (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((a, i) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-[12px] border border-[#e5e5e7] p-2">
                    <div className={cx("relative h-16 w-16 shrink-0 overflow-hidden rounded-[8px]", checker)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.url} alt="" className="h-full w-full object-contain" loading="lazy" />
                      {a.grp === "frame" && a.region && <span className="absolute border border-[#ff5fa2]" style={{ left: `${a.region.x0 * 100}%`, top: `${a.region.y0 * 100}%`, width: `${(a.region.x1 - a.region.x0) * 100}%`, height: `${(a.region.y1 - a.region.y0) * 100}%` }} />}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-[14px] font-medium">{a.name}</p>
                      <select value={a.tone} onChange={(e) => patch(a.id, { tone: e.target.value })} className="h-7 rounded-[6px] border border-[#e5e5e7] px-1 text-[12px]" aria-label="Tông màu">
                        {TONES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      {a.grp === "frame" && (
                        <button type="button" onClick={() => setRegionOf(a)} className="ml-2 inline-flex items-center gap-1 text-[12px] font-medium text-[#ff5fa2] hover:text-[#e0468a]">
                          <Crop size={12} /> {a.region ? "Sửa vùng ảnh" : "Đặt vùng ảnh"}
                        </button>
                      )}
                      {a.grp === "frame" && !a.region && <Badge tone="amber">Chưa có vùng ảnh — chưa dùng được</Badge>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Toggle checked={a.is_active} onChange={(v) => patch(a.id, { is_active: v }, v ? "Đã bật." : "Đã tắt.")} label="" />
                      <div className="flex items-center">
                        <SortButtons onUp={() => reorder(items, i, -1)} onDown={() => reorder(items, i, 1)} first={i === 0} last={i === items.length - 1} />
                        <button type="button" onClick={() => remove(a)} className="grid h-7 w-7 place-items-center rounded-[6px] text-[#dc2626] hover:bg-[#fef2f2]" aria-label="Xoá"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <EmptyState>Chưa có — web dùng bộ mặc định vẽ bằng code.</EmptyState>}
          </Card>
        );
      })}
      <Message msg={msg} />
      {regionOf && <RegionEditor asset={regionOf} onClose={() => setRegionOf(null)} onSave={async (r) => { await patch(regionOf.id, { region: r }, "Đã lưu vùng ảnh."); setRegionOf(null); }} />}
    </div>
  );
}

// ---------- vùng đặt ảnh của khung: kéo 4 góc hoặc tự dò vùng trong suốt ----------
function RegionEditor({ asset, onClose, onSave }: { asset: ScrapAsset; onClose: () => void; onSave: (r: Rect01) => void }) {
  const [r, setR] = useState<Rect01>(asset.region ?? { x0: 0.15, y0: 0.15, x1: 0.85, y1: 0.85 });
  const [err, setErr] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  const corners: [keyof Rect01, keyof Rect01][] = [["x0", "y0"], ["x1", "y0"], ["x1", "y1"], ["x0", "y1"]];
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  function onMove(e: React.PointerEvent) {
    if (drag.current === null || !box.current) return;
    const b = box.current.getBoundingClientRect();
    const [kx, ky] = corners[drag.current];
    setR((cur) => ({ ...cur, [kx]: clamp((e.clientX - b.left) / b.width), [ky]: clamp((e.clientY - b.top) / b.height) }));
  }
  async function detect() {
    setErr("");
    try {
      const img = await loadImg(asset.url);
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext("2d")!; x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
      const A = (px: number, py: number) => d[(py * W + px) * 4 + 3];
      const cx = Math.round(W / 2), cy = Math.round(H / 2);
      if (A(cx, cy) > 20) return setErr("Giữa khung không trong suốt — hãy kéo 4 góc bằng tay.");
      let x0 = cx, x1 = cx, y0 = cy, y1 = cy;
      while (x0 > 0 && A(x0 - 1, cy) <= 20) x0--; while (x1 < W - 1 && A(x1 + 1, cy) <= 20) x1++;
      while (y0 > 0 && A(cx, y0 - 1) <= 20) y0--; while (y1 < H - 1 && A(cx, y1 + 1) <= 20) y1++;
      setR({ x0: x0 / W, y0: y0 / H, x1: (x1 + 1) / W, y1: (y1 + 1) / H });
    } catch { setErr("Không đọc được kênh trong suốt của ảnh (link bị chặn). Hãy kéo 4 góc bằng tay."); }
  }
  const box01 = { x0: Math.min(r.x0, r.x1), y0: Math.min(r.y0, r.y1), x1: Math.max(r.x0, r.x1), y1: Math.max(r.y0, r.y1) };
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={onClose}>
      <div className="w-full max-w-[520px] rounded-[12px] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-[16px] font-semibold">Vùng đặt ảnh · {asset.name}</p>
        <p className="mb-3 text-[13px] text-[#71717a]">Kéo 4 góc hồng cho khớp ô trống của khung, hoặc bấm “Tự dò”.</p>
        <div ref={box} className={cx("relative mx-auto w-full max-w-[420px] touch-none select-none", checker)} onPointerMove={onMove} onPointerUp={() => { drag.current = null; }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.url} alt="" className="block w-full" draggable={false} />
          <span className="pointer-events-none absolute border-2 border-[#ff5fa2] bg-[#ff5fa2]/10"
            style={{ left: `${box01.x0 * 100}%`, top: `${box01.y0 * 100}%`, width: `${(box01.x1 - box01.x0) * 100}%`, height: `${(box01.y1 - box01.y0) * 100}%` }} />
          {corners.map(([kx, ky], i) => (
            <span key={i} onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = i; }}
              className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border-2 border-white bg-[#ff5fa2] shadow"
              style={{ left: `${r[kx] * 100}%`, top: `${r[ky] * 100}%` }} />
          ))}
        </div>
        {err && <p className="mt-2 text-[12px] text-[#dc2626]">{err}</p>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" icon={<Wand2 size={16} />} onClick={detect}>Tự dò</Button>
          <Button variant="secondary" onClick={onClose}>Huỷ</Button>
          <Button onClick={() => onSave(box01)}>Lưu vùng ảnh</Button>
        </div>
      </div>
    </div>
  );
}
