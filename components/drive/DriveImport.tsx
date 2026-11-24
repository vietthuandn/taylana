"use client";
/* Modal "Từ Google Drive": dán link thư mục / file → đọc danh sách ảnh (Drive API trên trình duyệt) → bảng "tên file → ô"
   (giống Tải nhiều ảnh: không nhận ra / trùng ô thì tô vàng + chọn ô) → Xác nhận: tải ảnh (3 file song song, thanh tiến độ) → trả về File.
   Không truyền slots: chỉ danh sách ảnh (Bàn in tự xếp ô). */
import { useState } from "react";
import { FolderOpen, Loader2, X } from "lucide-react";
import { DRIVE_MAX_FILES, DriveError, downloadDriveFiles, readDriveLink, type DriveFile } from "@/lib/drive";
import { matchFileName, type PackLayout } from "@/lib/matchFileName";
import { btnClass, cx, inputClass } from "@/components/ui/styles";

type SlotOpt = { id: string; full: string };
type Row = { file: DriveFile; slot: string; dup: boolean };

export function DriveImport({ slots, layout, onClose, onDone }: {
  slots?: SlotOpt[]; layout?: PackLayout; onClose: () => void;
  onDone: (items: { file: File; slot: string | null }[], errors: string[]) => void;
}) {
  const [link, setLink] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [info, setInfo] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<"" | "read" | "down">("");
  const [prog, setProg] = useState({ done: 0, total: 0 });
  const withSlots = !!slots && !!layout;

  async function read() {
    setErr(""); setInfo(""); setRows(null); setBusy("read");
    try {
      const { files, skipped } = await readDriveLink(link);
      if (!files.length) throw new DriveError("Thư mục không có file ảnh.");
      const list = files.slice(0, DRIVE_MAX_FILES);
      const taken = new Set<string>();
      setRows(list.map((f) => {
        const auto = withSlots ? matchFileName(f.name, layout!) ?? (f.folder ? matchFileName(`${f.folder} ${f.name}`, layout!) : null) : null;
        const dup = !!auto && taken.has(auto);
        if (auto && !dup) taken.add(auto);
        return { file: f, slot: auto && !dup ? auto : "", dup };
      }));
      setInfo([`${files.length} ảnh`, skipped ? `Bỏ qua ${skipped} file nhạc / khác` : "", files.length > DRIVE_MAX_FILES ? `chỉ lấy ${DRIVE_MAX_FILES} ảnh đầu` : ""].filter(Boolean).join(" · "));
    } catch (e) { setErr(e instanceof DriveError ? e.message : "Không đọc được thư mục. Kiểm tra quyền chia sẻ: Bất kỳ ai có đường liên kết."); }
    setBusy("");
  }
  async function confirm() {
    if (!rows) return;
    const pick = withSlots ? rows.filter((r) => r.slot) : rows;
    if (!pick.length) return;
    setBusy("down"); setProg({ done: 0, total: pick.length });
    const { out, errors } = await downloadDriveFiles(pick, (done, total) => setProg({ done, total }));
    setBusy("");
    onDone(out.map((o) => ({ file: o.blob, slot: withSlots ? o.slot : null })), errors);
  }
  const count = (id: string) => rows?.filter((r) => r.slot === id).length ?? 0;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal>
      <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[14px] bg-white font-sans text-[14px] text-[#18181b] shadow-xl">
        <div className="flex items-start gap-2 border-b border-[#ecebe7] px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold">Từ Google Drive</p>
            <p className="text-[12px] text-[#71717a]">Thư mục cần để quyền: Bất kỳ ai có đường liên kết đều xem được.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy === "down"} aria-label="Đóng" className="p-1 text-[#71717a]"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-auto p-5">
          <div className="flex gap-2">
            <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === "Enter" && link.trim() && read()} placeholder="Dán link thư mục hoặc file Google Drive"
              className={cx(inputClass, "flex-1")} autoFocus />
            <button type="button" onClick={read} disabled={!link.trim() || !!busy} className={btnClass("secondary")}>
              {busy === "read" ? <Loader2 size={15} className="animate-spin" /> : <FolderOpen size={15} />} Đọc
            </button>
          </div>
          {err && <p className="mt-3 rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{err}</p>}
          {info && <p className="mt-3 text-[12px] text-[#71717a]">{info}</p>}
          {rows && rows.length > 0 && (
            <table className="mt-2 w-full text-[13px]">
              <thead><tr className="text-left text-[12px] text-[#71717a]"><th className="py-1.5 font-medium">Tên file</th>{withSlots && <th className="py-1.5 font-medium">Xếp vào ô</th>}<th /></tr></thead>
              <tbody>
                {rows.map((r, i) => {
                  const warn = withSlots && (!r.slot || count(r.slot) > 1);
                  return (
                    <tr key={r.file.id} className={cx("border-t border-[#ecebe7]", warn && "bg-[#fff6d6]")}>
                      <td className="max-w-[260px] px-1.5 py-1.5">
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {r.file.thumb ? <img src={r.file.thumb} alt="" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-[6px] bg-[#f4f4f5] object-cover" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /> : <span className="h-10 w-10 shrink-0 rounded-[6px] bg-[#f4f4f5]" />}
                          <span className="min-w-0"><span className="block truncate" title={r.file.name}>{r.file.name}</span>
                            {r.file.folder && <span className="block truncate text-[11px] text-[#a1a1aa]">{r.file.folder}</span>}
                            {warn && <span className="block text-[11px] text-[#a16207]">{r.dup && !r.slot ? "Trùng ô, chọn lại" : !r.slot ? "Không nhận ra, chọn ô" : "Trùng ô"}</span>}</span>
                        </div>
                      </td>
                      {withSlots && (
                        <td className="px-1.5 py-1.5">
                          <select className={inputClass} value={r.slot} onChange={(e) => setRows((cur) => cur!.map((x, j) => (j === i ? { ...x, slot: e.target.value } : x)))}>
                            <option value="">— Bỏ qua —</option>
                            {slots!.map((s) => <option key={s.id} value={s.id}>{s.full}</option>)}
                          </select>
                        </td>
                      )}
                      <td className="w-8 text-right"><button type="button" className="text-[16px] text-[#71717a]" aria-label="Bỏ file" onClick={() => setRows((cur) => cur!.filter((_, j) => j !== i))}>×</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {busy === "down" && (
          <div className="px-5 pb-2">
            <div className="h-2 overflow-hidden rounded-full bg-[#f4f4f5]"><div className="h-full bg-[var(--c-primary,#ff5fa2)] transition-[width]" style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%` }} /></div>
            <p className="mt-1 text-[12px] text-[#71717a]">Đang tải {prog.done} / {prog.total} ảnh…</p>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-[#ecebe7] px-5 py-3">
          <button type="button" className={btnClass("secondary")} onClick={onClose} disabled={busy === "down"}>Huỷ</button>
          <button type="button" className="h-9 rounded-[8px] bg-[var(--c-primary,#ff5fa2)] px-5 text-[14px] font-semibold text-white disabled:opacity-45"
            disabled={!rows || !!busy || (withSlots ? !rows.some((r) => r.slot) : !rows.length)} onClick={confirm}>Xác nhận</button>
        </div>
      </div>
    </div>
  );
}
