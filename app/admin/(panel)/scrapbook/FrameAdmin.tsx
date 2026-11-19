"use client";
import { deleteFiles } from "@/lib/storage/client";

/* Admin → Quản lý chất liệu → tab "Khung ảnh": quản lý theo BỘ KHUNG (tên, bật/tắt, thứ tự).
   Mỗi khung: ảnh PNG (upload hoặc link), vùng ảnh nằm dưới khung (tự dò vùng trong suốt bên trong / kéo 4 góc /
   ảnh mặt nạ đen trắng cho vùng tròn, tim, hình bất kỳ), tỉ lệ (cao / rộng), bật/tắt. Upload nhiều khung cùng lúc:
   mỗi khung tự dò vùng ảnh, admin duyệt lại. Xem trước bằng ảnh thử. */
import { promptDialog } from "@/components/ui/dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crop, Plus, Trash2, Upload, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loadImg } from "@/lib/mockup/images";
import { uploadScrapbookAsset } from "@/lib/upload";
import { revalidatePublic } from "@/app/admin/actions";
import { detectRegion } from "@/lib/scrapbook/frameDetect";
import { maskToAlpha } from "@/lib/scrapbook/frames";
import { samplePhotos } from "@/lib/scrapbook/samples";
import type { Frame, FrameSet, Rect01 } from "@/lib/scrapbook/types";
import { Badge, Button, Card, EmptyState, Field, Input, Message, SortButtons, Toggle, confirmDialog } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

type Msg = { type: "ok" | "err"; text: string } | null;
const PATHS = ["/thiet-ke/cd-template", "/thiet-ke/booklet"];
const checker = "bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:12px_12px]";
const storagePath = (url: string) => url; // xoá theo link (lib/storage nhận cả link R2 lẫn Supabase cũ)

/** ảnh xem trước: ảnh thử nằm dưới khung, cắt theo vùng ảnh / mặt nạ */
async function previewOf(f: Pick<Frame, "url" | "region" | "mask_url">, photo: HTMLCanvasElement, size = 220) {
  const img = await loadImg(f.url);
  const W = size, H = Math.round(size * (img.naturalHeight / img.naturalWidth));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d")!;
  const g = f.region ?? { x0: 0, y0: 0, x1: 1, y1: 1 }, ix = g.x0 * W, iy = g.y0 * H, iw = (g.x1 - g.x0) * W, ih = (g.y1 - g.y0) * H;
  const s = Math.max(iw / photo.width, ih / photo.height);
  const p = document.createElement("canvas"); p.width = W; p.height = H;
  const px = p.getContext("2d")!;
  px.save(); px.beginPath(); px.rect(ix, iy, iw, ih); px.clip(); px.drawImage(photo, ix + iw / 2 - (photo.width * s) / 2, iy + ih / 2 - (photo.height * s) / 2, photo.width * s, photo.height * s); px.restore();
  if (f.mask_url) { px.globalCompositeOperation = "destination-in"; px.drawImage(maskToAlpha(await loadImg(f.mask_url)), 0, 0, W, H); }
  x.drawImage(p, 0, 0); x.drawImage(img, 0, 0, W, H);
  return c.toDataURL("image/png");
}

export function FrameAdmin() {
  const [sets, setSets] = useState<FrameSet[]>([]);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [cur, setCur] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState("");
  const [edit, setEdit] = useState<Frame | null>(null);
  const [prev, setPrev] = useState<Record<string, string>>({});
  const fileIn = useRef<HTMLInputElement>(null);
  const photo = useMemo(() => (typeof document === "undefined" ? null : samplePhotos()[1]), []);

  const load = useCallback(async () => {
    const sb = createClient();
    const [s, f] = await Promise.all([sb.from("frame_sets").select("*").order("sort_order").order("created_at"), sb.from("frames").select("*").order("sort_order").order("created_at")]);
    if (s.error) setMsg({ type: "err", text: "Chưa có bảng khung ảnh — cần chạy supabase/migration_booklet_scrapbook.sql." });
    const ss = (s.data ?? []) as FrameSet[];
    setSets(ss); setFrames((f.data ?? []) as Frame[]);
    setCur((c) => (c && ss.some((x) => x.id === c) ? c : ss[0]?.id ?? null));
    setReady(true);
  }, []);
  useEffect(() => { load(); }, [load]);
  const after = async (text: string) => { setMsg({ type: "ok", text }); await revalidatePublic(PATHS); await load(); };
  const list = frames.filter((f) => f.set_id === cur);
  useEffect(() => {
    if (!photo) return;
    let off = false;
    (async () => { for (const f of list) { if (off) return; const key = `${f.id}|${f.url}|${JSON.stringify(f.region)}|${f.mask_url}`; if (prev[key]) continue; try { const u = await previewOf(f, photo); if (!off) setPrev((p) => ({ ...p, [key]: u })); } catch { /* bỏ */ } } })();
    return () => { off = true; };
  }, [list, photo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- bộ khung ----------
  async function addSet() {
    if (!name.trim()) return setMsg({ type: "err", text: "Nhập tên bộ khung." });
    const { error } = await createClient().from("frame_sets").insert({ name: name.trim(), sort_order: (sets.at(-1)?.sort_order ?? 0) + 1 });
    if (error) return setMsg({ type: "err", text: error.message });
    setName(""); await after("Đã tạo bộ khung.");
  }
  async function patchSet(id: string, v: Partial<FrameSet>, text = "Đã lưu.") {
    const { error } = await createClient().from("frame_sets").update(v).eq("id", id);
    if (error) return setMsg({ type: "err", text: error.message });
    await after(text);
  }
  async function removeSet(s: FrameSet) {
    if (!await confirmDialog(`Xoá bộ khung "${s.name}" và toàn bộ khung trong bộ?`, { danger: true, ok: "Xoá" })) return;
    const sb = createClient(), paths = frames.filter((f) => f.set_id === s.id).flatMap((f) => [storagePath(f.url), f.mask_url ? storagePath(f.mask_url) : null]).filter(Boolean) as string[];
    const { error } = await sb.from("frame_sets").delete().eq("id", s.id);
    if (error) return setMsg({ type: "err", text: error.message });
    if (paths.length) await deleteFiles({ urls: paths }).catch(() => 0);
    await after("Đã xoá bộ khung.");
  }
  async function moveSet(i: number, d: number) {
    const j = i + d; if (j < 0 || j >= sets.length) return;
    const sb = createClient();
    await Promise.all([sb.from("frame_sets").update({ sort_order: sets[j].sort_order }).eq("id", sets[i].id), sb.from("frame_sets").update({ sort_order: sets[i].sort_order }).eq("id", sets[j].id)]);
    await after("Đã đổi thứ tự.");
  }

  // ---------- khung ----------
  async function insertFrame(url: string, fname: string, order: number) {
    const img = await loadImg(url);
    const region = detectRegion(img);
    const { error } = await createClient().from("frames").insert({ set_id: cur, name: fname, url, region, ratio: img.naturalHeight / img.naturalWidth, sort_order: order });
    if (error) throw new Error(error.message);
    return !!region;
  }
  async function uploadMany(files: File[]) {
    if (!cur) return;
    let ok = 0, miss = 0, order = (list.at(-1)?.sort_order ?? 0) + 1;
    for (const [i, f] of files.entries()) {
      setBusy(`Đang tải ${i + 1} / ${files.length}...`);
      try { const url = await uploadScrapbookAsset(f); if (await insertFrame(url, f.name.replace(/\.[a-z0-9]+$/i, ""), order++)) ok++; else miss++; }
      catch (e) { setMsg({ type: "err", text: e instanceof Error ? e.message : "Tải khung thất bại" }); }
    }
    setBusy("");
    await after(`Đã thêm ${ok + miss} khung${miss ? ` · ${miss} khung chưa dò được vùng ảnh — bấm "Vùng ảnh" để đặt tay` : ""}.`);
  }
  async function addLink() {
    if (!cur || !/^https?:\/\//i.test(link.trim())) return setMsg({ type: "err", text: "Link ảnh phải bắt đầu bằng https://" });
    try { await insertFrame(link.trim(), "Khung", (list.at(-1)?.sort_order ?? 0) + 1); setLink(""); await after("Đã thêm khung."); }
    catch (e) { setMsg({ type: "err", text: e instanceof Error ? e.message : "Không tải được ảnh" }); }
  }
  async function patchFrame(id: string, v: Partial<Frame>, text = "Đã lưu.") {
    const { error } = await createClient().from("frames").update(v).eq("id", id);
    if (error) return setMsg({ type: "err", text: error.message });
    await after(text);
  }
  async function removeFrame(f: Frame) {
    if (!await confirmDialog(`Xoá khung "${f.name}"?`, { danger: true, ok: "Xoá" })) return;
    const sb = createClient(), paths = [storagePath(f.url), f.mask_url ? storagePath(f.mask_url) : null].filter(Boolean) as string[];
    const { error } = await sb.from("frames").delete().eq("id", f.id);
    if (error) return setMsg({ type: "err", text: error.message });
    if (paths.length) await deleteFiles({ urls: paths }).catch(() => 0);
    await after("Đã xoá khung.");
  }
  async function moveFrame(i: number, d: number) {
    const j = i + d; if (j < 0 || j >= list.length) return;
    const sb = createClient();
    await Promise.all([sb.from("frames").update({ sort_order: list[j].sort_order }).eq("id", list[i].id), sb.from("frames").update({ sort_order: list[i].sort_order }).eq("id", list[j].id)]);
    await after("Đã đổi thứ tự.");
  }

  if (!ready) return <p className="text-[13px] text-[#71717a]">Đang tải...</p>;
  const set = sets.find((s) => s.id === cur);
  return (
    <div className="space-y-6">
      <Card title="Bộ khung" description="Mỗi bộ gồm nhiều khung PNG cùng phong cách. Mẫu tự lấy ngẫu nhiên khung từ các bộ đang bật.">
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <Field label="Tên bộ mới" className="min-w-[220px] flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Polaroid, Tem thư, Hoa" /></Field>
          <Button icon={<Plus size={16} />} onClick={addSet}>Thêm bộ</Button>
        </div>
        {sets.length ? (
          <ul className="divide-y divide-[#efeff1] rounded-[10px] border border-[#e5e5e7]">
            {sets.map((s, i) => (
              <li key={s.id} className={cx("flex items-center gap-2 px-3 py-2", cur === s.id && "bg-[#fff5f9]")}>
                <button type="button" onClick={() => setCur(s.id)} className="min-w-0 flex-1 text-left">
                  <span className="text-[14px] font-medium">{s.name}</span> <span className="text-[12px] text-[#71717a]">· {frames.filter((f) => f.set_id === s.id).length} khung</span>
                </button>
                {!s.is_active && <Badge>Đang tắt</Badge>}
                <Toggle checked={s.is_active} onChange={(v) => patchSet(s.id, { is_active: v }, v ? "Đã bật bộ khung." : "Đã tắt bộ khung.")} label="" />
                <button type="button" onClick={async () => { const n = await promptDialog({ title: "Đổi tên bộ khung", label: "Tên bộ khung", defaultValue: s.name, confirmText: "Đổi tên" }); if (n?.trim()) await patchSet(s.id, { name: n.trim() }); }} className="text-[12px] text-[#52525b] hover:text-[#ff5fa2]">Đổi tên</button>
                <SortButtons onUp={() => moveSet(i, -1)} onDown={() => moveSet(i, 1)} first={i === 0} last={i === sets.length - 1} />
                <button type="button" onClick={() => removeSet(s)} aria-label="Xoá bộ" className="text-[#a1a1aa] hover:text-[#dc2626]"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        ) : <EmptyState>Chưa có bộ khung nào.</EmptyState>}
      </Card>

      {set && (
        <Card title={`Khung trong bộ “${set.name}” (${list.length})`}>
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <Button icon={<Upload size={16} />} loading={!!busy} onClick={() => fileIn.current?.click()}>Tải nhiều khung lên</Button>
            <input ref={fileIn} type="file" multiple accept="image/png,image/webp" className="sr-only" onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; if (fs.length) uploadMany(fs); }} />
            <Field label="Hoặc dán link ảnh khung" className="min-w-[240px] flex-1"><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." /></Field>
            <Button variant="secondary" onClick={addLink}>Thêm từ link</Button>
            {busy && <span className="text-[12px] text-[#71717a]">{busy}</span>}
          </div>
          <p className="mb-3 text-[12px] text-[#71717a]">PNG nền trong suốt, ô ảnh ở giữa trong suốt. Mỗi khung tự dò vùng ảnh — kiểm tra lại ảnh xem trước, sửa bằng nút “Vùng ảnh”.</p>
          {list.length ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {list.map((f, i) => {
                const key = `${f.id}|${f.url}|${JSON.stringify(f.region)}|${f.mask_url}`;
                return (
                  <li key={f.id} className={cx("overflow-hidden rounded-[10px] border border-[#e5e5e7]", !f.is_active && "opacity-50")}>
                    <div className={cx("relative grid aspect-square place-items-center p-2", checker)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={prev[key] ?? f.url} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                    </div>
                    <div className="space-y-1 px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <p className="min-w-0 flex-1 truncate text-[12px]" title={f.name}>{f.name}</p>
                        <SortButtons onUp={() => moveFrame(i, -1)} onDown={() => moveFrame(i, 1)} first={i === 0} last={i === list.length - 1} />
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {!f.region && !f.mask_url && <Badge tone="amber">Chưa có vùng ảnh</Badge>}
                        {f.mask_url && <Badge tone="pink">Mặt nạ</Badge>}
                        <span className="text-[11px] text-[#a1a1aa]">tỉ lệ {Math.round(f.ratio * 100) / 100}</span>
                      </div>
                      <label className="flex items-center gap-1.5 text-[12px] text-[#52525b]" title="Khung dạng viền có thể kéo dài: thêm nút kéo giữa 4 cạnh trong trình chỉnh">
                        <input type="checkbox" className="accent-[#ff5fa2]" checked={!!f.allow_stretch} onChange={(e) => patchFrame(f.id, { allow_stretch: e.target.checked }, e.target.checked ? "Đã cho phép kéo giãn." : "Đã khoá tỉ lệ.")} />
                        Cho phép kéo giãn
                      </label>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setEdit(f)} className="inline-flex items-center gap-1 text-[12px] font-medium text-[#ff5fa2]"><Crop size={12} /> Vùng ảnh</button>
                        <span className="flex-1" />
                        <Toggle checked={f.is_active} onChange={(v) => patchFrame(f.id, { is_active: v }, v ? "Đã bật." : "Đã tắt.")} label="" />
                        <button type="button" onClick={() => removeFrame(f)} aria-label="Xoá khung" className="text-[#a1a1aa] hover:text-[#dc2626]"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : <EmptyState>Bộ này chưa có khung.</EmptyState>}
        </Card>
      )}
      <Message msg={msg} />
      {edit && photo && <RegionEditor frame={edit} photo={photo} onClose={() => setEdit(null)} onSave={async (v) => { await patchFrame(edit.id, v, "Đã lưu vùng ảnh."); setEdit(null); }} />}
    </div>
  );
}

// ---------- vùng ảnh: tự dò · kéo 4 góc · ảnh mặt nạ đen trắng · xem trước bằng ảnh thử ----------
function RegionEditor({ frame, photo, onClose, onSave }: { frame: Frame; photo: HTMLCanvasElement; onClose: () => void; onSave: (v: Partial<Frame>) => void }) {
  const [r, setR] = useState<Rect01>(frame.region ?? { x0: 0.15, y0: 0.15, x1: 0.85, y1: 0.85 });
  const [mask, setMask] = useState<string | null>(frame.mask_url);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null), drag = useRef<number | null>(null), maskIn = useRef<HTMLInputElement>(null);
  const corners: [keyof Rect01, keyof Rect01][] = [["x0", "y0"], ["x1", "y0"], ["x1", "y1"], ["x0", "y1"]];
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const R = { x0: Math.min(r.x0, r.x1), y0: Math.min(r.y0, r.y1), x1: Math.max(r.x0, r.x1), y1: Math.max(r.y0, r.y1) };
  useEffect(() => {
    let off = false;
    const t = setTimeout(() => previewOf({ url: frame.url, region: R, mask_url: mask }, photo, 300).then((u) => { if (!off) setPreview(u); }).catch(() => {}), 150);
    return () => { off = true; clearTimeout(t); };
  }, [r, mask]); // eslint-disable-line react-hooks/exhaustive-deps
  function onMove(e: React.PointerEvent) {
    if (drag.current === null || !box.current) return;
    const b = box.current.getBoundingClientRect(), [kx, ky] = corners[drag.current];
    setR((c) => ({ ...c, [kx]: clamp((e.clientX - b.left) / b.width), [ky]: clamp((e.clientY - b.top) / b.height) }));
  }
  async function detect() {
    setErr("");
    try { const g = detectRegion(await loadImg(frame.url)); if (g) setR(g); else setErr("Không tìm thấy vùng trong suốt bên trong khung — kéo 4 góc hoặc tải ảnh mặt nạ."); }
    catch { setErr("Không đọc được ảnh khung."); }
  }
  async function upMask(f: File) {
    setBusy(true);
    try { setMask(await uploadScrapbookAsset(f)); } catch (e) { setErr(e instanceof Error ? e.message : "Tải mặt nạ thất bại"); }
    setBusy(false);
  }
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-[820px] overflow-y-auto rounded-[12px] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-[16px] font-semibold">Vùng ảnh · {frame.name}</p>
        <p className="mb-3 text-[13px] text-[#71717a]">Kéo 4 góc hồng cho khớp ô ảnh của khung, bấm “Tự dò”, hoặc tải ảnh mặt nạ đen trắng (trắng = vùng ảnh, cùng kích thước khung) cho ô tròn, tim, hình bất kỳ.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div ref={box} className={cx("relative w-full touch-none select-none", checker)} onPointerMove={onMove} onPointerUp={() => { drag.current = null; }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frame.url} alt="" className="block w-full" draggable={false} />
            <span className="pointer-events-none absolute border-2 border-[#ff5fa2] bg-[#ff5fa2]/10" style={{ left: `${R.x0 * 100}%`, top: `${R.y0 * 100}%`, width: `${(R.x1 - R.x0) * 100}%`, height: `${(R.y1 - R.y0) * 100}%` }} />
            {corners.map(([kx, ky], i) => (
              <span key={i} onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = i; }}
                className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border-2 border-white bg-[#ff5fa2] shadow" style={{ left: `${r[kx] * 100}%`, top: `${r[ky] * 100}%` }} />
            ))}
          </div>
          <div>
            <p className="mb-1 text-[12px] text-[#71717a]">Xem trước bằng ảnh thử</p>
            <div className={cx("grid place-items-center rounded-[10px] p-2", checker)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {preview ? <img src={preview} alt="" className="max-h-[320px] max-w-full" /> : <span className="h-40" />}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" icon={<Upload size={14} />} loading={busy} onClick={() => maskIn.current?.click()}>{mask ? "Đổi ảnh mặt nạ" : "Tải ảnh mặt nạ"}</Button>
              {mask && <button type="button" onClick={() => setMask(null)} className="text-[12px] text-[#dc2626]">Bỏ mặt nạ</button>}
              <input ref={maskIn} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upMask(f); }} />
            </div>
          </div>
        </div>
        {err && <p className="mt-2 text-[12px] text-[#dc2626]">{err}</p>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" icon={<Wand2 size={16} />} onClick={detect}>Tự dò</Button>
          <Button variant="secondary" onClick={onClose}>Huỷ</Button>
          <Button onClick={() => onSave({ region: R, mask_url: mask })}>Lưu vùng ảnh</Button>
        </div>
      </div>
    </div>
  );
}
