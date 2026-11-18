"use client";

/* Khu tải ảnh CD dùng chung (Gửi file CD + Xem Mockup): nút "Tải nhiều ảnh" (tự nhận diện theo tên file),
   các ô theo đúng gói, thay ảnh, xoá, cảnh báo độ phân giải. Sửa ở đây là cả 2 trang cùng đổi.
   variant "grid": ô lớn có mockup (Gửi file) · "list": danh sách dọc gọn, booklet thành lưới 4 cột (Mockup). */
import { useRef, useState } from "react";
import Link from "next/link";
import { Check, FileCheck2, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { matchFileName, type PackLayout } from "@/lib/matchFileName";
import { PrintArea } from "@/components/mockup/Mockups";
import { btnClass, cx, inputClass } from "@/components/ui/styles";
import { ACCEPT, PINK, type Picked, type SlotDef } from "./cdSlots";

export type ExistingFile = { name: string; url: string | null; pdf: boolean };

export function CdUploadPanel({ slots, layout, files, existing = {}, readOnly, variant = "grid", onPick, onRemove, onPreview, previewing }: {
  slots: SlotDef[]; layout: PackLayout; files: Record<string, Picked>; existing?: Record<string, ExistingFile>;
  readOnly?: boolean; variant?: "grid" | "list" | "compact"; onPick: (s: SlotDef, f: File) => void; onRemove: (s: SlotDef) => void; onPreview?: () => void; previewing?: boolean;
}) {
  const [multiOpen, setMultiOpen] = useState(false);
  const groups = (["front", "back", "disc"] as const).map((g) => ({ g, list: slots.filter((s) => s.group === g) })).filter((x) => x.list.length);
  const title = (g: string) => (g === "front" ? (layout.front >= 4 ? "Bìa trước · Booklet" : "Bìa trước") : g === "back" ? "Bìa sau" : "Mặt đĩa");
  const size = (g: string) => (g === "front" ? "12 × 12 cm" : g === "back" ? "15 × 11.7 cm" : "Tròn 12 cm");

  const multi = multiOpen && (
    <MultiUpload slots={slots} layout={layout} onCancel={() => setMultiOpen(false)}
      onConfirm={async (rows) => {
        setMultiOpen(false);
        for (const r of rows) {
          const s = slots.find((x) => x.id === r.slot);
          if (s) onPick(s, r.file);
        }
      }} />
  );

  // compact (trang Mockup): nút hồng full → các section, mọi section chung lưới 4 cột
  if (variant === "compact") {
    return (
      <div className="space-y-6">
        <button type="button" onClick={() => setMultiOpen(true)}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[8px] text-[14px] font-semibold text-white transition-opacity hover:opacity-90" style={{ background: PINK }}>
          <Upload size={16} /> Tải nhiều ảnh
        </button>
        {groups.map(({ g, list }) => (
          <section key={g}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              {/* tên + kích thước cùng hàng: "Bìa trước (12 × 12 cm)" — kích thước giữ cỡ chữ / màu xám nhỏ */}
              <p className="text-[14px] font-semibold text-[#18181b]">
                {g === "front" ? "Bìa trước" : title(g)} <span className="text-[12px] font-normal text-[#71717a]">({size(g)})</span>
              </p>
              {g === "front" && layout.front >= 4 && onPreview && (
                <button type="button" onClick={onPreview} className="text-[13px] font-medium text-[#ff5fa2] hover:text-[#e0468a]">{previewing ? "Xem CD Mockup ›" : "Xem preview ›"}</button>
              )}
            </div>
            {g === "back" ? (
              // Bìa sau: cao bằng 1 ô Bìa trước, rộng theo 15 : 11.7, căn trái
              <div className="flex gap-2">
                {list.map((s) => <CompactTile key={s.id} slot={s} booklet={layout.front >= 4} picked={files[s.id]} onFile={(f) => onPick(s, f)} onRemove={() => onRemove(s)} />)}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {list.map((s) => <CompactTile key={s.id} slot={s} booklet={layout.front >= 4} picked={files[s.id]} onFile={(f) => onPick(s, f)} onRemove={() => onRemove(s)} />)}
              </div>
            )}
          </section>
        ))}
        {multi}
      </div>
    );
  }

  return (
    <div>
      {!readOnly && (
        <>
          <p className="text-[13px] text-[#71717a]">
            Bạn chưa có ảnh? <Link href="/huong-dan" className="font-semibold text-[#ff5fa2] hover:text-[#e0468a]">Nhấn vào đây</Link> để được hướng dẫn
          </p>
          <button className={`${btnClass("secondary")} mt-3`} onClick={() => setMultiOpen(true)}>⇪ Tải nhiều ảnh</button>
        </>
      )}

      {groups.map(({ g, list }) => (
        <div key={g} className={variant === "grid" ? "mt-7" : "mt-5"}>
          <p className={cx("font-semibold", variant === "grid" ? "mb-3 text-[16px]" : "mb-2 text-[14px]")}>{title(g)}
            <span className="ml-2 text-[12px] font-normal text-[#71717a]">{size(g)}</span>
          </p>
          {variant === "grid" ? (
            <div className={`grid gap-4 ${g === "back" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
              {list.map((s) => <SlotTile key={s.id} slot={s} picked={files[s.id]} readOnly={readOnly} existing={existing[s.id]} onFile={(f) => onPick(s, f)} onRemove={() => onRemove(s)} />)}
            </div>
          ) : g === "front" && layout.front >= 4 ? (
            <div className="grid grid-cols-4 gap-2">
              {list.map((s) => <MiniTile key={s.id} slot={s} picked={files[s.id]} onFile={(f) => onPick(s, f)} onRemove={() => onRemove(s)} />)}
            </div>
          ) : (
            <ul className="divide-y divide-[#efeff1] overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white">
              {list.map((s) => <SlotRow key={s.id} slot={s} picked={files[s.id]} onFile={(f) => onPick(s, f)} onRemove={() => onRemove(s)} />)}
            </ul>
          )}
        </div>
      ))}

      {multi}
    </div>
  );
}

const warnOf = (p?: Picked) => (p?.error ? [p.error] : p?.check && p.check.level !== "ok" ? p.check.messages : []);

// Ô ảnh kiểu compact: trước/đĩa vuông 1 cột · bìa sau 2 cột 15:11.7 · badge góc trái · hover: Thay / Xoá
function CompactTile({ slot, booklet, picked, onFile, onRemove }: { slot: SlotDef; booklet: boolean; picked?: Picked; onFile: (f: File) => void; onRemove: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const has = !!picked && !picked.error && !!picked.preview;
  const warn = warnOf(picked);
  const disc = slot.group === "disc";
  const badge = disc ? "CD" : booklet && slot.group === "front" ? slot.label : slot.label === "Mặt Trong" ? "Trong" : "Ngoài";
  const open = () => input.current?.click();
  return (
    <div title={picked?.file.name ?? slot.full}
      className={cx("group relative shrink-0 rounded-[8px]", slot.group === "back" ? "aspect-[15/11.7] w-[calc((100%-24px)/4*15/11.7)]" : "aspect-square", over && "ring-2 ring-[#ff5fa2]")}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}>
      {has ? (
        <div className={cx("absolute inset-0 overflow-hidden rounded-[8px] border border-[#e5e5e7]", disc && "bg-[#fafafa]")}>
          {disc ? (
            <div className="absolute inset-[6%] overflow-hidden rounded-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={picked!.preview!} alt="" className="h-full w-full object-cover" />
              <span className="absolute left-1/2 top-1/2 h-[19%] w-[19%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#e5e5e7] bg-[#fafafa]" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={picked!.preview!} alt="" className="h-full w-full object-cover" />
          )}
          {/* hover (desktop): phủ đen + 2 nút giữa · điện thoại: 2 nút nhỏ góc dưới phải */}
          <div className="absolute bottom-1 right-1 flex gap-1 transition-opacity md:inset-0 md:items-center md:justify-center md:gap-2 md:bg-black/40 md:opacity-0 md:group-hover:opacity-100">
            <button type="button" onClick={open} aria-label="Thay ảnh" title="Thay ảnh"
              className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#18181b] shadow md:h-8 md:w-8"><RefreshCw size={14} /></button>
            <button type="button" onClick={onRemove} aria-label="Xoá" title="Xoá"
              className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#dc2626] shadow md:h-8 md:w-8"><Trash2 size={14} /></button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={open} aria-label={`Chọn ảnh ${slot.full}`}
          className="absolute inset-0 grid place-items-center rounded-[8px] border-[1.5px] border-dashed border-[#d4d4d8] bg-[#fafafa] text-[#a1a1aa] transition-colors hover:border-[#ff5fa2] hover:text-[#ff5fa2]">
          <Plus size={18} />
        </button>
      )}
      <span className="pointer-events-none absolute left-1 top-1 rounded-[4px] bg-black/70 px-1.5 py-px text-[11px] font-medium leading-[16px] text-white">{badge}</span>
      {warn.length > 0 && <span title={warn.join(" · ")} aria-label={warn.join(" · ")} className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#f97316] ring-2 ring-white" />}
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
    </div>
  );
}

// 1 dòng gọn (trang Mockup): ảnh 56px · tên ô · đổi / xoá
function SlotRow({ slot, picked, onFile, onRemove }: { slot: SlotDef; picked?: Picked; onFile: (f: File) => void; onRemove: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const has = !!picked && !picked.error;
  return (
    <li className={cx("flex items-center gap-3 p-2", over && "bg-[#fff5f9]")}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}>
      <button type="button" onClick={() => input.current?.click()} aria-label={`Chọn ảnh ${slot.full}`}
        className={cx("h-14 w-14 shrink-0 overflow-hidden border border-[#e5e5e7] bg-[#f4f4f5]", slot.group === "disc" ? "rounded-full" : "rounded-[8px]")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {has && picked!.preview ? <img src={picked!.preview} alt="" className="h-full w-full object-cover" /> : <span className="text-[18px] text-[#a1a1aa]">+</span>}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-[#18181b]">{slot.label}</p>
        {has ? <p className="truncate text-[12px] text-[#71717a]">{picked!.file.name}</p> : <p className="text-[12px] text-[#a1a1aa]">Chưa có ảnh</p>}
        {warnOf(picked).map((m) => <p key={m} className="text-[11px] leading-snug text-[#ea7a12]">⚠ {m}</p>)}
      </div>
      <button type="button" onClick={() => input.current?.click()} className="grid h-8 w-8 place-items-center rounded-[8px] text-[#71717a] hover:bg-[#f4f4f5]" aria-label="Đổi ảnh"><RefreshCw size={16} /></button>
      {has && <button type="button" onClick={onRemove} className="grid h-8 w-8 place-items-center rounded-[8px] text-[#71717a] hover:bg-[#fef2f2] hover:text-[#dc2626]" aria-label="Xoá ảnh"><Trash2 size={16} /></button>}
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
    </li>
  );
}

// Ô nhỏ cho booklet (lưới 4 cột)
function MiniTile({ slot, picked, onFile, onRemove }: { slot: SlotDef; picked?: Picked; onFile: (f: File) => void; onRemove: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const has = !!picked && !picked.error;
  const warn = warnOf(picked);
  return (
    <div className="group relative aspect-square overflow-hidden rounded-[8px] border border-[#e5e5e7] bg-[#f4f4f5]"
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}>
      <button type="button" onClick={() => input.current?.click()} className="absolute inset-0" aria-label={`Chọn ảnh ${slot.full}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {has && picked!.preview ? <img src={picked!.preview} alt="" className="h-full w-full object-cover" /> : <span className="text-[18px] text-[#a1a1aa]">+</span>}
      </button>
      <span className="pointer-events-none absolute left-1 top-1 rounded-[4px] bg-black/60 px-1.5 text-[11px] font-semibold text-white">{slot.label}</span>
      {has && <button type="button" onClick={onRemove} aria-label="Xoá ảnh" className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-[12px] text-white opacity-0 group-hover:opacity-100">×</button>}
      {warn.length > 0 && <span title={warn.join(" · ")} className="absolute inset-x-1 bottom-1 rounded-[4px] bg-[#ea7a12] px-1 text-center text-[10px] text-white">⚠ Độ phân giải</span>}
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
    </div>
  );
}

// ---------- 1 ô ảnh ----------
export function SlotTile({ slot, picked, existing, readOnly, onFile, onRemove }: {
  slot: SlotDef; picked?: Picked; existing?: { name: string; url: string | null; pdf: boolean }; readOnly?: boolean;
  onFile: (f: File) => void; onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const isDisc = slot.group === "disc";
  const has = !!picked && !picked.error;
  // file đã gửi trước đó (chưa chọn file mới thay thế)
  if (!has && existing) {
    return (
      <div id={`slot-${slot.id}`} className="scroll-mt-24">
        <p className="mb-1.5 flex items-center gap-1 text-[13px] font-medium">{slot.label} <Check size={13} className="text-[#16a34a]" /></p>
        <div className={`group relative ${isDisc ? "rounded-full" : "rounded-[8px]"}`} style={{ aspectRatio: `${slot.spec.w} / ${slot.spec.h}` }}
          onDragOver={(e) => { if (!readOnly) { e.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f && !readOnly) onFile(f); }}>
          <div className={`absolute inset-0 overflow-hidden ${isDisc ? "rounded-full" : "rounded-[8px] shadow-[0_4px_12px_rgb(0_0_0/0.12)]"} ${over ? "ring-2 ring-[#ff5fa2]" : ""}`}>
            {existing.url ? <PrintArea spec={slot.spec} src={existing.url} isPdf={existing.pdf} bg="#f7f7f8" /> : (
              <div className="grid h-full place-items-center bg-[#ecfdf3] p-3 text-center text-[12px] text-[#15803d]">
                <span><FileCheck2 size={22} className="mx-auto mb-1" />Đã gửi<br /><span className="break-all text-[11px] text-[#3f3f46]">{existing.name}</span></span>
              </div>
            )}
          </div>
          {!readOnly && (
            <button type="button" onClick={() => input.current?.click()} aria-label="Thay file" className="absolute inset-0 grid place-items-center">
              <span className="rounded-[8px] bg-white/95 px-2.5 py-1 text-[12px] font-medium text-[#18181b] opacity-0 shadow transition-opacity group-hover:opacity-100">Thay file</span>
            </button>
          )}
          <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
        </div>
        <p className="mt-1 truncate text-[11px] text-[#71717a]" title={existing.name}>{existing.name}</p>
      </div>
    );
  }
  const warn = picked?.error ? [picked.error] : picked?.check && picked.check.level !== "ok" ? picked.check.messages : [];
  const open = () => input.current?.click();

  return (
    <div id={`slot-${slot.id}`} className="scroll-mt-24">
      <p className="mb-1.5 text-[13px] font-medium">{slot.label}</p>
      <div
        className={`group relative ${isDisc ? "rounded-full" : "rounded-[8px]"} ${over ? "ring-2 ring-[#ff5fa2]" : ""}`}
        style={{ aspectRatio: `${slot.spec.w} / ${slot.spec.h}` }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}>
        {has ? (
          <>
            <div className={`absolute inset-0 overflow-hidden ${isDisc ? "rounded-full" : "rounded-[8px] shadow-[0_4px_12px_rgb(0_0_0/0.12)]"}`}>
              <PrintArea spec={slot.spec} src={picked!.preview} isPdf={picked!.file.type === "application/pdf"} bg="#f7f7f8" />
            </div>
            <button type="button" onClick={open} aria-label="Đổi ảnh"
              className="absolute inset-0 grid place-items-center">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink-900 opacity-35 shadow transition-opacity group-hover:opacity-100">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" />
                </svg>
              </span>
            </button>
            <button type="button" onClick={onRemove} aria-label="Xoá ảnh"
              className={`absolute grid h-6 w-6 place-items-center rounded-full bg-ink-900/75 text-[15px] leading-none text-white hover:bg-ink-900 ${isDisc ? "right-[8%] top-[8%]" : "right-1.5 top-1.5"}`}>×</button>
          </>
        ) : (
          <div className={`absolute inset-0 grid place-items-center border-2 border-dashed border-[#d4d4d8] bg-[#f4f4f5] ${isDisc ? "rounded-full" : "rounded-[8px]"}`}>
            {isDisc && <span className="absolute left-1/2 top-1/2 h-[12.5%] w-[12.5%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-[#d4d4d8] bg-[#f7f7f8]" />}
            <button type="button" onClick={open} className={`${btnClass("secondary", "sm")} ${isDisc ? "relative mt-[45%]" : ""}`}>⇪ Tải lên</button>
          </div>
        )}
        <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
      </div>
      {warn.map((m) => <p key={m} className="mt-1 text-[11px] leading-snug text-[#ea7a12]">⚠ {m}</p>)}
    </div>
  );
}

// ---------- Modal tải nhiều ảnh ----------
type Row = { file: File; slot: string; auto: string | null; dup: boolean };
export function MultiUpload({ slots, layout, onCancel, onConfirm }: {
  slots: SlotDef[]; layout: PackLayout; onCancel: () => void; onConfirm: (rows: Row[]) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function add(list: FileList | null) {
    if (!list) return;
    setRows((cur) => {
      const taken = new Set(cur.map((r) => r.slot).filter(Boolean));
      const next = [...cur];
      for (const file of Array.from(list)) {
        const auto = matchFileName(file.name, layout);
        const dup = !!auto && taken.has(auto);
        if (auto && !dup) taken.add(auto);
        next.push({ file, auto, dup, slot: auto && !dup ? auto : "" });
      }
      return next;
    });
  }
  const count = (id: string) => rows.filter((r) => r.slot === id).length;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink-900/50 p-4" role="dialog" aria-modal>
      <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[14px] bg-white font-sans text-[14px] shadow-xl">
        <div className="border-b border-[#ecebe7] px-5 py-3">
          <p className="text-[16px] font-semibold">Tải nhiều ảnh</p>
          <p className="text-[12px] text-[#71717a]">Đặt tên file như “bia truoc”, “bia sau trong”, “cd”, “trang 2”... để tự xếp vào đúng ô.</p>
        </div>
        <div className="flex-1 overflow-auto p-5">
          <div
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
            className={`grid cursor-pointer place-items-center rounded-[10px] border-2 border-dashed px-4 py-8 text-center ${over ? "border-[#ff5fa2] bg-[#fff0f6]" : "border-[#cfcac2] bg-[#f6f4f0]"}`}>
            <p className="font-medium">Kéo thả ảnh vào đây</p>
            <p className="text-[12px] text-[#71717a]">hoặc bấm để chọn nhiều file (JPG, PNG, PDF ≤ 30MB)</p>
          </div>
          <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only"
            onChange={(e) => { add(e.target.files); e.target.value = ""; }} />

          {rows.length > 0 && (
            <table className="mt-4 w-full text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-[#71717a]"><th className="py-1.5 font-medium">Tên file</th><th className="py-1.5 font-medium">Xếp vào ô</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const warn = !r.slot || count(r.slot) > 1;
                  return (
                    <tr key={i} className={`border-t border-[#ecebe7] ${warn ? "bg-[#fff6d6]" : ""}`}>
                      <td className="max-w-[200px] truncate px-1.5 py-1.5" title={r.file.name}>
                        {r.file.name}
                        {warn && <span className="block text-[11px] text-[#a16207]">{r.dup && !r.slot ? "Trùng ô, chọn lại" : !r.slot ? "Không nhận ra, chọn ô" : "Trùng ô"}</span>}
                      </td>
                      <td className="px-1.5 py-1.5">
                        <select className={inputClass} value={r.slot}
                          onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, slot: e.target.value } : x)))}>
                          <option value="">— Bỏ qua —</option>
                          {slots.map((s) => <option key={s.id} value={s.id}>{s.full}</option>)}
                        </select>
                      </td>
                      <td className="w-8 text-right">
                        <button className="text-[16px] text-[#71717a] hover:text-ink-900" aria-label="Bỏ file"
                          onClick={() => setRows((cur) => cur.filter((_, j) => j !== i))}>×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#ecebe7] px-5 py-3">
          <button className={`${btnClass("secondary")}`} onClick={onCancel}>Huỷ</button>
          <button className="h-9 rounded-[8px] px-5 text-[14px] font-semibold text-white disabled:opacity-45" style={{ background: PINK }}
            disabled={!rows.some((r) => r.slot)} onClick={() => onConfirm(rows.filter((r) => r.slot))}>Xác nhận</button>
        </div>
      </div>
    </div>
  );
}

