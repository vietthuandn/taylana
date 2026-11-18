"use client";

/* Trình tạo mẫu khung CD (full màn hình): canvas lớn bên trái, panel 320px bên phải.
   Ảnh khung: link hoặc upload (bucket "mockups"). Vùng: tự nhận diện từ kênh alpha hoặc tự kéo 4 góc
   (kính lúp ×4, phím mũi tên 1px, Shift 10px). Toạ độ lưu theo tỉ lệ 0..1 so với ảnh khung. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Plus, ScanSearch, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadMockupImage } from "@/lib/upload";
import { loadImg, proxied } from "@/lib/mockup/images";
import { renderFrame, sampleImage } from "@/lib/mockup/render";
import { apply, squareToQuad } from "@/lib/mockup/homography";
import { DEFAULT_DISC_HOLE, DISC_CM, MAX_REGIONS, REGION_LABELS, defaultGlass, newRegion, type GlassSettings, type MockupFrame, type Pt, type Region, type RegionType } from "@/lib/mockup/types";
import { revalidatePublic } from "@/app/admin/actions";
import { Button, Field, Input, Message, Select, Toggle } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

type Msg = { type: "ok" | "err"; text: string } | null;
const TYPES = Object.keys(REGION_LABELS) as RegionType[];

// ---------- Tự nhận diện vùng trong suốt bên trong ảnh ----------
function detectRegions(img: HTMLImageElement): Region[] {
  const max = 600, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, w, h);
  const a = x.getImageData(0, 0, w, h).data;
  const seen = new Uint8Array(w * h);
  const found: { area: number; quad: [Pt, Pt, Pt, Pt]; fill: number; aspect: number }[] = [];
  const stack: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || a[s * 4 + 3] >= 128) continue;
    let area = 0, border = false, minX = w, maxX = 0, minY = h, maxY = 0;
    let tl = [0, 0, Infinity], tr = [0, 0, -Infinity], br = [0, 0, -Infinity], bl = [0, 0, Infinity];
    stack.push(s); seen[s] = 1;
    while (stack.length) {
      const p = stack.pop()!, px = p % w, py = (p / w) | 0;
      area++;
      if (px === 0 || py === 0 || px === w - 1 || py === h - 1) border = true;
      if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py;
      if (px + py < tl[2]) tl = [px, py, px + py];
      if (px - py > tr[2]) tr = [px, py, px - py];
      if (px + py > br[2]) br = [px, py, px + py];
      if (px - py < bl[2]) bl = [px, py, px - py];
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q < 0 || q >= w * h || seen[q]) continue;
        if ((q === p - 1 && px === 0) || (q === p + 1 && px === w - 1)) continue;
        if (a[q * 4 + 3] < 128) { seen[q] = 1; stack.push(q); }
      }
    }
    if (border || area < w * h * 0.01) continue; // bỏ vùng ở viền ngoài và vùng < 1% diện tích
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    found.push({ area, fill: area / (bw * bh), aspect: bw / bh, quad: [[tl[0] / w, tl[1] / h], [(tr[0] + 1) / w, tr[1] / h], [(br[0] + 1) / w, (br[1] + 1) / h], [bl[0] / w, (bl[1] + 1) / h]] });
    // mặt đĩa (gần tròn / elip): dùng 4 góc khung bao để đĩa phủ kín vùng
    const last = found[found.length - 1];
    if (last.fill > 0.66 && last.fill < 0.86) last.quad = [[minX / w, minY / h], [(maxX + 1) / w, minY / h], [(maxX + 1) / w, (maxY + 1) / h], [minX / w, (maxY + 1) / h]];
  }
  found.sort((p, q) => q.area - p.area);
  const order: RegionType[] = ["front_out", "back_out", "front_in", "back_in"];
  let oi = 0;
  return found.slice(0, MAX_REGIONS).map((f, i) => {
    const disc = f.fill > 0.66 && f.fill < 0.86 && f.aspect > 0.5 && f.aspect < 2;
    const r = newRegion(disc ? "disc" : order[oi++ % order.length], i + 1);
    r.pts = f.quad;
    return r;
  });
}

export function FrameEditor({ id }: { id: string }) {
  const router = useRouter();
  const isNew = id === "moi";
  const [f, setF] = useState<MockupFrame>({ id: "", name: "Mẫu mới", image_url: "", source: "url", regions: [], glass: defaultGlass, is_active: true, sort_order: 0 });
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [imgErr, setImgErr] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [corner, setCorner] = useState(0);
  const [preview, setPreview] = useState(false);
  const [test, setTest] = useState<HTMLImageElement | null>(null);
  const [prevCanvas, setPrevCanvas] = useState<string>("");
  const [msg, setMsg] = useState<Msg>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [box, setBox] = useState({ w: 800, h: 600 });
  // ci = 0..3: kéo 1 góc · ci = -1: kéo cả vùng (start = điểm bấm, pts0 = 4 góc lúc bấm)
  const [drag, setDrag] = useState<{ ri: string; ci: number; x: number; y: number; start?: Pt; pts0?: Region["pts"] } | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const testIn = useRef<HTMLInputElement>(null);
  const lens = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isNew) return;
    createClient().from("mockup_frames").select("*").eq("id", id).maybeSingle().then(({ data, error }) => {
      if (error || !data) return setMsg({ type: "err", text: error?.message ?? "Không tìm thấy mẫu" });
      // vùng đĩa lưu với tỉ lệ lỗ cũ (12,5%) → đổi sang mặc định 2,3 / 12 cm
      const regions = ((data.regions ?? []) as Region[]).map((r) => (r.type === "disc" && (r.hole == null || r.hole === 0.125) ? { ...r, hole: DEFAULT_DISC_HOLE } : r));
      setF({ ...(data as MockupFrame), regions, glass: { ...defaultGlass, ...(data.glass ?? {}) } });
    });
  }, [id, isNew]);
  useEffect(() => {
    if (!f.image_url) { setImg(null); return; }
    setImgErr("");
    loadImg(f.image_url).then(setImg).catch(() => { setImg(null); setImgErr("Không tải được ảnh khung từ link này."); });
  }, [f.image_url]);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const iw = img?.naturalWidth ?? 1000, ih = img?.naturalHeight ?? 750;
  const k = Math.min((box.w - 48) / iw, (box.h - 48) / ih);
  const dw = iw * k, dh = ih * k, ox = (box.w - dw) / 2, oy = (box.h - dh) / 2;
  const cur = f.regions.find((r) => r.id === sel) ?? null;
  const setRegion = (rid: string, p: Partial<Region>) => setF((x) => ({ ...x, regions: x.regions.map((r) => (r.id === rid ? { ...r, ...p } : r)) }));

  // xem trước trực tiếp bằng ảnh mẫu (lưới màu có số) hoặc ảnh thử
  const samples = useMemo(() => Object.fromEntries(TYPES.map((t) => [t, sampleImage(t)])), []);
  useEffect(() => {
    if (!preview || !img) return;
    let off = false;
    const t = setTimeout(async () => {
      const masks: Record<string, HTMLImageElement> = {};
      for (const r of f.regions) if (r.mask_url && !masks[r.mask_url]) masks[r.mask_url] = await loadImg(r.mask_url).catch(() => undefined as unknown as HTMLImageElement);
      const images = Object.fromEntries(TYPES.map((tp) => [tp, test ?? samples[tp]]));
      const c = renderFrame({ frame: img, regions: f.regions, images, masks, glass: f.glass, maxW: 1400 });
      if (!off) setPrevCanvas(c.toDataURL("image/png"));
    }, 120);
    return () => { off = true; clearTimeout(t); };
  }, [preview, img, f.regions, f.glass, test, samples]);

  // kính lúp ×4 khi kéo góc
  useEffect(() => {
    const c = lens.current;
    if (!c || !drag || drag.ci < 0 || !img) return;
    const x = c.getContext("2d")!, S = 160, Z = 4;
    x.clearRect(0, 0, S, S);
    x.imageSmoothingEnabled = false;
    const px = drag.x * iw, py = drag.y * ih, src = S / Z;
    x.fillStyle = "#fff"; x.fillRect(0, 0, S, S);
    x.drawImage(img, px - src / 2, py - src / 2, src, src, 0, 0, S, S);
    x.strokeStyle = "#ff5fa2"; x.lineWidth = 1;
    x.beginPath(); x.moveTo(S / 2, 0); x.lineTo(S / 2, S); x.moveTo(0, S / 2); x.lineTo(S, S / 2); x.stroke();
  }, [drag, img, iw, ih]);

  const toFrac = useCallback((cx: number, cy: number): Pt => {
    const r = area.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (cx - r.left - ox) / dw)), Math.min(1, Math.max(0, (cy - r.top - oy) / dh))];
  }, [ox, oy, dw, dh]);

  // phím mũi tên: dịch góc đang chọn 1px (Shift 10px)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!cur || (e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d) return;
      e.preventDefault();
      const st = e.shiftKey ? 10 : 1;
      const pts = cur.pts.map((p) => [...p]) as Region["pts"];
      pts[corner] = [Math.min(1, Math.max(0, pts[corner][0] + (d[0] * st) / iw)), Math.min(1, Math.max(0, pts[corner][1] + (d[1] * st) / ih))];
      setRegion(cur.id, { pts });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  async function save() {
    if (!f.name.trim()) return setMsg({ type: "err", text: "Cần đặt tên mẫu." });
    if (!f.image_url) return setMsg({ type: "err", text: "Cần ảnh khung (link hoặc upload)." });
    setSaving(true);
    const payload = { name: f.name.trim(), image_url: f.image_url, source: f.image_url.includes("/storage/v1/object/public/mockups/") ? "storage" : "url", regions: f.regions, glass: f.glass, is_active: f.is_active };
    const sb = createClient();
    const res = isNew
      ? await sb.from("mockup_frames").insert({ ...payload, sort_order: Date.now() % 100000 }).select("id").single()
      : await sb.from("mockup_frames").update(payload).eq("id", f.id).select("id").single();
    setSaving(false);
    if (res.error) return setMsg({ type: "err", text: res.error.message.includes("Tối đa 5") ? "Đã đủ 5 mẫu khung — xoá bớt mẫu cũ trước." : res.error.message });
    await revalidatePublic(["/thiet-ke/mockup"]);
    setMsg({ type: "ok", text: "Đã lưu mẫu." });
    if (isNew) router.replace(`/admin/mockup/${res.data.id}`);
  }
  function autoDetect() {
    if (!img) return setMsg({ type: "err", text: "Chưa tải được ảnh khung." });
    let found: Region[] = [];
    try { found = detectRegions(img); } catch { return setMsg({ type: "err", text: "Không đọc được kênh trong suốt của ảnh (ảnh bị chặn CORS). Lưu mẫu rồi thử lại." }); }
    if (!found.length) return setMsg({ type: "err", text: "Không tìm thấy vùng trong suốt nào bên trong ảnh. Hãy bấm “Thêm vùng” và kéo 4 góc." });
    setF((x) => ({ ...x, regions: found }));
    setSel(found[0].id);
    setMsg({ type: "ok", text: `Tìm thấy ${found.length} vùng — kiểm tra lại loại vùng và 4 góc.` });
  }

  const handle = "cursor-grab fill-white stroke-[#ff5fa2]";
  return (
    <div className="relative flex h-[calc(100dvh-56px)] flex-col overflow-hidden bg-white">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-[#e5e5e7] px-3">
        <Link href="/admin/mockup" className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#e5e5e7] px-3 text-[13px] font-medium hover:bg-[#f4f4f5]"><ArrowLeft size={16} /> Danh sách mẫu</Link>
        <input className="h-8 min-w-0 flex-1 rounded-[6px] border border-transparent px-2 text-[14px] font-semibold hover:border-[#e5e5e7] focus:border-[#ff5fa2] focus:outline-none sm:max-w-sm"
          value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Tên mẫu" />
        <Button size="sm" className="ml-auto" loading={saving} onClick={save}>Lưu mẫu</Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ---------- Canvas ---------- */}
        <div ref={area} className="relative min-h-[420px] min-w-0 flex-1 select-none overflow-hidden bg-[repeating-conic-gradient(#ececee_0_25%,#f7f7f8_0_50%)] bg-[length:20px_20px]"
          onPointerMove={(e) => {
            if (!drag || !cur) return;
            const p = toFrac(e.clientX, e.clientY);
            if (drag.ci === -1 && drag.start && drag.pts0) {
              // di chuyển cả vùng, giữ trong khung ảnh
              let dx = p[0] - drag.start[0], dy = p[1] - drag.start[1];
              const xs = drag.pts0.map((q) => q[0]), ys = drag.pts0.map((q) => q[1]);
              dx = Math.min(1 - Math.max(...xs), Math.max(-Math.min(...xs), dx));
              dy = Math.min(1 - Math.max(...ys), Math.max(-Math.min(...ys), dy));
              setRegion(cur.id, { pts: drag.pts0.map(([x, y]) => [x + dx, y + dy]) as Region["pts"] });
              return;
            }
            const pts = cur.pts.map((q) => [...q]) as Region["pts"];
            pts[drag.ci] = p;
            setRegion(cur.id, { pts });
            setDrag({ ...drag, x: p[0], y: p[1] });
          }}
          onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>
          {!f.image_url ? <p className="absolute inset-0 grid place-items-center text-[14px] text-[#71717a]">Dán link hoặc upload ảnh khung ở panel bên phải.</p>
            : imgErr ? <p className="absolute inset-0 grid place-items-center text-[14px] text-[#dc2626]">{imgErr}</p> : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview && prevCanvas ? prevCanvas : proxied(f.image_url)} alt="" draggable={false} className="pointer-events-none absolute" style={{ left: ox, top: oy, width: dw, height: dh }} />
                <svg className="absolute inset-0 h-full w-full">
                  {f.regions.map((r) => {
                    const on = r.id === sel;
                    const pts = r.pts.map(([x, y]) => [ox + x * dw, oy + y * dh]);
                    return (
                      <g key={r.id}>
                        <polygon points={pts.map((p) => p.join(",")).join(" ")}
                          onPointerDown={(e) => { setSel(r.id); (e.target as Element).setPointerCapture?.(e.pointerId); setDrag({ ri: r.id, ci: -1, x: 0, y: 0, start: toFrac(e.clientX, e.clientY), pts0: r.pts }); }}
                          className={cx(on ? "cursor-move" : "cursor-pointer", r.type === "disc" ? "fill-transparent" : on ? "fill-[#ff5fa2]/15" : "fill-[#18181b]/5", on ? "stroke-[#ff5fa2]" : "stroke-[#18181b]/50")}
                          strokeWidth={on ? (r.type === "disc" ? 1 : 2) : 1} strokeDasharray={on && r.type !== "disc" ? undefined : "4 3"} />
                        {r.type === "disc" && (() => {
                          // hình tròn của đĩa kéo theo phối cảnh (thành elip) + lỗ tâm
                          const H3 = squareToQuad(pts as [number, number][]);
                          const ring = (rad: number) => Array.from({ length: 73 }, (_, i) => {
                            const a = (i / 72) * Math.PI * 2;
                            return apply(H3, 0.5 + rad * Math.cos(a), 0.5 + rad * Math.sin(a)).join(",");
                          }).join(" ");
                          const hole = (r.hole ?? DEFAULT_DISC_HOLE) / 2;
                          return (
                            <g className="pointer-events-none">
                              <polygon points={ring(0.5)} className={on ? "fill-[#ff5fa2]/15 stroke-[#ff5fa2]" : "fill-[#18181b]/5 stroke-[#18181b]/50"} strokeWidth={on ? 2 : 1} />
                              <polygon points={ring(hole)} className="fill-white/70 stroke-[#ff5fa2]" strokeWidth={1.5} strokeDasharray="3 2" />
                            </g>
                          );
                        })()}
                        <text x={pts[0][0] + 6} y={pts[0][1] + 16} className="pointer-events-none fill-[#18181b] text-[11px] font-semibold">{REGION_LABELS[r.type]}</text>
                        {on && pts.map((p, ci) => (
                          <circle key={ci} cx={p[0]} cy={p[1]} r={corner === ci ? 8 : 6} className={handle} strokeWidth={2}
                            onPointerDown={(e) => { e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId); setCorner(ci); setDrag({ ri: r.id, ci, x: r.pts[ci][0], y: r.pts[ci][1] }); }} />
                        ))}
                      </g>
                    );
                  })}
                </svg>
                {drag && drag.ci >= 0 && <canvas ref={lens} width={160} height={160} className="pointer-events-none absolute left-4 top-4 rounded-full border-2 border-[#ff5fa2] bg-white shadow-lg" />}
              </>
            )}
        </div>

        {/* ---------- Panel 320px ---------- */}
        <aside className="relative space-y-5 overflow-y-auto border-[#e5e5e7] p-4 text-[13px] lg:w-[320px] lg:shrink-0 lg:border-l">
          <section className="space-y-2">
            <p className="text-[13px] font-semibold">Ảnh khung</p>
            <Input value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value.trim() })} placeholder="Dán link ảnh PNG..." />
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" icon={<Upload size={16} />} loading={uploading} onClick={() => fileIn.current?.click()}>Upload</Button>
              <input ref={fileIn} type="file" accept="image/png,image/webp,image/jpeg" className="sr-only" onChange={async (e) => {
                const file = e.target.files?.[0]; e.target.value = "";
                if (!file) return;
                setUploading(true);
                try { setF((x) => ({ ...x, image_url: "" })); const u = await uploadMockupImage(file); setF((x) => ({ ...x, image_url: u })); }
                catch (er) { setMsg({ type: "err", text: er instanceof Error ? er.message : "Upload thất bại" }); }
                setUploading(false);
              }} />
            </div>
            <p className="text-[12px] text-[#71717a]">Khuyến nghị PNG có các vùng trong suốt (nơi chèn ảnh khách), bóng đổ có sẵn trong ảnh.</p>
          </section>

          <section className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={<ScanSearch size={16} />} onClick={autoDetect} disabled={!img}>Tự nhận diện vùng</Button>
              <Button variant="secondary" size="sm" icon={<Plus size={16} />} disabled={f.regions.length >= MAX_REGIONS}
                onClick={() => { const r = newRegion(TYPES[f.regions.length % TYPES.length], f.regions.length + 1); setF({ ...f, regions: [...f.regions, r] }); setSel(r.id); }}>Thêm vùng</Button>
            </div>
            <p className="text-[12px] text-[#71717a]">Tối đa {MAX_REGIONS} vùng. Kéo 4 góc để chỉnh, kéo bên trong vùng để di chuyển cả vùng; phím mũi tên dịch góc đang chọn 1px (Shift: 10px).</p>
            <ul className="space-y-1">
              {f.regions.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setSel(r.id)}
                    className={cx("flex w-full items-center justify-between rounded-[8px] border px-3 py-2 text-left", r.id === sel ? "border-[#ff5fa2] bg-[#fff5f9]" : "border-[#e5e5e7] hover:bg-[#fafafa]")}>
                    <span>{REGION_LABELS[r.type]}</span><span className="text-[12px] text-[#71717a]">Lớp {r.order}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {cur && (
            <section className="space-y-3 rounded-[10px] border border-[#e5e5e7] bg-[#fafafa] p-3">
              <p className="font-semibold">Vùng đang chọn</p>
              <Field label="Loại vùng">
                <Select value={cur.type} onChange={(e) => setRegion(cur.id, { type: e.target.value as RegionType, glass: e.target.value !== "disc", ...(e.target.value === "disc" && cur.hole == null ? { hole: DEFAULT_DISC_HOLE } : {}) })}>
                  {TYPES.map((t) => <option key={t} value={t}>{REGION_LABELS[t]}</option>)}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Thứ tự lớp"><Input type="number" min={1} max={MAX_REGIONS * 2} value={cur.order} onChange={(e) => setRegion(cur.id, { order: Number(e.target.value) })} /></Field>
                <Field label="Hoà trộn">
                  <Select value={cur.blend} onChange={(e) => setRegion(cur.id, { blend: e.target.value as Region["blend"] })}>
                    <option value="normal">Thường</option><option value="multiply">Multiply</option>
                  </Select>
                </Field>
              </div>
              <Toggle checked={cur.glass} onChange={(v) => setRegion(cur.id, { glass: v })} label="Có lớp kính" />
              {(cur.type === "back_out" || cur.type === "back_in") && (
                <Field label="Gáy bìa sau">
                  <Select value={cur.spine ?? "show"} onChange={(e) => setRegion(cur.id, { spine: e.target.value as Region["spine"] })}>
                    <option value="show">Hiện cả gáy</option><option value="trim">Bỏ 2 dải gáy</option>
                  </Select>
                </Field>
              )}
              {cur.type === "disc" && (
                <Field label={`Lỗ tâm: ${((cur.hole ?? DEFAULT_DISC_HOLE) * DISC_CM).toFixed(1)} cm (đĩa ${DISC_CM} cm)`} hint="Mặc định 2,3 cm. Kéo 4 góc để hình tròn khớp mặt đĩa trên ảnh khung.">
                  <input type="range" min={0} max={0.4} step={0.0025} value={cur.hole ?? DEFAULT_DISC_HOLE} onChange={(e) => setRegion(cur.id, { hole: Number(e.target.value) })} className="w-full accent-[#ff5fa2]" />
                </Field>
              )}
              <Field label="Mặt nạ PNG (không bắt buộc)">
                <div className="flex gap-2">
                  <Input value={cur.mask_url ?? ""} onChange={(e) => setRegion(cur.id, { mask_url: e.target.value.trim() || null })} placeholder="Link PNG..." />
                  <label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-[8px] border border-[#e5e5e7] bg-white hover:bg-[#f4f4f5]" title="Upload mặt nạ">
                    <Upload size={16} />
                    <input type="file" accept="image/png" className="sr-only" onChange={async (e) => {
                      const file = e.target.files?.[0]; e.target.value = "";
                      if (!file) return;
                      try { setRegion(cur.id, { mask_url: await uploadMockupImage(file, "masks") }); } catch (er) { setMsg({ type: "err", text: er instanceof Error ? er.message : "Upload thất bại" }); }
                    }} />
                  </label>
                </div>
              </Field>
              <Button variant="danger" size="sm" icon={<Trash2 size={16} />} onClick={() => { setF({ ...f, regions: f.regions.filter((r) => r.id !== cur.id) }); setSel(null); }}>Xoá vùng</Button>
            </section>
          )}

          <section className="space-y-2">
            <p className="font-semibold">Lớp kính</p>
            <Field label={`Độ mạnh: ${f.glass.strength}%`}>
              <input type="range" min={0} max={100} value={f.glass.strength} onChange={(e) => setF({ ...f, glass: { ...f.glass, strength: Number(e.target.value) } as GlassSettings })} className="w-full accent-[#ff5fa2]" />
            </Field>
            <Field label={`Góc dải sáng: ${f.glass.angle}°`}>
              <input type="range" min={-90} max={90} value={f.glass.angle} onChange={(e) => setF({ ...f, glass: { ...f.glass, angle: Number(e.target.value) } })} className="w-full accent-[#ff5fa2]" />
            </Field>
          </section>

          <section className="space-y-2">
            <p className="font-semibold">Xem trước</p>
            <div className="flex flex-wrap gap-2">
              <Button variant={preview ? "primary" : "secondary"} size="sm" icon={preview ? <EyeOff size={16} /> : <Eye size={16} />} onClick={() => setPreview(!preview)}>
                {preview ? "Tắt xem trước" : "Xem trước"}
              </Button>
              <Button variant="secondary" size="sm" icon={<Upload size={16} />} onClick={() => testIn.current?.click()}>Ảnh thử</Button>
              {test && <Button variant="ghost" size="sm" onClick={() => setTest(null)}>Dùng ảnh mẫu</Button>}
              <input ref={testIn} type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                const file = e.target.files?.[0]; e.target.value = "";
                if (file) { setTest(await loadImg(URL.createObjectURL(file))); setPreview(true); }
              }} />
            </div>
            <p className="text-[12px] text-[#71717a]">Ảnh mẫu là lưới màu có số 1–4 ở 4 góc để kiểm tra hướng ảnh.</p>
          </section>

          <Toggle checked={f.is_active} onChange={(v) => setF({ ...f, is_active: v })} label="Hiện cho khách" />
        </aside>
      </div>
      <Message msg={msg} />
    </div>
  );
}
