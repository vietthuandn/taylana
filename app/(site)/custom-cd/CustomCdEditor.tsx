"use client";

import { useMemo, useRef, useState } from "react";
import { SPECS, sizeText } from "@/lib/print";
import { targetLabels, type DesignBase, type DesignTemplate, type Slot } from "@/lib/templates";
import type { Package } from "@/lib/types";
import { Designer, type DesignerHandle } from "@/components/designer/Designer";
import { TemplateThumb } from "@/components/designer/TemplateThumb";
import { OrderDialog, downloadBlob, type DesignFile } from "@/components/designer/OrderDialog";
import { useSize } from "@/components/designer/useSize";

type Part = "front" | "back" | "disc";
const PARTS: Part[] = ["front", "back", "disc"];
const fileNames: Record<Part, string> = { front: "bia-truoc", back: "bia-sau", disc: "mat-cd" };

// ---------- Bìa trước: lưới 1 / 2 / 4 / 8 ảnh ----------
const COUNTS = [1, 2, 4, 8] as const;
type Count = (typeof COUNTS)[number];
const GRID: Record<Count, [number, number]> = { 1: [1, 1], 2: [2, 1], 4: [2, 2], 8: [4, 2] }; // [cột, hàng]

function gridTemplate(count: Count): DesignBase {
  const spec = SPECS.front;
  if (count === 1) return { slots: [{ id: "g1-0", shape: "rect", x: 0, y: 0, w: 1, h: 1 }] }; // phủ kín cả bìa
  const [cols, rows] = GRID[count];
  const mx = spec.safe / spec.w, my = spec.safe / spec.h; // lề ngoài = vùng an toàn
  const gx = 2 / spec.w, gy = 2 / spec.h; // khoảng cách giữa ô ≈ 2mm
  const w = (1 - 2 * mx - (cols - 1) * gx) / cols;
  const h = (1 - 2 * my - (rows - 1) * gy) / rows;
  const slots: Slot[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      slots.push({ id: `g${count}-${r * cols + c}`, shape: "rect", x: mx + c * (w + gx), y: my + r * (h + gy), w, h });
  return { slots };
}

export function CustomCdEditor({ templates, packages }: { templates: DesignTemplate[]; packages: Package[] }) {
  const [part, setPart] = useState<Part>("front");
  const [chosen, setChosen] = useState<Record<Part, string>>({ front: "", back: "", disc: "" });
  const [count, setCount] = useState<Count>(1);
  const [areaRef, area] = useSize<HTMLDivElement>();
  const refs = { front: useRef<DesignerHandle>(null), back: useRef<DesignerHandle>(null), disc: useRef<DesignerHandle>(null) };
  const [hosts, setHosts] = useState<Record<Part, HTMLDivElement | null>>({ front: null, back: null, disc: null });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ordering, setOrdering] = useState(false);

  // mỗi số ảnh 1 mẫu lưới cố định (giữ nguyên đối tượng → không reset ảnh)
  const grids = useMemo(() => Object.fromEntries(COUNTS.map((n) => [n, gridTemplate(n)])) as Record<Count, DesignBase>, []);

  // Canvas co giãn vừa khít vùng làm việc (trừ chỗ cho dòng chú thích), giữ đúng tỉ lệ
  const widthFor = (p: Part) => {
    const spec = SPECS[p];
    const pad = 32, captionH = 32;
    const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;
    const maxW = Math.max(200, area.w - pad);
    if (!isDesktop) return Math.min(maxW, 520);
    const maxH = Math.max(200, area.h - pad - captionH);
    return Math.floor(Math.min(maxW, maxH * (spec.w / spec.h)));
  };

  async function exportPart(p: Part): Promise<DesignFile | null> {
    const h = refs[p].current;
    if (!h || h.isEmpty()) return null;
    return { kind: p, blob: await h.exportBlob(), name: `${fileNames[p]}-300dpi.png` };
  }

  async function download(which: Part[]) {
    setBusy(true);
    setMsg("");
    try {
      let n = 0;
      for (const p of which) {
        const f = await exportPart(p);
        if (f) { downloadBlob(f.blob, f.name); n++; }
      }
      setMsg(n ? `✓ Đã tải ${n} file PNG 300 DPI` : "Phần này chưa có gì để tải.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi xuất file");
    }
    setBusy(false);
  }

  const usingAdminFront = chosen.front !== "";

  return (
    <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
      {/* ---------- BÊN TRÁI: vùng làm việc (chỉ canvas) ---------- */}
      <div ref={areaRef} className="relative min-h-[320px] bg-cream-200 md:min-h-0 md:w-[62%]">
        <div className="flex h-full items-center justify-center p-4">
          {area.w > 0 && PARTS.map((p) => {
            const spec = SPECS[p];
            const tpl = templates.find((t) => t.target === p && t.id === chosen[p]) ?? null;
            const template = p === "front" && !tpl ? grids[count] : tpl;
            return (
              <div key={p} className={p === part ? "" : "hidden"}>
                <Designer ref={refs[p]} spec={spec} width={widthFor(p)} template={template} active={p === part}
                  toolbarTarget={hosts[p]}
                  caption={<p className="mt-2 text-center text-xs font-semibold text-ink-600">{spec.label} · {sizeText(spec)}</p>} />
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
            <button key={p} onClick={() => setPart(p)} aria-pressed={part === p} className="chip flex-1 !px-2">
              {targetLabels[p]}
            </button>
          ))}
        </div>

        {/* 2. Số ảnh (chỉ bìa trước) */}
        {part === "front" && (
          <div className={usingAdminFront ? "opacity-45" : ""}>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-900">Số ảnh</p>
            <div className="flex gap-2">
              {COUNTS.map((n) => (
                <button key={n} aria-pressed={!usingAdminFront && count === n} className="chip flex-1"
                  onClick={() => { setCount(n); setChosen({ ...chosen, front: "" }); }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. Chọn mẫu */}
        {PARTS.map((p) => {
          if (p !== part) return null;
          const spec = SPECS[p];
          const list = templates.filter((t) => t.target === p);
          const free = chosen[p] === "";
          return (
            <div key={p}>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-900">Chọn mẫu</p>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                <button onClick={() => setChosen({ ...chosen, [p]: "" })}
                  className={`w-20 shrink-0 rounded-[14px] border-2 bg-white p-1.5 text-center text-[11px] font-semibold text-ink-900 ${free ? "border-ink-900 bg-lime-500" : "border-ink-100"}`}>
                  <div className={`mb-1 grid aspect-square place-items-center bg-cream-100 text-xl ${p === "disc" ? "rounded-full" : "rounded-md"}`}>✎</div>
                  Tự do
                </button>
                {list.map((t) => (
                  <button key={t.id} onClick={() => setChosen({ ...chosen, [p]: t.id })}
                    className={`w-20 shrink-0 rounded-[14px] border-2 bg-white p-1.5 text-center text-[11px] font-semibold text-ink-900 ${chosen[p] === t.id ? "border-ink-900 bg-lime-500" : "border-ink-100"}`}>
                    <div className="mb-1">
                      <TemplateThumb ratio={spec.w / spec.h} slots={t.slots} overlay={t.overlay_url} background={t.background_url} disc={p === "disc"} />
                    </div>
                    <span className="line-clamp-2">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* 4. Công cụ (thanh công cụ của từng phần được gắn vào đây) */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-900">Công cụ</p>
          {PARTS.map((p) => (
            <div key={p} className={p === part ? "" : "hidden"}
              ref={(el) => { if (el && hosts[p] !== el) setHosts((h) => ({ ...h, [p]: el })); }} />
          ))}
        </div>

        {/* 5. Hành động */}
        <div className="mt-auto space-y-2 border-t-[1.5px] border-ink-100 pt-4">
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => download([part])}>Tải {targetLabels[part].toLowerCase()}</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => download(PARTS)}>Tải cả 3 phần</button>
          </div>
          <button className="btn w-full" disabled={busy} onClick={() => setOrdering(true)}>Gửi đơn / Lưu thiết kế →</button>
          {msg && <p className="text-center text-sm">{msg}</p>}
          <p className="text-center text-xs text-ink-500">File xuất PNG 300 DPI đúng khổ in, không có đường cắt.</p>
        </div>
      </aside>

      {ordering && (
        <OrderDialog orderType="custom_cd" title="Gửi đơn Custom CD" packages={packages} onClose={() => setOrdering(false)}
          getFiles={async () => (await Promise.all(PARTS.map(exportPart))).filter((f): f is DesignFile => !!f)} />
      )}
    </div>
  );
}
