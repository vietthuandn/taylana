"use client";
import { deleteFiles } from "@/lib/storage/client";

/* Admin → Quản lý chất liệu → tab "Khung ảnh": quản lý theo BỘ KHUNG (tên, bật/tắt, thứ tự).
   Mỗi khung: ảnh PNG (upload hoặc link), vùng ảnh nằm dưới khung (tự dò vùng trong suốt bên trong / kéo 4 góc /
   ảnh mặt nạ đen trắng cho vùng tròn, tim, hình bất kỳ), tỉ lệ (cao / rộng), bật/tắt. Upload nhiều khung cùng lúc:
   mỗi khung tự dò vùng ảnh, admin duyệt lại. Xem trước bằng ảnh thử. */
import { promptDialog } from "@/components/ui/dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crop, Plus, RefreshCw, Trash2, Upload, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loadImg } from "@/lib/mockup/images";
import { uploadScrapbookAsset } from "@/lib/upload";
import { revalidatePublic } from "@/app/admin/actions";
import { bboxOf, detectFrameHoles, drawHoles, maskPng, needsMask, quadFrom, unionBox } from "@/lib/frames/holes";
import { maskToAlpha } from "@/lib/scrapbook/frames";
import { samplePhotos } from "@/lib/scrapbook/samples";
import type { Frame, FrameSet, HoleRegion, Rect01 } from "@/lib/scrapbook/types";
import { Badge, Button, Card, EmptyState, Field, Input, Message, SortButtons, Toggle, confirmDialog } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

type Msg = { type: "ok" | "err"; text: string } | null;
const PATHS = ["/thiet-ke/cd-template", "/thiet-ke/booklet"];
const checker = "bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:12px_12px]";
const storagePath = (url: string) => url; // xoá theo link (lib/storage nhận cả link R2 lẫn Supabase cũ)

/** ảnh xem trước: ảnh thử nằm dưới khung, cắt theo các lỗ (đa giác) / vùng ảnh + mặt nạ */
async function previewOf(f: Pick<Frame, "url" | "region" | "mask_url" | "regions">, photo: HTMLCanvasElement, size = 220) {
  const img = await loadImg(f.url);
  const W = size, H = Math.round(size * (img.naturalHeight / img.naturalWidth));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d")!;
  if (f.regions?.length) {
    drawHoles(x, f.regions, W, H, W, H, (pc, cx, cy, w, h) => { const s = Math.max(w / photo.width, h / photo.height); pc.drawImage(photo, cx - (photo.width * s) / 2, cy - (photo.height * s) / 2, photo.width * s, photo.height * s); });
    x.drawImage(img, 0, 0, W, H);
    return c.toDataURL("image/png");
  }
  const g = f.region ?? { x0: 0, y0: 0, x1: 1, y1: 1 }, ix = g.x0 * W, iy = g.y0 * H, iw = (g.x1 - g.x0) * W, ih = (g.y1 - g.y0) * H;
  const s = Math.max(iw / photo.width, ih / photo.height);
  const p = document.createElement("canvas"); p.width = W; p.height = H;
  const px = p.getContext("2d")!;
  px.save(); px.beginPath(); px.rect(ix, iy, iw, ih); px.clip(); px.drawImage(photo, ix + iw / 2 - (photo.width * s) / 2, iy + ih / 2 - (photo.height * s) / 2, photo.width * s, photo.height * s); px.restore();
  if (f.mask_url) { px.globalCompositeOperation = "destination-in"; px.drawImage(maskToAlpha(await loadImg(f.mask_url)), 0, 0, W, H); }
  x.drawImage(p, 0, 0); x.drawImage(img, 0, 0, W, H);
  return c.toDataURL("image/png");
}
/** dữ liệu lưu cho các lỗ: regions + khung bao chung + ảnh mặt nạ PNG (chỉ khi cần: theo hình dạng / nhiều lỗ / 4 góc lệch) */
async function holesPayload(rs: HoleRegion[], w: number, h: number): Promise<Pick<Frame, "regions" | "region" | "mask_url">> {
  if (!rs.length) return { regions: null, region: null, mask_url: null };
  if (!needsMask(rs)) return { regions: rs, region: unionBox(rs), mask_url: null };
  const blob = await maskPng(rs, w, h);
  return { regions: rs, region: unionBox(rs), mask_url: await uploadScrapbookAsset(new File([blob], "mat-na.png", { type: "image/png" })) };
}
const rectQuad = (r: Rect01): HoleRegion => ({ kind: "quad", pts: [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]], bbox: r });

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
  const [redo, setRedo] = useState(false);
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
    (async () => { for (const f of list) { if (off) return; const key = `${f.id}|${f.url}|${JSON.stringify(f.region)}|${f.mask_url}|${JSON.stringify(f.regions ?? null)}`; if (prev[key]) continue; try { const u = await previewOf(f, photo); if (!off) setPrev((p) => ({ ...p, [key]: u })); } catch { /* bỏ */ } } })();
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
    const holes = await detectFrameHoles(img).catch(() => [] as HoleRegion[]);
    const v = await holesPayload(holes, img.naturalWidth, img.naturalHeight);
    const { error } = await createClient().from("frames").insert({ set_id: cur, name: fname, url, ...v, ratio: img.naturalHeight / img.naturalWidth, sort_order: order });
    if (error) throw new Error(error.message);
    return holes.length > 0;
  }
  /** lưu vùng ảnh từ trình chỉnh: các lỗ (tự tạo mặt nạ) hoặc ảnh mặt nạ tải tay; xoá mặt nạ tự tạo cũ */
  async function saveHoles(f: Frame, rs: HoleRegion[], manualMask: string | null) {
    try {
      const img = await loadImg(f.url);
      const v = manualMask ? { regions: null, region: unionBox(rs) ?? { x0: 0, y0: 0, x1: 1, y1: 1 }, mask_url: manualMask } : await holesPayload(rs, img.naturalWidth, img.naturalHeight);
      const { error } = await createClient().from("frames").update(v).eq("id", f.id);
      if (error) throw new Error(error.message);
      if (f.mask_url && f.mask_url !== v.mask_url) await deleteFiles({ urls: [f.mask_url] }).catch(() => 0);
      return true;
    } catch (e) { setMsg({ type: "err", text: e instanceof Error ? e.message : "Lưu vùng ảnh thất bại" }); return false; }
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
            <input ref={fileIn} type="file" multiple accept="image/*" className="sr-only" onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; if (fs.length) uploadMany(fs); }} />
            <Field label="Hoặc dán link ảnh khung" className="min-w-[240px] flex-1"><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." /></Field>
            <Button variant="secondary" onClick={addLink}>Thêm từ link</Button>
            <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => setRedo(true)}>Dò lại tất cả khung</Button>
            {busy && <span className="text-[12px] text-[#71717a]">{busy}</span>}
          </div>
          <p className="mb-3 text-[12px] text-[#71717a]">PNG nền trong suốt, ô ảnh ở giữa trong suốt. Mỗi khung tự dò vùng ảnh — kiểm tra lại ảnh xem trước, sửa bằng nút “Vùng ảnh”.</p>
          {list.length ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {list.map((f, i) => {
                const key = `${f.id}|${f.url}|${JSON.stringify(f.region)}|${f.mask_url}|${JSON.stringify(f.regions ?? null)}`;
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
                        {f.regions?.length ? <Badge tone="pink">{f.regions.length > 1 ? `${f.regions.length} vùng` : f.regions[0].kind === "quad" ? "4 góc" : "Theo hình dạng"}</Badge> : f.mask_url && <Badge tone="pink">Mặt nạ</Badge>}
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
      {edit && photo && <RegionEditor frame={edit} photo={photo} onClose={() => setEdit(null)} onSave={async (rs, mask) => { if (await saveHoles(edit, rs, mask)) { setEdit(null); await after("Đã lưu vùng ảnh."); } }} />}
      {redo && photo && <RedetectAll frames={frames} photo={photo} onClose={() => setRedo(false)} onSave={async (items) => {
        let n = 0;
        for (const it of items) if (await saveHoles(it.frame, it.holes, null)) n++;
        setRedo(false); await after(`Đã dò lại ${n} khung.`);
      }} />}
    </div>
  );
}

// ---------- vùng ảnh: tự dò mọi hình dạng · 4 góc ⇄ theo hình dạng · kéo / thêm / xoá điểm · ảnh mặt nạ tải tay · xem trước bằng ảnh thử ----------
const PINK = "#ff5fa2";
function RegionEditor({ frame, photo, onClose, onSave }: { frame: Frame; photo: HTMLCanvasElement; onClose: () => void; onSave: (rs: HoleRegion[], manualMask: string | null) => void }) {
  const manual0 = !frame.regions && frame.mask_url ? frame.mask_url : null;
  const [rs, setRs] = useState<HoleRegion[]>(frame.regions ?? (frame.region ? [rectQuad(frame.region)] : []));
  const [mask, setMask] = useState<string | null>(manual0);
  const [sel, setSel] = useState<number | null>(rs.length ? 0 : null);
  const [pt, setPt] = useState<number | null>(null);
  const [thr, setThr] = useState(32);
  const [grow, setGrow] = useState(() => { const g = frame.regions?.find((r) => r.kind === "mask")?.g; return g ? Math.round(g * 1000) / 1000 : -1; }); // -1: chưa biết cỡ ảnh
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState("");
  const [loupe, setLoupe] = useState<{ x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null), drag = useRef<{ r: number; i: number } | null>(null), maskIn = useRef<HTMLInputElement>(null);
  const growPx = nat && grow >= 0 ? Math.round(grow * nat.w) : 3;
  useEffect(() => { loadImg(frame.url).then((im) => { setNat({ w: im.naturalWidth, h: im.naturalHeight }); setGrow((g) => (g >= 0 ? g : 3 / im.naturalWidth)); }).catch(() => setErr("Không đọc được ảnh khung.")); }, [frame.url]);
  useEffect(() => {
    let off = false;
    const t = setTimeout(() => previewOf({ url: frame.url, region: unionBox(rs), mask_url: mask, regions: mask ? null : rs }, photo, 300).then((u) => { if (!off) setPreview(u); }).catch(() => {}), 150);
    return () => { off = true; clearTimeout(t); };
  }, [rs, mask]); // eslint-disable-line react-hooks/exhaustive-deps
  const setR = (i: number, f: (r: HoleRegion) => HoleRegion) => setRs((c) => c.map((r, j) => (j === i ? f(r) : r)));
  const withPts = (r: HoleRegion, pts: [number, number][]): HoleRegion => ({ ...r, pts, bbox: bboxOf(pts) });
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const posOf = (e: { clientX: number; clientY: number }) => { const b = box.current!.getBoundingClientRect(); return [clamp((e.clientX - b.left) / b.width), clamp((e.clientY - b.top) / b.height)] as [number, number]; };
  function onMove(e: React.PointerEvent) {
    if (!drag.current || !box.current) return;
    const p = posOf(e), { r, i } = drag.current;
    setR(r, (x) => withPts(x, x.pts.map((q, j) => (j === i ? p : q))));
    setLoupe({ x: p[0], y: p[1] });
  }
  // phím mũi tên: dịch điểm đang chọn 1px (Shift: 10px) theo ảnh khung
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (sel === null || pt === null || !nat || !e.key.startsWith("Arrow")) return;
      e.preventDefault();
      const s = (e.shiftKey ? 10 : 1), dx = e.key === "ArrowLeft" ? -s / nat.w : e.key === "ArrowRight" ? s / nat.w : 0, dy = e.key === "ArrowUp" ? -s / nat.h : e.key === "ArrowDown" ? s / nat.h : 0;
      setR(sel, (x) => withPts(x, x.pts.map((q, j) => (j === pt ? [clamp(q[0] + dx), clamp(q[1] + dy)] : q))));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  async function detect() {
    setErr(""); setBusy("Đang dò...");
    try {
      const im = await loadImg(frame.url);
      const h = await detectFrameHoles(im, { thr, grow: growPx });
      if (h.length) { setRs(h); setSel(0); setPt(null); setMask(null); }
      else setErr("Không tìm thấy lỗ trong suốt bên trong khung — chỉnh ngưỡng, kéo 4 góc hoặc tải ảnh mặt nạ.");
    } catch { setErr("Không đọc được ảnh khung."); }
    setBusy("");
  }
  function setGrowPx(v: number) {
    if (!nat) return;
    const g = v / nat.w; setGrow(g);
    setRs((c) => c.map((r) => (r.kind === "mask" ? { ...r, g } : r)));
  }
  function toggleKind(i: number) {
    setR(i, (r) => (r.kind === "mask" ? withPts({ ...r, kind: "quad", g: undefined }, quadFrom(r.pts)) : { ...r, kind: "mask", g: grow >= 0 ? grow : undefined }));
    setPt(null);
  }
  function addRect() { setRs((c) => [...c, rectQuad({ x0: 0.25, y0: 0.25, x1: 0.75, y1: 0.75 })]); setSel(rs.length); setPt(null); }
  async function upMask(f: File) {
    setBusy("Đang tải mặt nạ...");
    try { setMask(await uploadScrapbookAsset(f)); } catch (e) { setErr(e instanceof Error ? e.message : "Tải mặt nạ thất bại"); }
    setBusy("");
  }
  const disp = box.current?.getBoundingClientRect();
  const Z = 4, LS = 120; // kính lúp: phóng 4 lần, 120px
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={onClose}>
      <div className="max-h-[94dvh] w-full max-w-[900px] overflow-y-auto rounded-[12px] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-[16px] font-semibold">Vùng ảnh · {frame.name}</p>
        <p className="mb-3 text-[13px] text-[#71717a]">Bấm “Dò lại” để tự tìm các lỗ đặt ảnh (mọi hình dạng). Bấm vào 1 vùng để chỉnh: kéo điểm (phím mũi tên dịch 1px, Shift 10px) · “Theo hình dạng”: bấm vào cạnh để thêm điểm, bấm đúp vào điểm để xoá.</p>
        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <div ref={box} className={cx("relative w-full touch-none select-none", checker)} onPointerMove={onMove} onPointerUp={() => { drag.current = null; setLoupe(null); }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frame.url} alt="" className="block w-full" draggable={false} />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
              {rs.map((r, i) => (
                <g key={i}>
                  <polygon points={r.pts.map((p) => p.join(",")).join(" ")} fill={PINK} fillOpacity={sel === i ? 0.32 : 0.2} stroke={PINK} strokeWidth={sel === i ? 2 : 1.2} vectorEffect="non-scaling-stroke"
                    className="cursor-pointer" onPointerDown={() => { setSel(i); setPt(null); }} />
                  {sel === i && r.kind === "mask" && r.pts.map((p, j) => {
                    const q = r.pts[(j + 1) % r.pts.length];
                    return <line key={j} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="transparent" strokeWidth={12} vectorEffect="non-scaling-stroke" className="cursor-copy"
                      onPointerDown={(e) => { e.stopPropagation(); const np = posOf(e); setR(i, (x) => withPts(x, [...x.pts.slice(0, j + 1), np, ...x.pts.slice(j + 1)])); setPt(j + 1); drag.current = { r: i, i: j + 1 }; box.current?.setPointerCapture(e.pointerId); }} />;
                  })}
                </g>
              ))}
            </svg>
            {rs.map((r, i) => <span key={`n${i}`} className="pointer-events-none absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#ff5fa2] text-[12px] font-bold text-white shadow" style={{ left: `${((r.bbox.x0 + r.bbox.x1) / 2) * 100}%`, top: `${((r.bbox.y0 + r.bbox.y1) / 2) * 100}%` }}>{i + 1}</span>)}
            {sel !== null && rs[sel]?.pts.map((p, j) => (
              <span key={`p${j}`} onPointerDown={(e) => { e.stopPropagation(); box.current?.setPointerCapture(e.pointerId); drag.current = { r: sel, i: j }; setPt(j); }}
                onDoubleClick={() => { if (rs[sel].kind === "mask" && rs[sel].pts.length > 3) { setR(sel, (x) => withPts(x, x.pts.filter((_, k) => k !== j))); setPt(null); } }}
                className={cx("absolute -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border-2 border-white shadow", rs[sel].kind === "quad" ? "h-4 w-4" : "h-3 w-3", pt === j ? "bg-[#2563eb]" : "bg-[#ff5fa2]")}
                style={{ left: `${p[0] * 100}%`, top: `${p[1] * 100}%` }} />
            ))}
            {loupe && disp && (
              <span className="pointer-events-none absolute z-10 overflow-hidden rounded-full border-2 border-white shadow-lg"
                style={{ width: LS, height: LS, left: `calc(${loupe.x * 100}% - ${LS / 2}px)`, top: `calc(${loupe.y * 100}% - ${LS + 24}px)`, backgroundImage: `url(${frame.url})`, backgroundColor: "#fff", backgroundRepeat: "no-repeat",
                  backgroundSize: `${disp.width * Z}px ${disp.height * Z}px`, backgroundPosition: `${LS / 2 - loupe.x * disp.width * Z}px ${LS / 2 - loupe.y * disp.height * Z}px` }}>
                <span className="absolute left-1/2 top-0 h-full w-px bg-[#2563eb]/70" /><span className="absolute left-0 top-1/2 h-px w-full bg-[#2563eb]/70" />
              </span>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-[12px] text-[#71717a]">Xem trước bằng ảnh thử</p>
              <div className={cx("grid place-items-center rounded-[10px] p-2", checker)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {preview ? <img src={preview} alt="" className="max-h-[260px] max-w-full" /> : <span className="h-32" />}
              </div>
            </div>
            <div className="space-y-2 rounded-[10px] border border-[#e5e5e7] p-3 text-[12px] text-[#52525b]">
              <label className="block"><span className="flex justify-between">Ngưỡng trong suốt<span className="tabular-nums">{thr}</span></span>
                <input type="range" min={1} max={250} value={thr} onChange={(e) => setThr(Number(e.target.value))} className="w-full accent-[#ff5fa2]" /></label>
              <label className="block"><span className="flex justify-between">Nở mép (ảnh lấn dưới viền)<span className="tabular-nums">{growPx}px</span></span>
                <input type="range" min={0} max={20} value={growPx} onChange={(e) => setGrowPx(Number(e.target.value))} className="w-full accent-[#ff5fa2]" /></label>
              <Button size="sm" variant="secondary" icon={<Wand2 size={14} />} loading={busy === "Đang dò..."} onClick={detect}>Dò lại</Button>
            </div>
            {rs.length > 0 && (
              <ul className="space-y-1">
                {rs.map((r, i) => (
                  <li key={i} className={cx("flex items-center gap-2 rounded-[8px] border px-2 py-1.5 text-[12px]", sel === i ? "border-[#ff5fa2] bg-[#fff5f9]" : "border-[#e5e5e7]")}>
                    <button type="button" onClick={() => { setSel(i); setPt(null); }} className="font-semibold">Vùng {i + 1}</button>
                    <span className="inline-flex overflow-hidden rounded-full border border-[#e5e5e7]">
                      {(["quad", "mask"] as const).map((k) => <button key={k} type="button" onClick={() => r.kind !== k && toggleKind(i)} className={cx("px-2 py-0.5", r.kind === k ? "bg-[#ff5fa2] text-white" : "text-[#52525b]")}>{k === "quad" ? "4 góc" : "Theo hình dạng"}</button>)}
                    </span>
                    <span className="flex-1 text-right text-[#a1a1aa]">{r.pts.length} điểm</span>
                    <button type="button" onClick={() => { setRs((c) => c.filter((_, j) => j !== i)); setSel(null); setPt(null); }} aria-label="Xoá vùng" className="text-[#a1a1aa] hover:text-[#dc2626]"><Trash2 size={13} /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={addRect}>Thêm vùng 4 góc</Button>
              <Button size="sm" variant="secondary" icon={<Upload size={14} />} loading={busy === "Đang tải mặt nạ..."} onClick={() => maskIn.current?.click()}>{mask ? "Đổi ảnh mặt nạ" : "Tải ảnh mặt nạ"}</Button>
              {mask && <button type="button" onClick={() => setMask(null)} className="text-[12px] text-[#dc2626]">Bỏ mặt nạ</button>}
              <input ref={maskIn} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upMask(f); }} />
            </div>
            {mask && <p className="text-[11px] text-[#71717a]">Đang dùng ảnh mặt nạ tải lên (đen trắng, trắng = vùng ảnh) — các vùng chỉ dùng làm khung bao để phủ ảnh.</p>}
          </div>
        </div>
        {err && <p className="mt-2 text-[12px] text-[#dc2626]">{err}</p>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Huỷ</Button>
          <Button onClick={() => onSave(rs, mask)}>Lưu vùng ảnh</Button>
        </div>
      </div>
    </div>
  );
}

// ---------- dò lại tất cả khung (thuật toán mới) — chỉ khung chưa từng chỉnh tay: chưa có vùng ảnh, hoặc chữ nhật cũ mà thực ra là hình khác / nhiều lỗ ----------
function RedetectAll({ frames, photo, onClose, onSave }: { frames: Frame[]; photo: HTMLCanvasElement; onClose: () => void; onSave: (items: { frame: Frame; holes: HoleRegion[] }[]) => Promise<void> }) {
  const [items, setItems] = useState<{ frame: Frame; holes: HoleRegion[]; preview: string; on: boolean }[]>([]);
  const [done, setDone] = useState(0);
  const [saving, setSaving] = useState(false);
  const todo = useMemo(() => frames.filter((f) => !f.regions && !f.mask_url), [frames]); // có regions = đã dùng cách mới · có mask_url = mặt nạ tải tay
  useEffect(() => {
    let off = false;
    (async () => {
      for (const f of todo) {
        if (off) return;
        try {
          const img = await loadImg(f.url);
          const holes = await detectFrameHoles(img);
          // khung chữ nhật cũ đã có 4 điểm, dò ra vẫn đúng 1 chữ nhật → không đụng tới
          if (holes.length && (!f.region || needsMask(holes))) {
            const preview = await previewOf({ url: f.url, region: unionBox(holes), mask_url: null, regions: holes }, photo, 160);
            if (!off) setItems((c) => [...c, { frame: f, holes, preview, on: true }]);
          }
        } catch { /* bỏ khung lỗi */ }
        if (!off) setDone((d) => d + 1);
      }
    })();
    return () => { off = true; };
  }, [todo, photo]);
  const picked = items.filter((x) => x.on);
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-[860px] overflow-y-auto rounded-[12px] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-[16px] font-semibold">Dò lại tất cả khung</p>
        <p className="mb-3 text-[13px] text-[#71717a]">Chỉ xét khung chưa từng chỉnh tay. Khung chữ nhật đã có 4 điểm được giữ nguyên. Đã xét {done} / {todo.length} khung · {items.length} khung sẽ đổi.</p>
        {items.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((it, i) => (
              <li key={it.frame.id} className={cx("overflow-hidden rounded-[10px] border", it.on ? "border-[#ff5fa2]" : "border-[#e5e5e7] opacity-60")}>
                <div className={cx("grid aspect-square place-items-center p-2", checker)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.preview} alt="" className="max-h-full max-w-full object-contain" />
                </div>
                <label className="flex items-center gap-1.5 px-2 py-1.5 text-[12px]">
                  <input type="checkbox" className="accent-[#ff5fa2]" checked={it.on} onChange={(e) => setItems((c) => c.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} />
                  <span className="min-w-0 flex-1 truncate" title={it.frame.name}>{it.frame.name}</span>
                  <span className="text-[#a1a1aa]">{it.holes.length > 1 ? `${it.holes.length} vùng` : it.holes[0].kind === "quad" ? "4 góc" : "hình"}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : <p className="rounded-[10px] bg-[#fafafa] p-4 text-[13px] text-[#71717a]">{done < todo.length ? "Đang dò..." : "Không có khung nào cần dò lại."}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Huỷ</Button>
          <Button loading={saving} disabled={!picked.length || done < todo.length} onClick={async () => { setSaving(true); await onSave(picked.map(({ frame, holes }) => ({ frame, holes }))); setSaving(false); }}>Lưu {picked.length} khung</Button>
        </div>
      </div>
    </div>
  );
}
