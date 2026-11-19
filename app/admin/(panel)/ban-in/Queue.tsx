"use client";
/* Bàn in → Hàng đợi in: chia theo NHÓM (Booklet · Bìa trước · Bìa sau · Card · Mặt đĩa) hoặc theo từng đơn; mỗi nhóm các bước
   Mặt trước → Lật giấy (hình minh hoạ theo hồ sơ in, nút "Đã lật xong") → Mặt sau. Mỗi bước: số tờ, ảnh thu nhỏ trang đầu,
   "In bước này" (mở PDF tab mới + tự gọi lệnh in), "Tải PDF", "In lại 1 tờ". Tiến độ lưu ở print_batches.progress (tải lại vẫn còn);
   xong mọi bước của 1 đơn → đơn "Đã in". Hồ sơ in (lề tràn, vạch cắt, lệch mặt sau, kiểu lật…) lưu trên máy này. */
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Download, FileText, Printer, RotateCcw, Settings2, X } from "lucide-react";
import { patchOrders, saveProgress } from "@/lib/printShop/db";
import { fileKey, getFile } from "@/lib/printShop/files";
import { loadProfile, plan, saveProfile, type Profile, type Step } from "@/lib/printShop/layout";
import { buildPdf, downloadPdf, openPdf, previewSheet, type ImgSrc } from "@/lib/printShop/pdf";
import { pickingListPdf } from "@/lib/printShop/picking";
import type { Addon, Batch, Item, Order, Pack, Slot } from "@/lib/printShop/types";
import { promptDialog } from "@/components/ui/dialog";
import { Button, toast } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

export function Queue({ batch, orders, packs, addons, items, slotsFor, onBatch, onOrders, onClose }: {
  batch: Batch; orders: Order[]; packs: Pack[]; addons: Addon[]; items: Item[]; slotsFor: (o: Order) => Slot[]; onBatch: (b: Batch) => void; onOrders: (ids: string[], v: Partial<Order>) => void; onClose: () => void;
}) {
  const run = batch.progress!.run!;
  const [pr, setPr] = useState<Profile>(() => loadProfile());
  const [showPr, setShowPr] = useState(false);
  const [busy, setBusy] = useState("");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const list = useMemo(() => run.orderIds.map((id) => orders.find((o) => o.id === id)).filter(Boolean) as Order[], [run.orderIds, orders]);
  const sections = useMemo(() => plan(list, slotsFor, run.mode, run.merge, pr), [list, slotsFor, run.mode, run.merge, pr]);
  const steps = sections.flatMap((s) => s.steps);
  const done = batch.progress?.done ?? {};
  const src: ImgSrc = async (o, s) => { const f = await getFile(fileKey(batch.id, o, s)); const it = items.find((i) => i.order_id === o && i.slot === s); return f ? { blob: f.blob, rot: it?.rot ?? 0 } : null; };
  useEffect(() => { saveProfile(pr); }, [pr]);
  useEffect(() => {
    let stop = false;
    (async () => { for (const st of steps) { if (stop) return; if (!st.sheets[0]) continue; const u = await previewSheet(st.sheets[0], pr, src).catch(() => ""); if (!stop) setThumbs((m) => ({ ...m, [st.key]: u })); } })();
    return () => { stop = true; };
  }, [sections]); // eslint-disable-line react-hooks/exhaustive-deps

  async function mark(st: Step, v: boolean) {
    const progress = { ...batch.progress, done: { ...done, [st.key]: v } };
    onBatch({ ...batch, progress });
    await saveProgress(batch.id, progress).catch((e) => toast(e instanceof Error ? e.message : "Lỗi lưu tiến độ", "err"));
    // xong mọi bước có đơn đó → "Đã in"
    const fin = list.filter((o) => steps.filter((s) => s.orderIds.includes(o.id)).every((s) => progress.done[s.key]));
    const ids = fin.filter((o) => o.status !== "printed").map((o) => o.id);
    if (ids.length) { onOrders(ids, { status: "printed" }); await patchOrders(ids, { status: "printed" }).catch(() => undefined); toast(`${ids.length} đơn đã in xong`); }
  }
  async function pdf(st: Step, only?: number) {
    setBusy(st.key);
    try {
      const sheets = only ? [st.sheets[only - 1]].filter(Boolean) : st.sheets;
      const bytes = await buildPdf(sheets, pr, src, { autoprint: true, onProgress: (d, t) => setBusy(`${st.key}|${d}/${t}`) });
      return bytes;
    } catch (e) { toast(e instanceof Error ? e.message : "Tạo PDF thất bại", "err"); return null; }
    finally { setBusy(""); }
  }
  const fileName = (st: Step) => `${batch.name.replace(/[^\p{L}\d]+/gu, "-")}-${st.title.replace(/[^\p{L}\d]+/gu, "-")}.pdf`;
  const P = (k: keyof Profile, v: Profile[keyof Profile]) => setPr({ ...pr, [k]: v });
  const nDone = steps.filter((s) => done[s.key]).length;
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#f7f7f8]" role="dialog" aria-modal>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#e5e5e7] bg-white px-5 py-3">
        <p className="text-[16px] font-semibold">Hàng đợi in · {list.length} đơn</p>
        <span className="text-[13px] text-[#71717a]">{run.mode === "group" ? "Theo nhóm" : "Theo từng đơn"} · {run.merge ? "gộp nhiều đơn / tờ" : "không gộp"} · đã in {nDone}/{steps.length} bước</span>
        <span className="flex-1" />
        <Button size="sm" variant="secondary" icon={<FileText size={14} />} onClick={async () => { const b = await pickingListPdf(list, packs, addons, sections, `Danh sách soạn hàng · ${batch.name}`); openPdf(b); }}>In danh sách soạn hàng</Button>
        <Button size="sm" variant="secondary" icon={<Settings2 size={14} />} onClick={() => setShowPr((v) => !v)}>Hồ sơ in</Button>
        <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-[8px] hover:bg-[#f4f4f5]" aria-label="Đóng"><X size={18} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1200px] space-y-5 p-5">
          {showPr && (
            <div className="grid gap-3 rounded-[12px] border border-[#e5e5e7] bg-white p-4 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
              <label>Lề tràn (mm)<input type="number" step={0.5} min={0} max={5} value={pr.bleed} onChange={(e) => P("bleed", Math.max(0, Number(e.target.value)))} className="mt-1 h-8 w-full rounded-[6px] border border-[#e5e5e7] px-2" /></label>
              <label>Lệch mặt sau ngang (mm)<input type="number" step={0.1} value={pr.backDx} onChange={(e) => P("backDx", Number(e.target.value))} className="mt-1 h-8 w-full rounded-[6px] border border-[#e5e5e7] px-2" /></label>
              <label>Lệch mặt sau dọc (mm)<input type="number" step={0.1} value={pr.backDy} onChange={(e) => P("backDy", Number(e.target.value))} className="mt-1 h-8 w-full rounded-[6px] border border-[#e5e5e7] px-2" /></label>
              <label>Kiểu lật giấy<select value={pr.flip} onChange={(e) => P("flip", e.target.value as Profile["flip"])} className="mt-1 h-8 w-full rounded-[6px] border border-[#e5e5e7] px-2"><option value="long">Lật cạnh dài</option><option value="short">Lật cạnh ngắn</option></select></label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={pr.marks} onChange={(e) => P("marks", e.target.checked)} className="accent-[#ff5fa2]" /> Vạch cắt</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={pr.backRotate} onChange={(e) => P("backRotate", e.target.checked)} className="accent-[#ff5fa2]" /> Xoay mặt sau 180°</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={pr.reverseBack} onChange={(e) => P("reverseBack", e.target.checked)} className="accent-[#ff5fa2]" /> In mặt sau thứ tự ngược</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={pr.feedFaceUp} onChange={(e) => P("feedFaceUp", e.target.checked)} className="accent-[#ff5fa2]" /> Khay: mặt sẽ in hướng lên</label>
            </div>
          )}
          <div className="rounded-[12px] border border-[#fde68a] bg-[#fffbeb] p-3 text-[13px] text-[#92400e]">
            <b>Cài đặt máy in mỗi lần in:</b> chọn đúng khổ giấy ghi ở từng bước (A4 / A5 / A6 / 12 × 12 cm) · Tỉ lệ <b>100% / Actual size</b> (tắt “Fit to page”, “Vừa trang”) · In <b>1 mặt</b> · Chất lượng cao · đúng loại giấy. Mặt sau in sau khi lật xấp giấy theo hướng dẫn.
          </div>
          {sections.map((sec) => (
            <section key={sec.title}>
              <h3 className="mb-2 text-[15px] font-semibold">{sec.title}</h3>
              <div className="grid gap-3 md:grid-cols-3">
                {sec.steps.map((st, i) => {
                  const ok = !!done[st.key], prog = busy.startsWith(st.key) ? busy.split("|").pop() : "";
                  return (
                    <div key={st.key} className={cx("flex flex-col rounded-[12px] border bg-white p-3", ok ? "border-[#86efac]" : "border-[#e5e5e7]")}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-[#f4f4f5] text-[12px] font-semibold">{i + 1}</span>
                        <p className="min-w-0 flex-1 truncate text-[14px] font-semibold">{st.title}</p>
                        <button type="button" onClick={() => mark(st, !ok)} className={cx("inline-flex items-center gap-1 text-[12px] font-medium", ok ? "text-[#15803d]" : "text-[#a1a1aa]")}>{ok ? <CheckCircle2 size={15} /> : <Circle size={15} />}{ok ? "Đã in" : "Chưa in"}</button>
                      </div>
                      {st.kind === "flip" ? (
                        <>
                          <FlipArt pr={pr} sheets={sec.steps[i - 1]?.sheets.length ?? 0} portrait={(sec.steps[i - 1]?.sheets[0]?.pw ?? 1) < (sec.steps[i - 1]?.sheets[0]?.ph ?? 2)} />
                          <Button size="sm" className="mt-auto" icon={<RotateCcw size={14} />} onClick={() => mark(st, true)} disabled={ok}>Đã lật xong</Button>
                        </>
                      ) : (
                        <>
                          <p className="text-[12px] text-[#71717a]">{st.sheets.length} tờ · {st.sheets[0]?.paper}{st.note ? ` · ${st.note}` : ""}</p>
                          <div className="my-2 grid h-[150px] place-items-center rounded-[8px] bg-[#f4f4f5] p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {thumbs[st.key] ? <img src={thumbs[st.key]} alt="" className="max-h-full max-w-full shadow" /> : <span className="text-[12px] text-[#a1a1aa]">Đang dựng…</span>}
                          </div>
                          <div className="mt-auto flex flex-wrap gap-1.5">
                            <Button size="sm" icon={<Printer size={14} />} loading={busy.startsWith(st.key)} onClick={async () => { const b = await pdf(st); if (b) { openPdf(b); await mark(st, true); } }}>{prog ? `Đang tạo ${prog}` : "In bước này"}</Button>
                            <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={async () => { const b = await pdf(st); if (b) downloadPdf(b, fileName(st)); }}>Tải PDF</Button>
                            <Button size="sm" variant="secondary" onClick={async () => {
                              const v = await promptDialog({ title: "In lại 1 tờ", label: `Tờ số (1–${st.sheets.length})`, defaultValue: "1", confirmText: "In tờ này" });
                              const n = Number(v); if (!n || n < 1 || n > st.sheets.length) return;
                              const b = await pdf(st, n); if (b) openPdf(b);
                            }}>In lại 1 tờ</Button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {!sections.length && <p className="rounded-[12px] bg-white p-6 text-center text-[14px] text-[#71717a]">Không có gì để in.</p>}
        </div>
      </div>
    </div>
  );
}

/** hình minh hoạ lật giấy theo hồ sơ in */
function FlipArt({ pr, sheets, portrait }: { pr: Profile; sheets: number; portrait: boolean }) {
  const long = pr.flip === "long";
  // trục lật: cạnh dài của tờ dọc = cạnh trái / phải (lật như trang sách) · cạnh ngắn = cạnh trên / dưới (lật như lịch)
  const vertAxis = long === portrait;
  const W = portrait ? 46 : 64, H = portrait ? 64 : 46;
  return (
    <div className="space-y-2">
      <svg viewBox="0 0 260 110" className="w-full" aria-hidden>
        <defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#ff5fa2" /></marker></defs>
        <g transform={`translate(${60 - W / 2} ${55 - H / 2})`}>
          {[6, 3, 0].map((o) => <rect key={o} x={o} y={-o} width={W} height={H} rx="2" fill="#fff" stroke="#a1a1aa" />)}
          <text x={W / 2} y={H / 2 + 5} textAnchor="middle" fontSize="16" fontWeight="700" fill="#ff5fa2">1</text>
          <text x={W / 2} y={H + 14} textAnchor="middle" fontSize="9" fill="#71717a">mặt đã in</text>
        </g>
        {vertAxis
          ? <path d="M95 40 C 125 10, 145 10, 165 40" fill="none" stroke="#ff5fa2" strokeWidth="2" markerEnd="url(#ar)" />
          : <path d="M130 20 C 100 55, 160 55, 130 90" fill="none" stroke="#ff5fa2" strokeWidth="2" markerEnd="url(#ar)" />}
        <g transform={`translate(${200 - W / 2} ${55 - H / 2})`}>
          {[6, 3, 0].map((o) => <rect key={o} x={o} y={-o} width={W} height={H} rx="2" fill="#f4f4f5" stroke="#a1a1aa" />)}
          <text x={W / 2} y={H / 2 + 4} textAnchor="middle" fontSize="10" fill="#52525b">mặt trắng</text>
          <path d={`M${W / 2 - 8} ${-14} L${W / 2} ${-4} L${W / 2 + 8} ${-14}`} fill="none" stroke="#2563eb" strokeWidth="2" />
          <text x={W / 2} y={-18} textAnchor="middle" fontSize="9" fill="#2563eb">vào khay trước</text>
        </g>
      </svg>
      <ol className="list-decimal space-y-0.5 pl-4 text-[12px] text-[#3f3f46]">
        <li>Lấy cả xấp {sheets} tờ vừa in ra, <b>giữ nguyên thứ tự</b>.</li>
        <li>Lật xấp giấy theo <b>cạnh {long ? "dài" : "ngắn"}</b> ({vertAxis ? "như lật trang sách: cạnh trái ↔ phải" : "như lật lịch: cạnh trên ↔ dưới"}).</li>
        <li>Đặt vào khay với <b>mặt trắng hướng {pr.feedFaceUp ? "lên" : "xuống"}</b> (mặt đã in hướng {pr.feedFaceUp ? "xuống" : "lên"}).</li>
        <li>Cạnh <b>{vertAxis ? "trên" : "dưới"}</b> của mặt đã in vào máy trước{pr.reverseBack ? " · mặt sau in theo thứ tự ngược" : ""}.</li>
      </ol>
    </div>
  );
}
