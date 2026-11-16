"use client";

import { useMemo, useRef, useState } from "react";
import { BACK_SPINE_MM, SPECS, mmToPx, sizeText } from "@/lib/print";
import { INNER_SPINE_FROM_CM, INNER_SPINE_TO_CM, TRAY_DISC_DIAMETER_CM, TRAY_DISC_HOLE_CM } from "@/lib/cdSpecs";
import { targetLabels, type DesignTemplate } from "@/lib/templates";
import type { Package } from "@/lib/types";
import { Designer, FONTS, type DesignerHandle } from "@/components/designer/Designer";
import { SpineEditor, emptySide, type SpineSide, type SpineText, type Zone } from "@/components/designer/Spine";
import { TemplateThumb } from "@/components/designer/TemplateThumb";
import { OrderDialog, downloadBlob, type DesignFile } from "@/components/designer/OrderDialog";
import { useSize } from "@/components/designer/useSize";

type Part = "front" | "back" | "disc";
const PARTS: Part[] = ["front", "back", "disc"];
type PageDef = { key: string; part: Part; label: string; kind: string; page: number | null };

const FRONT_COUNTS = [1, 2, 4, 8] as const;
const BACK_COUNTS = [1, 2] as const;
const ALL_KEYS = ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "b1", "b2", "d1"];
const partOf = (key: string): Part => (key[0] === "f" ? "front" : key[0] === "b" ? "back" : "disc");

// Danh sách trang theo số trang đã chọn. Khoá (f1, f2, ...) cố định → đổi số trang vẫn giữ thiết kế.
function pagesOf(frontN: number, backN: number): PageDef[] {
  const front: PageDef[] = frontN <= 2
    ? [{ key: "f1", part: "front", label: "Bìa Trước - Mặt Ngoài", kind: "front", page: 1 },
       ...(frontN === 2 ? [{ key: "f2", part: "front" as Part, label: "Bìa Trước - Mặt Trong", kind: "front", page: 2 }] : [])]
    : Array.from({ length: frontN }, (_, i) => ({ key: `f${i + 1}`, part: "front" as Part, label: String(i + 1), kind: "booklet", page: i + 1 }));
  const back: PageDef[] = [
    { key: "b1", part: "back", label: "Bìa Sau - Mặt Ngoài", kind: "back", page: 1 },
    ...(backN === 2 ? [{ key: "b2", part: "back" as Part, label: "Bìa Sau - Mặt Trong", kind: "back", page: 2 }] : []),
  ];
  return [...front, ...back, { key: "d1", part: "disc", label: "Mặt Đĩa", kind: "disc", page: null }];
}

// Bìa sau: số đo (px bản in) lấy từ lib/cdSpecs.ts
const BW = mmToPx(SPECS.back.w);
const SPINE_LEN = mmToPx(SPECS.back.h);
const GAY = mmToPx(BACK_SPINE_MM);
const IN_FROM = mmToPx(INNER_SPINE_FROM_CM * 10);
const IN_TO = mmToPx(INNER_SPINE_TO_CM * 10);
const TRAY = { cx: (IN_TO + (BW - GAY)) / 2, cy: SPINE_LEN / 2, r: mmToPx(TRAY_DISC_DIAMETER_CM * 5), hole: mmToPx(TRAY_DISC_HOLE_CM * 5) };
type ZoneId = "b1-left" | "b1-right" | "b2-spine";
const ZONE_INFO: Record<ZoneId, { title: string; w: number; cm: number }> = {
  "b1-left": { title: "gáy trái", w: GAY, cm: BACK_SPINE_MM / 10 },
  "b1-right": { title: "gáy phải", w: GAY, cm: BACK_SPINE_MM / 10 },
  "b2-spine": { title: "Spine", w: IN_TO - IN_FROM, cm: INNER_SPINE_TO_CM - INNER_SPINE_FROM_CM },
};
const SPINE_COLORS = ["#141414", "#ffffff", "#c8e03c", "#7b68ee", "#ff5fa2", "#3b1510", "#ffcf5c"];

export function CustomCdEditor({ templates, packages }: { templates: DesignTemplate[]; packages: Package[] }) {
  const [frontN, setFrontN] = useState(1);
  const [backN, setBackN] = useState(1);
  const [activeKey, setActiveKey] = useState("f1");
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState<string[]>(["f1", "b1", "d1"]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [guides, setGuides] = useState(true);
  const [zoneData, setZoneData] = useState<Record<ZoneId, SpineSide>>({ "b1-left": emptySide(), "b1-right": emptySide(), "b2-spine": emptySide() });
  const [spineMode, setSpineMode] = useState<ZoneId | null>(null);
  const [trayOn, setTrayOn] = useState(true);
  // vùng dải dọc của 2 trang bìa sau (giữ nguyên đối tượng khi không đổi)
  const zonesB1 = useMemo<Zone[]>(() => [
    { id: "b1-left", label: "Gáy", x: 0, w: GAY, side: zoneData["b1-left"] },
    { id: "b1-right", label: "Gáy", x: BW - GAY, w: GAY, side: zoneData["b1-right"] },
  ], [zoneData]);
  const zonesB2 = useMemo<Zone[]>(() => [
    { id: "b2-gay-l", label: "", x: 0, w: GAY, side: null },
    { id: "b2-gay-r", label: "", x: BW - GAY, w: GAY, side: null },
    { id: "b2-spine", label: "Spine", x: IN_FROM, w: IN_TO - IN_FROM, side: zoneData["b2-spine"] },
  ], [zoneData]);
  const [spineSel, setSpineSel] = useState<string | null>(null);
  const [flipKey, setFlipKey] = useState(0);
  const [areaRef, area] = useSize<HTMLDivElement>();
  const handles = useRef<Record<string, DesignerHandle | null>>({});
  const [hosts, setHosts] = useState<Record<string, HTMLDivElement | null>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ordering, setOrdering] = useState(false);

  const pages = pagesOf(frontN, backN);
  const active = pages.find((p) => p.key === activeKey) ?? pages[0];
  const part = active.part;
  const partPages = pages.filter((p) => p.part === part);
  const keys = ALL_KEYS.filter((k) => mounted.includes(k) || pages.some((p) => p.key === k));

  function openPage(key: string) {
    setActiveKey(key);
    setSpineMode(null);
    setMounted((m) => (m.includes(key) ? m : [...m, key]));
  }
  function setCount(p: Part, n: number) {
    const next = p === "front" ? pagesOf(n, backN) : pagesOf(frontN, n);
    if (p === "front") setFrontN(n); else setBackN(n);
    setMounted((m) => Array.from(new Set([...m, ...next.map((x) => x.key)])));
    if (!next.some((x) => x.key === activeKey)) openPage(next.find((x) => x.part === p)!.key);
  }

  // Canvas co giãn vừa khít vùng làm việc, giữ đúng tỉ lệ
  const widthFor = (p: Part) => {
    const spec = SPECS[p];
    const pad = 32, captionH = 32;
    const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;
    const maxW = Math.max(200, area.w - pad);
    if (!isDesktop) return Math.min(maxW, 520);
    const maxH = Math.max(200, area.h - pad - captionH);
    return Math.floor(Math.min(maxW, maxH * (spec.w / spec.h)));
  };

  async function exportPage(p: PageDef): Promise<DesignFile | null> {
    const h = handles.current[p.key];
    if (!h || h.isEmpty()) return null;
    return { kind: p.kind, page: p.page, blob: await h.exportBlob(), name: `${p.label}.png` };
  }

  async function downloadThis() {
    setBusy(true); setMsg("");
    try {
      const f = await exportPage(active);
      if (f) { downloadBlob(f.blob, f.name); setMsg(`✓ Đã tải “${f.name}”`); } else setMsg("Trang này chưa có gì để tải.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Lỗi xuất file"); }
    setBusy(false);
  }

  async function downloadAll() {
    setBusy(true); setMsg("Đang đóng gói...");
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      let n = 0;
      for (const p of pages) {
        const f = await exportPage(p);
        if (f) { zip.file(f.name, f.blob); n++; }
      }
      if (!n) { setMsg("Chưa có trang nào để tải."); setBusy(false); return; }
      downloadBlob(await zip.generateAsync({ type: "blob" }), "Taylana-Custom-CD.zip");
      setMsg(`✓ Đã tải ${n} trang (Taylana-Custom-CD.zip)`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Lỗi xuất file"); }
    setBusy(false);
  }

  // ---------- Gáy ----------
  const side = spineMode ? zoneData[spineMode] : null;
  const THICK = spineMode ? ZONE_INFO[spineMode].w : GAY;
  const selText = side?.texts.find((t) => t.id === spineSel);
  const updSide = (fn: (s: SpineSide) => SpineSide) => spineMode && setZoneData((d) => ({ ...d, [spineMode]: fn(d[spineMode]) }));
  const updText = (p: Partial<SpineText>) => updSide((s) => ({ ...s, texts: s.texts.map((t) => (t.id === spineSel ? { ...t, ...p } : t)) }));
  function addSpineText() {
    const fontSize = Math.round(THICK * 0.5);
    const t: SpineText = { id: Math.random().toString(36).slice(2, 9), text: "Tên album", fontFamily: "Be Vietnam Pro", fontSize, fill: "#141414", align: "center", y: Math.round((THICK - fontSize) / 2) };
    updSide((s) => ({ ...s, texts: [...s.texts, t] }));
    setSpineSel(t.id);
  }
  function closeSpine() { setSpineMode(null); setSpineSel(null); setFlipKey((k) => k + 1); }

  return (
    <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
      {/* ---------- BÊN TRÁI: vùng làm việc ---------- */}
      <div ref={areaRef} className="relative min-h-[320px] bg-cream-200 md:min-h-0 md:w-[62%]">
        <div className="flex h-full items-center justify-center p-4">
          {spineMode && (
            <div key={`spine-${spineMode}`} className="w-full animate-[flipIn_.3s_ease]">
              <SpineEditor side={zoneData[spineMode]} len={SPINE_LEN} thick={THICK} width={Math.max(200, area.w - 32)}
                selectedId={spineSel} onSelect={setSpineSel}
                onMoveText={(id, y) => updSide((s) => ({ ...s, texts: s.texts.map((t) => (t.id === id ? { ...t, y: Math.max(0, Math.min(THICK - t.fontSize, y)) } : t)) }))} />
              <p className="mt-2 text-center text-xs font-semibold text-ink-600">
                {ZONE_INFO[spineMode].title[0].toUpperCase() + ZONE_INFO[spineMode].title.slice(1)} · {ZONE_INFO[spineMode].cm.toFixed(1)} x {SPECS.back.h / 10} cm
              </p>
            </div>
          )}
          {area.w > 0 && keys.map((k) => {
            const p = pages.find((x) => x.key === k);
            const pt = partOf(k);
            const spec = SPECS[pt];
            const tpl = templates.find((t) => t.target === pt && t.id === chosen[k]) ?? null;
            const show = k === active.key && !spineMode;
            return (
              <div key={k} className={show ? (k === "b1" || k === "b2" ? "animate-[flipIn_.3s_ease]" : "") : "hidden"} data-flip={flipKey}>
                <Designer ref={(h) => { handles.current[k] = h; }} spec={spec} width={widthFor(pt)} template={tpl} active={show}
                  toolbarTarget={hosts[k]} guides={guides}
                  zones={k === "b1" ? zonesB1 : k === "b2" ? zonesB2 : undefined}
                  onZoneClick={(id) => { if (id in ZONE_INFO) { setSpineMode(id as ZoneId); setSpineSel(null); } }}
                  tray={k === "b2" && trayOn ? TRAY : undefined}
                  onSnapshot={(url) => setThumbs((t) => (t[k] === url ? t : { ...t, [k]: url }))}
                  caption={<p className="mt-2 text-center text-xs font-semibold text-ink-600">{p?.label ?? ""} · {sizeText(spec)}</p>} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- BÊN PHẢI: panel (tự cuộn bên trong nếu dài) ---------- */}
      <aside className="flex flex-col gap-5 border-ink-900 bg-cream-100 p-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:border-l-[1.5px] md:p-5">
        {/* 1. Chọn phần */}
        <div className="flex gap-2">
          {PARTS.map((p) => (
            <button key={p} aria-pressed={part === p} className="chip flex-1 !px-2"
              onClick={() => openPage(pages.find((x) => x.part === p)!.key)}>
              {targetLabels[p]}
            </button>
          ))}
        </div>

        {/* 2. Số trang + danh sách trang */}
        {part !== "disc" && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-900">Số trang</p>
            <div className="flex gap-2">
              {(part === "front" ? FRONT_COUNTS : BACK_COUNTS).map((n) => (
                <button key={n} aria-pressed={(part === "front" ? frontN : backN) === n} className="chip flex-1" onClick={() => setCount(part, n)}>{n}</button>
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-900">Trang</p>
          <div className="grid grid-cols-2 gap-2">
            {partPages.map((p) => {
              const spec = SPECS[p.part];
              const on = p.key === active.key;
              return (
                <button key={p.key} onClick={() => openPage(p.key)}
                  className={`flex items-center gap-2 rounded-[14px] border-2 p-1.5 text-left text-xs font-semibold text-ink-900 ${on ? "border-ink-900 bg-lime-500" : "border-ink-100 bg-white hover:border-ink-300"}`}>
                  <span className={`block w-11 shrink-0 overflow-hidden bg-cream-100 ${p.part === "disc" ? "rounded-full" : "rounded-[6px]"}`} style={{ aspectRatio: `${spec.w} / ${spec.h}` }}>
                    {thumbs[p.key] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbs[p.key]} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 leading-tight">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {spineMode ? (
          /* ---------- Chế độ sửa gáy: chỉ chữ + màu nền gáy ---------- */
          <div className="space-y-4 rounded-[24px] border-[1.5px] border-ink-900 bg-white p-4">
            <button className="btn btn-sm w-full" onClick={closeSpine}>← Xong, quay lại bìa</button>
            <p className="text-xs font-bold uppercase tracking-widest text-ink-900">Sửa {ZONE_INFO[spineMode].title}</p>
            <button className="chip" onClick={addSpineText}>＋ Chữ</button>
            {selText ? (
              <div className="space-y-3 rounded-[18px] bg-lime-100 p-4">
                <input className="field" value={selText.text} onChange={(e) => updText({ text: e.target.value })} />
                <select className="field" value={selText.fontFamily} style={{ fontFamily: selText.fontFamily }} onChange={(e) => updText({ fontFamily: e.target.value })}>
                  {FONTS.map((f) => <option key={f.name} value={f.name} style={{ fontFamily: f.name }}>{f.label}</option>)}
                </select>
                <div className="flex flex-wrap items-center gap-2">
                  {SPINE_COLORS.map((c) => (
                    <button key={c} aria-label={c} onClick={() => updText({ fill: c })}
                      className={`h-8 w-8 rounded-full border-2 border-ink-900 ${selText.fill === c ? "ring-4 ring-violet-500" : ""}`} style={{ background: c }} />
                  ))}
                  <input type="color" value={selText.fill} onChange={(e) => updText({ fill: e.target.value })} className="h-8 w-10" aria-label="Màu khác" />
                </div>
                <label className="block text-sm font-semibold text-ink-900">Cỡ chữ
                  <input type="range" min={Math.round(THICK * 0.2)} max={Math.round(THICK * 0.95)} value={selText.fontSize}
                    onChange={(e) => { const fontSize = Number(e.target.value); updText({ fontSize, y: Math.min(selText.y, THICK - fontSize) }); }} className="w-full accent-violet-500" />
                </label>
                <div className="flex gap-2">
                  {(["left", "center", "right"] as const).map((a) => (
                    <button key={a} aria-pressed={selText.align === a} className="chip flex-1" onClick={() => updText({ align: a })}>
                      {{ left: "Trái", center: "Giữa", right: "Phải" }[a]}
                    </button>
                  ))}
                </div>
                <button className="chip !border-hot-500 !text-hot-700"
                  onClick={() => { updSide((s) => ({ ...s, texts: s.texts.filter((t) => t.id !== spineSel) })); setSpineSel(null); }}>Xoá chữ</button>
              </div>
            ) : (
              side && side.texts.length > 0 && <p className="text-xs text-ink-500">Bấm vào chữ trên gáy để sửa, kéo lên/xuống để đổi vị trí.</p>
            )}
            <div className="border-t border-ink-100 pt-4">
              <span className="mb-2 block text-sm font-semibold text-ink-900">Màu nền {ZONE_INFO[spineMode].title}</span>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => updSide((s) => ({ ...s, bg: null }))} className={`chip !min-h-8 !text-xs ${!side?.bg ? "is-active" : ""}`}>Không màu</button>
                {SPINE_COLORS.map((c) => (
                  <button key={c} aria-label={`Nền ${c}`} onClick={() => updSide((s) => ({ ...s, bg: c }))}
                    className={`h-7 w-7 rounded-full border-2 border-ink-900 ${side?.bg === c ? "ring-4 ring-violet-500" : ""}`} style={{ background: c }} />
                ))}
                <input type="color" value={side?.bg ?? "#ffffff"} onChange={(e) => updSide((s) => ({ ...s, bg: e.target.value }))} className="h-7 w-9" aria-label="Màu nền khác" />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* 3. Chọn mẫu (riêng cho trang đang mở) */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-900">Chọn mẫu</p>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                <button onClick={() => setChosen({ ...chosen, [active.key]: "" })}
                  className={`w-20 shrink-0 rounded-[14px] border-2 bg-white p-1.5 text-center text-[11px] font-semibold text-ink-900 ${!chosen[active.key] ? "border-ink-900 bg-lime-500" : "border-ink-100"}`}>
                  <div className={`mb-1 grid aspect-square place-items-center bg-cream-100 text-xl ${part === "disc" ? "rounded-full" : "rounded-md"}`}>✎</div>
                  Tự do
                </button>
                {templates.filter((t) => t.target === part).map((t) => (
                  <button key={t.id} onClick={() => setChosen({ ...chosen, [active.key]: t.id })}
                    className={`w-20 shrink-0 rounded-[14px] border-2 bg-white p-1.5 text-center text-[11px] font-semibold text-ink-900 ${chosen[active.key] === t.id ? "border-ink-900 bg-lime-500" : "border-ink-100"}`}>
                    <div className="mb-1">
                      <TemplateThumb ratio={SPECS[part].w / SPECS[part].h} slots={t.slots} overlay={t.overlay_url} background={t.background_url} disc={part === "disc"} />
                    </div>
                    <span className="line-clamp-2">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 4. Công cụ: công tắc guideline + thanh công cụ của trang đang mở */}
        <div className={spineMode ? "hidden" : ""}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-900">Công cụ</p>
            <button type="button" role="switch" aria-checked={guides} onClick={() => setGuides(!guides)} className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
              Hiển thị guideline
              <span className={`relative h-6 w-11 rounded-full border-2 border-ink-900 transition ${guides ? "bg-lime-500" : "bg-ink-100"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full border-2 border-ink-900 bg-white transition-all ${guides ? "left-5" : "left-0.5"}`} />
              </span>
            </button>
          </div>
          {active.key === "b2" && (
            <button type="button" role="switch" aria-checked={trayOn} onClick={() => setTrayOn(!trayOn)}
              className={`mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-900 ${guides ? "" : "opacity-50"}`}>
              <span className={`relative h-6 w-11 rounded-full border-2 border-ink-900 transition ${trayOn ? "bg-lime-500" : "bg-ink-100"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full border-2 border-ink-900 bg-white transition-all ${trayOn ? "left-5" : "left-0.5"}`} />
              </span>
              Ướm khay đĩa {!guides && <span className="text-xs font-normal">(bật guideline để xem)</span>}
            </button>
          )}
          {keys.map((k) => (
            <div key={k} className={k === active.key ? "" : "hidden"}
              ref={(el) => { if (el && hosts[k] !== el) setHosts((h) => ({ ...h, [k]: el })); }} />
          ))}
        </div>

        {/* 5. Hành động */}
        <div className="mt-auto space-y-2 border-t-[1.5px] border-ink-100 pt-4">
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={downloadThis}>Tải trang này</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={downloadAll}>Tải tất cả (.zip)</button>
          </div>
          <button className="btn w-full" disabled={busy} onClick={() => setOrdering(true)}>Gửi đơn / Lưu thiết kế →</button>
          {msg && <p className="text-center text-sm">{msg}</p>}
          <p className="text-center text-xs text-ink-500">File xuất PNG 300 DPI đúng khổ in, không có guideline.</p>
        </div>
      </aside>

      {ordering && (
        <OrderDialog orderType="custom_cd" title="Gửi đơn Custom CD" packages={packages} onClose={() => setOrdering(false)}
          getFiles={async () => (await Promise.all(pages.map(exportPage))).filter((f): f is DesignFile => !!f)} />
      )}
    </div>
  );
}
