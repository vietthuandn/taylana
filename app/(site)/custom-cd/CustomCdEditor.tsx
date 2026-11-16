"use client";

import { useRef, useState } from "react";
import { SPECS, sizeText, type PrintSpec } from "@/lib/print";
import { targetLabels, type DesignTemplate } from "@/lib/templates";
import type { Package } from "@/lib/types";
import { Designer, type DesignerHandle } from "@/components/designer/Designer";
import { TemplateThumb } from "@/components/designer/TemplateThumb";
import { OrderDialog, downloadBlob, type DesignFile } from "@/components/designer/OrderDialog";
import { useWidth } from "@/components/designer/useWidth";

type Part = "front" | "back" | "disc";
const PARTS: Part[] = ["front", "back", "disc"];
const fileNames: Record<Part, string> = { front: "bia-truoc", back: "bia-sau", disc: "mat-cd" };

export function CustomCdEditor({ templates, packages }: { templates: DesignTemplate[]; packages: Package[] }) {
  const [part, setPart] = useState<Part>("front");
  const [chosen, setChosen] = useState<Record<Part, string>>({ front: "", back: "", disc: "" });
  const [wrapRef, wrapW] = useWidth<HTMLDivElement>();
  const refs = { front: useRef<DesignerHandle>(null), back: useRef<DesignerHandle>(null), disc: useRef<DesignerHandle>(null) };
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ordering, setOrdering] = useState(false);

  const widthFor = (spec: PrintSpec) => {
    const max = spec.w > spec.h ? 620 : 520;
    return Math.max(240, Math.min(wrapW, max));
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

  return (
    <div className="mx-auto max-w-4xl px-4">
      {/* Chọn phần đang thiết kế */}
      <div className="mb-5 flex justify-center gap-2">
        {PARTS.map((p) => (
          <button key={p} onClick={() => setPart(p)}
            className={`pop-sm rounded-full px-4 py-2 font-display text-lg ${part === p ? "bg-pink-300" : "bg-cream-50"}`}>
            {targetLabels[p]}
          </button>
        ))}
      </div>

      <div ref={wrapRef}>
      {PARTS.map((p) => {
        const spec = SPECS[p];
        const list = templates.filter((t) => t.target === p);
        const tpl = list.find((t) => t.id === chosen[p]) ?? null;
        return (
          <section key={p} className={p === part ? "" : "hidden"}>
            <p className="mb-3 text-center text-sm text-cocoa-500">
              {spec.label} · {sizeText(spec)}{p === "back" ? " (gồm 2 gáy hộp ở hai bên)" : ""}{p === "disc" ? " · hình tròn có lỗ giữa" : ""}
            </p>

            {/* Chọn mẫu */}
            <div className="mb-5 flex gap-3 overflow-x-auto pb-2">
              <button onClick={() => setChosen({ ...chosen, [p]: "" })}
                className={`pop-sm w-24 shrink-0 rounded-2xl p-2 text-center text-xs ${!tpl ? "bg-pink-200" : "bg-cream-50"}`}>
                <div className={`mb-1 grid aspect-square place-items-center bg-white text-2xl ${p === "disc" ? "rounded-full" : "rounded-md"}`}>✎</div>
                Tự do
              </button>
              {list.map((t) => (
                <button key={t.id} onClick={() => setChosen({ ...chosen, [p]: t.id })}
                  className={`pop-sm w-24 shrink-0 rounded-2xl p-2 text-center text-xs ${tpl?.id === t.id ? "bg-pink-200" : "bg-cream-50"}`}>
                  <div className="mb-1">
                    <TemplateThumb ratio={spec.w / spec.h} slots={t.slots} overlay={t.overlay_url} background={t.background_url} disc={p === "disc"} />
                  </div>
                  <span className="line-clamp-2">{t.name}</span>
                </button>
              ))}
            </div>

            {wrapW > 0 && <Designer ref={refs[p]} spec={spec} width={widthFor(spec)} template={tpl} active={p === part} />}
          </section>
        );
      })}
      </div>

      <div className="pop mx-auto mt-8 max-w-xl rounded-[2rem] bg-pink-100 p-5 text-center">
        <p className="font-display text-xl">Xong rồi thì...</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button className="btn bg-cream-50 !text-base" disabled={busy} onClick={() => download([part])}>Tải {targetLabels[part].toLowerCase()}</button>
          <button className="btn bg-cream-50 !text-base" disabled={busy} onClick={() => download(PARTS)}>Tải cả 3 phần</button>
          <button className="btn bg-pink-300 !text-base" disabled={busy} onClick={() => setOrdering(true)}>Gửi kèm đơn ♡</button>
        </div>
        {msg && <p className="mt-3 text-sm">{msg}</p>}
        <p className="mt-3 text-xs text-cocoa-500">File xuất PNG 300 DPI đúng khổ in, không có đường cắt.</p>
      </div>

      {ordering && (
        <OrderDialog orderType="custom_cd" title="Gửi đơn Custom CD" packages={packages} onClose={() => setOrdering(false)}
          getFiles={async () => (await Promise.all(PARTS.map(exportPart))).filter((f): f is DesignFile => !!f)} />
      )}
    </div>
  );
}
