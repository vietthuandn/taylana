"use client";

import { useMemo, useRef, useState } from "react";
import { BACK_SPINE_MM, SPECS, mmToPx, sizeText } from "@/lib/print";
import { INNER_SPINE_FROM_CM, INNER_SPINE_TO_CM, TRAY_DISC_DIAMETER_CM, TRAY_DISC_HOLE_CM } from "@/lib/cdSpecs";
import { targetLabels, type DesignBase, type DesignTemplate } from "@/lib/templates";
import type { Package } from "@/lib/types";
import { CdDesigner, FONTS, PX_UNIT, SIZE_PRESETS, TEXT_COLORS, type CdDesignerHandle, type Half } from "@/components/cd-editor/CdDesigner";
import { ColorSelect } from "@/components/cd-editor/ColorSelect";
import { Icon } from "@/components/cd-editor/icons";
import { SpineEditor, emptySide, type SpineSide, type SpineText, type Zone } from "@/components/designer/Spine";
import { TemplateThumb } from "@/components/designer/TemplateThumb";
import { OrderDialog, downloadBlob, type DesignFile } from "@/components/designer/OrderDialog";
import { useSize } from "@/components/designer/useSize";

type Part = "front" | "back" | "disc";
const PARTS: Part[] = ["front", "back", "disc"];
// "Khung chứa" = 1 canvas. s23/s45/s67 là trải đôi (2 trang cạnh nhau, phần tử kéo tràn được).
type Box = "f1" | "f2" | "s23" | "s45" | "s67" | "f8" | "b1" | "b2" | "d1";
const ALL_BOXES: Box[] = ["f1", "f2", "s23", "s45", "s67", "f8", "b1", "b2", "d1"];
const SPREAD_BOXES: Box[] = ["s23", "s45", "s67"];
const partOfBox = (b: Box): Part => (b[0] === "b" ? "back" : b[0] === "d" ? "disc" : "front");
type PageDef = { id: string; box: Box; half: Half; part: Part; label: string; kind: string; page: number | null };

const FRONT_COUNTS = [1, 2, 4, 8] as const;
const BACK_COUNTS = [1, 2] as const;

function pagesOf(frontN: number, backN: number): PageDef[] {
  const P = (n: number, box: Box, half: Half): PageDef => ({ id: `P${n}`, box, half, part: "front", label: String(n), kind: "booklet", page: n });
  const front: PageDef[] =
    frontN === 1 ? [{ id: "F-out", box: "f1", half: "all", part: "front", label: "Bìa Trước - Mặt Ngoài", kind: "front", page: 1 }]
    : frontN === 2 ? [{ id: "F-out", box: "f1", half: "all", part: "front", label: "Bìa Trước - Mặt Ngoài", kind: "front", page: 1 },
                      { id: "F-in", box: "f2", half: "all", part: "front", label: "Bìa Trước - Mặt Trong", kind: "front", page: 2 }]
    : frontN === 4 ? [P(1, "f1", "all"), P(2, "s23", "L"), P(3, "s23", "R"), P(4, "s45", "L")]
    : [P(1, "f1", "all"), P(2, "s23", "L"), P(3, "s23", "R"), P(4, "s45", "L"), P(5, "s45", "R"), P(6, "s67", "L"), P(7, "s67", "R"), P(8, "f8", "all")];
  const back: PageDef[] = [
    { id: "B-out", box: "b1", half: "all", part: "back", label: "Bìa Sau - Mặt Ngoài", kind: "back", page: 1 },
    ...(backN === 2 ? [{ id: "B-in", box: "b2" as Box, half: "all" as Half, part: "back" as Part, label: "Bìa Sau - Mặt Trong", kind: "back", page: 2 }] : []),
  ];
  return [...front, ...back, { id: "D", box: "d1", half: "all", part: "disc", label: "Mặt Đĩa", kind: "disc", page: null }];
}
// Chế độ "Trải đôi": 1 | 2–3 | 4–5 | 6–7 | 8 (4 trang: 1 | 2–3 | 4)
type Group = { id: string; label: string; box: Box; view: Half; pages: PageDef[] };
function groupsOf(pages: PageDef[]): Group[] {
  const bk = pages.filter((p) => p.kind === "booklet");
  const out: Group[] = [];
  for (const p of bk) {
    const last = out[out.length - 1];
    if (last && last.box === p.box && SPREAD_BOXES.includes(p.box)) { last.pages.push(p); last.label = `${last.pages[0].label}–${p.label}`; last.view = "all"; }
    else out.push({ id: `G${p.label}`, label: p.label, box: p.box, view: p.half, pages: [p] });
  }
  return out;
}

// Bìa sau: số đo (px bản in) từ lib/cdSpecs.ts
const BW = mmToPx(SPECS.back.w);
const BH = mmToPx(SPECS.back.h);
const GAY = mmToPx(BACK_SPINE_MM);
const IN_FROM = mmToPx(INNER_SPINE_FROM_CM * 10);
const IN_TO = mmToPx(INNER_SPINE_TO_CM * 10);
const TRAY = { cx: (IN_TO + (BW - GAY)) / 2, cy: BH / 2, r: mmToPx(TRAY_DISC_DIAMETER_CM * 5), hole: mmToPx(TRAY_DISC_HOLE_CM * 5) };
type ZoneId = "b1-left" | "b1-right" | "b2-spine";
const ZONE: Record<ZoneId, { box: Box; title: string; x: number; w: number; dir: "cw" | "ccw"; cm: number }> = {
  "b1-left": { box: "b1", title: "gáy trái", x: 0, w: GAY, dir: "cw", cm: BACK_SPINE_MM / 10 },
  "b1-right": { box: "b1", title: "gáy phải", x: BW - GAY, w: GAY, dir: "ccw", cm: BACK_SPINE_MM / 10 },
  "b2-spine": { box: "b2", title: "Spine", x: IN_FROM, w: IN_TO - IN_FROM, dir: "cw", cm: INNER_SPINE_TO_CM - INNER_SPINE_FROM_CM },
};

export function CustomCdEditor({ templates, packages }: { templates: DesignTemplate[]; packages: Package[] }) {
  const [frontN, setFrontN] = useState(1);
  const [backN, setBackN] = useState(1);
  const [activeId, setActiveId] = useState("F-out");
  const [spreadView, setSpreadView] = useState(false);
  const [groupId, setGroupId] = useState("G1");
  const [tplTarget, setTplTarget] = useState<0 | 1>(0); // trải đôi: chọn mẫu cho trang trái/phải
  const [chosen, setChosen] = useState<Record<string, string>>({}); // `${box}-${0|1}` → id mẫu
  const [mounted, setMounted] = useState<Box[]>(["f1", "b1", "d1"]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [guides, setGuides] = useState(true);
  const [zoneData, setZoneData] = useState<Record<ZoneId, SpineSide>>({ "b1-left": emptySide(), "b1-right": emptySide(), "b2-spine": emptySide() });
  const [spineMode, setSpineMode] = useState<ZoneId | null>(null);
  const [spineBg, setSpineBg] = useState<HTMLCanvasElement | null>(null);
  const [spineSel, setSpineSel] = useState<string | null>(null);
  const [trayOn, setTrayOn] = useState(true);
  const [areaRef, area] = useSize<HTMLDivElement>();
  const handles = useRef<Record<string, CdDesignerHandle | null>>({});
  const [hosts, setHosts] = useState<Record<string, HTMLDivElement | null>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ordering, setOrdering] = useState(false);

  const pages = pagesOf(frontN, backN);
  const booklet = frontN >= 4;
  const groups = groupsOf(pages);
  const activePage = pages.find((p) => p.id === activeId) ?? pages[0];
  const part = activePage.part;
  const inSpread = booklet && part === "front" && spreadView;
  const group = groups.find((g) => g.id === groupId) ?? groups[0];
  // canvas đang hiện
  const cur = inSpread ? { box: group.box, view: group.view, label: group.pages.map((p) => p.label).join(" – ") }
    : { box: activePage.box, view: activePage.half, label: activePage.label };
  const curPart = partOfBox(cur.box);
  const boxes = ALL_BOXES.filter((b) => mounted.includes(b) || pages.some((p) => p.box === b));

  function openPage(id: string) {
    const p = pages.find((x) => x.id === id) ?? pagesOf(frontN, backN).find((x) => x.id === id);
    setActiveId(id);
    setSpineMode(null);
    if (p) { setMounted((m) => (m.includes(p.box) ? m : [...m, p.box])); const g = groupsOf(pages).find((g) => g.pages.some((x) => x.id === id)); if (g) setGroupId(g.id); }
  }
  function setCount(pt: Part, n: number) {
    const next = pt === "front" ? pagesOf(n, backN) : pagesOf(frontN, n);
    if (pt === "front") setFrontN(n); else setBackN(n);
    setMounted((m) => Array.from(new Set([...m, ...next.map((x) => x.box)])));
    if (!next.some((x) => x.id === activeId)) { const first = next.find((x) => x.part === pt)!; setActiveId(first.id); }
    if (pt === "front" && n < 4) setSpreadView(false);
    setGroupId("G1");
  }

  // Mẫu cho từng khung chứa (giữ nguyên mảng khi không đổi → không reset thiết kế)
  const tplCache = useRef<Record<string, { key: string; arr: (DesignBase | null)[] }>>({});
  const templatesFor = (box: Box) => {
    const pt = partOfBox(box);
    const ids = SPREAD_BOXES.includes(box) ? [chosen[`${box}-0`] ?? "", chosen[`${box}-1`] ?? ""] : [chosen[`${box}-0`] ?? ""];
    const key = ids.join("|");
    const c = tplCache.current[box];
    if (c && c.key === key) return c.arr;
    const arr = ids.map((id) => templates.find((t) => t.target === pt && t.id === id) ?? null);
    tplCache.current[box] = { key, arr };
    return arr;
  };

  // Vùng gáy / Spine cho 2 trang bìa sau
  const zonesB1 = useMemo<Zone[]>(() => [
    { id: "b1-left", label: "Gáy", x: ZONE["b1-left"].x, w: GAY, dir: "cw", side: zoneData["b1-left"] },
    { id: "b1-right", label: "Gáy", x: ZONE["b1-right"].x, w: GAY, dir: "ccw", side: zoneData["b1-right"] },
  ], [zoneData]);
  const zonesB2 = useMemo<Zone[]>(() => [
    { id: "b2-gay-l", label: "", x: 0, w: GAY, dir: "cw", side: null },
    { id: "b2-gay-r", label: "", x: BW - GAY, w: GAY, dir: "ccw", side: null },
    { id: "b2-spine", label: "Spine", x: IN_FROM, w: IN_TO - IN_FROM, dir: "cw", side: zoneData["b2-spine"] },
  ], [zoneData]);

  // Kích thước vùng làm việc cho canvas (điện thoại: cao theo tỉ lệ trang)
  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;
  const viewportFor = (box: Box, view: Half) => {
    if (isDesktop) return { w: area.w, h: area.h };
    const spec = SPECS[partOfBox(box)];
    const wPages = SPREAD_BOXES.includes(box) && view === "all" ? 2 : 1;
    return { w: area.w, h: Math.round(((area.w - 48) * spec.h) / (spec.w * wPages)) + 90 };
  };

  async function exportPage(p: PageDef): Promise<DesignFile | null> {
    const h = handles.current[p.box];
    if (!h || h.isEmpty(p.half)) return null;
    return { kind: p.kind, page: p.page, blob: await h.exportBlob(p.half), name: `${p.label}.png` };
  }
  async function downloadThis() {
    setBusy(true); setMsg("");
    try {
      const list = inSpread ? group.pages : [activePage];
      let n = 0;
      for (const p of list) { const f = await exportPage(p); if (f) { downloadBlob(f.blob, f.name); n++; } }
      setMsg(n ? `✓ Đã tải ${n} file` : "Trang này chưa có gì để tải.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Lỗi xuất file"); }
    setBusy(false);
  }
  async function downloadAll() {
    setBusy(true); setMsg("Đang đóng gói...");
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      let n = 0;
      for (const p of pages) { const f = await exportPage(p); if (f) { zip.file(f.name, f.blob); n++; } }
      if (!n) { setMsg("Chưa có trang nào để tải."); setBusy(false); return; }
      downloadBlob(await zip.generateAsync({ type: "blob" }), "Taylana-Custom-CD.zip");
      setMsg(`✓ Đã tải ${n} trang (Taylana-Custom-CD.zip)`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Lỗi xuất file"); }
    setBusy(false);
  }

  // ---------- Sửa gáy / Spine ----------
  const zone = spineMode ? ZONE[spineMode] : null;
  const side = spineMode ? zoneData[spineMode] : null;
  const THICK = zone?.w ?? GAY;
  const selText = side?.texts.find((t) => t.id === spineSel);
  const updSide = (fn: (s: SpineSide) => SpineSide) => spineMode && setZoneData((d) => ({ ...d, [spineMode]: fn(d[spineMode]) }));
  const updText = (p: Partial<SpineText>) => updSide((s) => ({ ...s, texts: s.texts.map((t) => (t.id === spineSel ? { ...t, ...p } : t)) }));
  function openZone(id: string) {
    if (!(id in ZONE)) return;
    const z = ZONE[id as ZoneId];
    setSpineBg(handles.current[z.box]?.regionCanvas(z.x, z.w) ?? null); // phần thiết kế đang nằm dưới vùng (chỉ để xem)
    setSpineMode(id as ZoneId);
    setSpineSel(null);
  }
  function addSpineText() {
    const fontSize = Math.min(Math.round(14 * PX_UNIT), Math.round(THICK * 0.6));
    const t: SpineText = { id: Math.random().toString(36).slice(2, 9), text: "Tên album", fontFamily: "Be Vietnam Pro", fontSize, fill: "#050505", align: "center", y: Math.round((THICK - fontSize) / 2) };
    updSide((s) => ({ ...s, texts: [...s.texts, t] }));
    setSpineSel(t.id);
  }

  const pageList = inSpread ? null : pages.filter((p) => p.part === part);
  const tplBox = cur.box;
  const tplHalf = SPREAD_BOXES.includes(tplBox) ? (inSpread ? tplTarget : cur.view === "R" ? 1 : 0) : 0;
  const tplKey = `${tplBox}-${tplHalf}`;
  const Label = ({ children }: { children: React.ReactNode }) => <p className="tool-label mb-2">{children}</p>;
  const Switch = ({ on, onClick, label, dim }: { on: boolean; onClick: () => void; label: string; dim?: boolean }) => (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} className={`inline-flex items-center gap-2 text-[13px] text-[#141414] ${dim ? "opacity-50" : ""}`}>
      <span className={`relative h-[18px] w-8 rounded-full transition ${on ? "bg-[#141414]" : "bg-[#d6d2cb]"}`}>
        <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all ${on ? "left-[16px]" : "left-[2px]"}`} />
      </span>
      {label}
    </button>
  );

  return (
    <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
      {/* ---------- BÊN TRÁI: vùng làm việc ---------- */}
      <div ref={areaRef} className="relative bg-[#ece1d0] md:min-h-0 md:w-[62%]"
        style={!isDesktop ? { height: viewportFor(cur.box, cur.view).h } : undefined}>
        {spineMode && zone && (
          <div key={`spine-${spineMode}`} className="absolute inset-0 flex flex-col items-center justify-center p-4 animate-[flipIn_.3s_ease]">
            <SpineEditor side={zoneData[spineMode]} len={BH} thick={THICK} width={Math.max(200, area.w - 32)} dir={zone.dir} bg={spineBg}
              selectedId={spineSel} onSelect={setSpineSel}
              onMoveText={(id, y) => updSide((s) => ({ ...s, texts: s.texts.map((t) => (t.id === id ? { ...t, y: Math.max(0, Math.min(THICK - t.fontSize, y)) } : t)) }))} />
            <p className="mt-2 text-center text-[12px] font-medium text-[#4d4a46]">
              {zone.title[0].toUpperCase() + zone.title.slice(1)} · {zone.cm.toFixed(1)} x {SPECS.back.h / 10} cm
            </p>
          </div>
        )}
        {area.w > 0 && boxes.map((b) => {
          const pt = partOfBox(b);
          const spec = SPECS[pt];
          const show = b === cur.box && !spineMode;
          const view = b === cur.box ? cur.view : "all";
          return (
            <div key={b} className={show ? `absolute inset-0 ${b === "b1" || b === "b2" ? "animate-[flipIn_.3s_ease]" : ""}` : "hidden"}>
              <CdDesigner ref={(h) => { handles.current[b] = h; }} spec={spec} spread={SPREAD_BOXES.includes(b)} view={view}
                viewport={viewportFor(b, view)} templates={templatesFor(b)} active={show}
                toolbarTarget={hosts[b]} guides={guides}
                zones={b === "b1" ? zonesB1 : b === "b2" ? zonesB2 : undefined}
                onZoneClick={openZone}
                tray={b === "b2" && trayOn ? TRAY : undefined}
                onSnapshot={(half, url) => setThumbs((t) => (t[`${b}-${half}`] === url ? t : { ...t, [`${b}-${half}`]: url }))}
                caption={b === cur.box ? `${cur.label} · ${sizeText(spec)}` : undefined} />
            </div>
          );
        })}
      </div>

      {/* ---------- BÊN PHẢI: panel ---------- */}
      <aside className="flex flex-col divide-y divide-[#ecebe7] bg-white font-sans text-[13px] text-[#141414] md:min-h-0 md:flex-1 md:overflow-y-auto md:border-l md:border-[#dedad3]">
        <section className="p-4">
          <div className="flex rounded-[8px] bg-[#f4f2ee] p-0.5">
            {PARTS.map((pt) => (
              <button key={pt} aria-pressed={part === pt}
                className={`h-7 flex-1 rounded-[6px] text-[13px] font-medium ${part === pt ? "bg-white shadow-sm" : "text-[#77726b] hover:text-[#141414]"}`}
                onClick={() => openPage(pages.find((x) => x.part === pt)!.id)}>
                {targetLabels[pt]}
              </button>
            ))}
          </div>
        </section>

        {part !== "disc" && (
          <section className="space-y-3 p-4">
            <div>
              <Label>Số trang</Label>
              <div className="flex gap-1.5">
                {(part === "front" ? FRONT_COUNTS : BACK_COUNTS).map((n) => (
                  <button key={n} aria-pressed={(part === "front" ? frontN : backN) === n} className="tool-btn flex-1" onClick={() => setCount(part, n)}>{n}</button>
                ))}
              </div>
            </div>
            {booklet && part === "front" && (
              <div>
                <Label>Chế độ xem</Label>
                <div className="flex gap-1.5">
                  <button className="tool-btn flex-1" aria-pressed={!spreadView} onClick={() => setSpreadView(false)}>1 trang</button>
                  <button className="tool-btn flex-1" aria-pressed={spreadView} onClick={() => { setSpreadView(true); setSpineMode(null); }}>Trải đôi</button>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="p-4">
          <Label>Trang</Label>
          {inSpread ? (
            <div className="grid grid-cols-3 gap-1.5">
              {groups.map((g) => {
                const on = g.id === group.id;
                return (
                  <button key={g.id} onClick={() => setGroupId(g.id)} title={`Trang ${g.label}`}
                    className={`rounded-[8px] border p-1 text-center text-[11px] ${on ? "border-[#141414] ring-1 ring-[#141414]" : "border-[#e3e0da] hover:border-[#bdb8b0]"}`}>
                    <span className="flex justify-center gap-px">
                      {g.pages.map((p) => (
                        <span key={p.id} className="block aspect-square w-1/2 max-w-[44px] overflow-hidden bg-[#f4f2ee]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {thumbs[`${p.box}-${p.half}`] && <img src={thumbs[`${p.box}-${p.half}`]} alt="" className="h-full w-full object-cover" />}
                        </span>
                      ))}
                    </span>
                    <span className="mt-1 block font-medium">{g.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={`grid gap-1.5 ${booklet && part === "front" ? "grid-cols-4" : "grid-cols-2"}`}>
              {pageList!.map((p) => {
                const spec = SPECS[p.part];
                const on = p.id === activePage.id;
                const compact = booklet && part === "front";
                return (
                  <button key={p.id} onClick={() => openPage(p.id)} title={p.label}
                    className={`flex items-center gap-1.5 rounded-[8px] border p-1 text-left ${compact ? "flex-col !gap-1 text-center text-[11px]" : "text-[12px]"} ${on ? "border-[#141414] ring-1 ring-[#141414]" : "border-[#e3e0da] hover:border-[#bdb8b0]"}`}>
                    <span className={`block shrink-0 overflow-hidden bg-[#f4f2ee] ${compact ? "w-full" : "w-9"} ${p.part === "disc" ? "rounded-full" : "rounded-[4px]"}`} style={{ aspectRatio: `${spec.w} / ${spec.h}` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {thumbs[`${p.box}-${p.half}`] && <img src={thumbs[`${p.box}-${p.half}`]} alt="" className="h-full w-full object-cover" />}
                    </span>
                    <span className="min-w-0 font-medium leading-tight">{p.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {spineMode && zone ? (
          /* ---------- Chế độ sửa gáy / Spine: chỉ chữ + màu nền ---------- */
          <section className="space-y-3 p-4">
            <button className="tool-btn w-full" onClick={() => { setSpineMode(null); setSpineSel(null); }}><Icon name="back" /> Xong, quay lại bìa</button>
            <div className="flex items-center justify-between">
              <p className="tool-label">Sửa {zone.title}</p>
              <button className="tool-btn" onClick={addSpineText}><Icon name="text" /> Chữ</button>
            </div>
            {selText ? (
              <div className="space-y-2.5 rounded-[10px] border border-[#e3e0da] p-3">
                <div className="flex items-center justify-between">
                  <p className="tool-label">Thuộc tính · chữ</p>
                  <button className="tool-btn tool-icon !text-[#d0303f]" title="Xoá" aria-label="Xoá"
                    onClick={() => { updSide((s) => ({ ...s, texts: s.texts.filter((t) => t.id !== spineSel) })); setSpineSel(null); }}><Icon name="trash" /></button>
                </div>
                <input className="tool-input w-full" value={selText.text} onChange={(e) => updText({ text: e.target.value })} />
                <select className="tool-input w-full" value={selText.fontFamily} style={{ fontFamily: selText.fontFamily }} onChange={(e) => updText({ fontFamily: e.target.value })}>
                  {FONTS.map((f) => <option key={f.name} value={f.name} style={{ fontFamily: f.name }}>{f.label}</option>)}
                </select>
                <div className="flex gap-1.5">
                  <div className="flex flex-1 items-center">
                    <input type="number" min={4} max={200} value={Math.round((selText.fontSize / PX_UNIT) * 10) / 10} aria-label="Cỡ chữ (px)" className="tool-input w-full rounded-r-none"
                      onChange={(e) => { const v = Number(e.target.value); if (v > 0) { const fontSize = Math.min(THICK, Math.round(v * PX_UNIT)); updText({ fontSize, y: Math.min(selText.y, THICK - fontSize) }); } }} />
                    <select aria-label="Chọn nhanh cỡ chữ" className="tool-input -ml-px w-9 rounded-l-none !px-1" value=""
                      onChange={(e) => { const v = Number(e.target.value); if (v) { const fontSize = Math.min(THICK, Math.round(v * PX_UNIT)); updText({ fontSize, y: Math.min(selText.y, THICK - fontSize) }); } }}>
                      <option value="" disabled>▾</option>
                      {SIZE_PRESETS.map((n) => <option key={n} value={n}>{n} px</option>)}
                    </select>
                  </div>
                  <div className="flex">
                    {(["left", "center", "right"] as const).map((a, i) => (
                      <button key={a} title={{ left: "Canh trái", center: "Canh giữa", right: "Canh phải" }[a]} aria-label={a} aria-pressed={selText.align === a}
                        className={`tool-btn tool-icon ${i === 0 ? "rounded-r-none" : i === 2 ? "-ml-px rounded-l-none" : "-ml-px rounded-none"}`} onClick={() => updText({ align: a })}>
                        <Icon name={a === "left" ? "alignL" : a === "center" ? "alignC" : "alignR"} />
                      </button>
                    ))}
                  </div>
                </div>
                <ColorSelect value={selText.fill} colors={TEXT_COLORS} onChange={(c) => updText({ fill: c })} />
              </div>
            ) : (
              <p className="text-[12px] text-[#8a857e]">{side && side.texts.length ? "Bấm vào chữ để sửa, kéo lên/xuống để đổi vị trí." : "Thêm chữ cho " + zone.title + "."}</p>
            )}
            <div>
              <Label>Màu nền {zone.title}</Label>
              <div className="flex flex-wrap items-center gap-1.5">
                <button onClick={() => updSide((s) => ({ ...s, bg: null }))} aria-pressed={!side?.bg} title="Không màu (thấy thiết kế bên dưới)"
                  className="swatch bg-[linear-gradient(135deg,#fff_45%,#d0303f_45%,#d0303f_55%,#fff_55%)]" aria-label="Không màu" />
                {TEXT_COLORS.map((c) => (
                  <button key={c.value} aria-label={c.name} title={c.name} aria-pressed={side?.bg === c.value} onClick={() => updSide((s) => ({ ...s, bg: c.value }))}
                    className="swatch" style={{ background: c.value }} />
                ))}
                <label className="swatch relative overflow-hidden bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" title="Màu tuỳ chọn">
                  <input type="color" value={side?.bg ?? "#ffffff"} onChange={(e) => updSide((s) => ({ ...s, bg: e.target.value }))} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Màu nền tuỳ chọn" />
                </label>
              </div>
            </div>
          </section>
        ) : (
          <section className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="tool-label">Mẫu</p>
              {inSpread && SPREAD_BOXES.includes(cur.box) && cur.view === "all" && (
                <div className="flex gap-1">
                  {group.pages.map((p, i) => (
                    <button key={p.id} className="tool-btn !h-6 !px-2 !text-[11px]" aria-pressed={tplTarget === i} onClick={() => setTplTarget(i as 0 | 1)}>Trang {p.label}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              <button onClick={() => setChosen({ ...chosen, [tplKey]: "" })} title="Tự do"
                className={`w-16 shrink-0 rounded-[8px] border p-1 text-center text-[11px] ${!chosen[tplKey] ? "border-[#141414] ring-1 ring-[#141414]" : "border-[#e3e0da]"}`}>
                <div className={`mb-1 grid aspect-square place-items-center bg-[#f4f2ee] text-base ${curPart === "disc" ? "rounded-full" : "rounded-[4px]"}`}>✎</div>
                Tự do
              </button>
              {templates.filter((t) => t.target === curPart).map((t) => (
                <button key={t.id} onClick={() => setChosen({ ...chosen, [tplKey]: t.id })} title={t.name}
                  className={`w-16 shrink-0 rounded-[8px] border p-1 text-center text-[11px] ${chosen[tplKey] === t.id ? "border-[#141414] ring-1 ring-[#141414]" : "border-[#e3e0da]"}`}>
                  <div className="mb-1"><TemplateThumb ratio={SPECS[curPart].w / SPECS[curPart].h} slots={t.slots} overlay={t.overlay_url} background={t.background_url} disc={curPart === "disc"} /></div>
                  <span className="line-clamp-1">{t.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Công cụ */}
        <section className={`p-4 ${spineMode ? "hidden" : ""}`}>
          <div className="mb-3 flex flex-col gap-2">
            <Switch on={guides} onClick={() => setGuides(!guides)} label="Hiển thị guideline" />
            {cur.box === "b2" && <Switch on={trayOn} onClick={() => setTrayOn(!trayOn)} label="Ướm khay đĩa" dim={!guides} />}
          </div>
          {boxes.map((b) => (
            <div key={b} className={b === cur.box ? "" : "hidden"}
              ref={(el) => { if (el && hosts[b] !== el) setHosts((h) => ({ ...h, [b]: el })); }} />
          ))}
        </section>

        {/* Hành động */}
        <section className="mt-auto space-y-2 p-4">
          <div className="grid grid-cols-2 gap-1.5">
            <button className="tool-btn" disabled={busy} onClick={downloadThis}>Tải trang này</button>
            <button className="tool-btn" disabled={busy} onClick={downloadAll}>Tải tất cả (.zip)</button>
          </div>
          <button className="h-10 w-full rounded-[8px] bg-lime-500 text-[14px] font-semibold text-ink-900 transition hover:brightness-95 disabled:opacity-50" disabled={busy} onClick={() => setOrdering(true)}>
            Gửi đơn / Lưu thiết kế
          </button>
          {msg && <p className="text-center text-[12px]">{msg}</p>}
          <p className="text-center text-[11px] text-[#8a857e]">PNG 300 DPI đúng khổ in, không có guideline.</p>
        </section>
      </aside>

      {ordering && (
        <OrderDialog orderType="custom_cd" title="Gửi đơn Custom CD" packages={packages} onClose={() => setOrdering(false)}
          getFiles={async () => (await Promise.all(pages.map(exportPage))).filter((f): f is DesignFile => !!f)} />
      )}
    </div>
  );
}
