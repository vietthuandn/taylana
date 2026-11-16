"use client";

import { useRef, useState } from "react";
import { SPECS } from "@/lib/print";
import { defaultFrames, type PhotostripFrame } from "@/lib/templates";
import { Designer, type DesignerHandle } from "@/components/designer/Designer";
import { TemplateThumb } from "@/components/designer/TemplateThumb";
import { OrderDialog, downloadBlob } from "@/components/designer/OrderDialog";

const spec = SPECS.photostrip;

function today() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export function PhotostripEditor({ frames: dbFrames }: { frames: PhotostripFrame[] }) {
  const frames = dbFrames.length ? dbFrames : defaultFrames;
  const counts = Array.from(new Set(frames.map((f) => f.slot_count))).sort();
  const [count, setCount] = useState<number>(counts.includes(4) ? 4 : counts[0]);
  const list = frames.filter((f) => f.slot_count === count);
  const [frameId, setFrameId] = useState(list[0]?.id ?? "");
  const frame = list.find((f) => f.id === frameId) ?? list[0] ?? null;
  const ref = useRef<DesignerHandle>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ordering, setOrdering] = useState(false);

  async function download() {
    setBusy(true);
    setMsg("");
    try {
      const blob = await ref.current!.exportBlob();
      downloadBlob(blob, `photostrip-2x6-300dpi.png`);
      setMsg("✓ Đã tải PNG 2x6 inch, 300 DPI (600 x 1800 px)");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi xuất file");
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-5xl px-4">
      <div className="grid gap-8 md:grid-cols-[1fr_280px]">
        <div className="md:order-2">
          {counts.length > 1 && (
            <div className="mb-4 flex justify-center gap-2 md:justify-start">
              {counts.map((n) => (
                <button key={n} onClick={() => { setCount(n); setFrameId(frames.find((f) => f.slot_count === n)?.id ?? ""); }}
                  aria-pressed={count === n} className="chip !px-5 !text-base">
                  {n} ảnh
                </button>
              ))}
            </div>
          )}
          <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-ink-900 md:text-left">Chọn khung</p>
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 md:flex-wrap">
            {list.map((f) => (
              <button key={f.id} onClick={() => setFrameId(f.id)}
                className={`w-20 shrink-0 rounded-[16px] border-2 bg-white p-2 text-center text-xs font-semibold text-ink-900 ${frame?.id === f.id ? "border-ink-900 bg-lime-500" : "border-ink-100"}`}>
                <div className="mx-auto mb-1 w-10">
                  <TemplateThumb ratio={spec.w / spec.h} slots={f.slots} overlay={f.overlay_url} background={f.background_url} bgColor={f.background_color} />
                </div>
                <span className="line-clamp-2">{f.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="md:order-1">
          <Designer ref={ref} spec={spec} width={230} template={frame}
            extraTools={({ addText }) => (
              <button className="chip" onClick={() => addText(today())}>＋ Ngày tháng</button>
            )} />
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-xl rounded-[28px] bg-violet-500 p-6 text-center text-white">
        <p className="mb-3 font-display text-3xl uppercase text-white">Xong rồi thì...</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn btn-ghost !border-white !text-white hover:!bg-white hover:!text-ink-900" disabled={busy} onClick={download}>Tải ảnh PNG</button>
          <button className="btn btn-lime" disabled={busy} onClick={() => setOrdering(true)}>Gửi đơn in →</button>
        </div>
        {msg && <p className="mt-3 text-sm">{msg}</p>}
      </div>

      {ordering && (
        <OrderDialog orderType="photostrip" title="Gửi đơn in Photostrip" quantityLabel="Số bản in" onClose={() => setOrdering(false)}
          getFiles={async () => {
            const h = ref.current;
            if (!h || h.isEmpty()) return [];
            return [{ kind: "photostrip", blob: await h.exportBlob(), name: "photostrip-2x6-300dpi.png" }];
          }} />
      )}
    </div>
  );
}
