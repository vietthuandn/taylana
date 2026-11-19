"use client";
/* Bàn in: danh sách PHIÊN IN (mỗi ngày / mỗi đợt) → mở 1 phiên để làm việc (?phien=<id>).
   Dữ liệu đơn lưu database; ảnh chỉ lưu trên máy (IndexedDB) — phiên "Đã xong" quá 7 ngày tự xoá ảnh. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ImageOff, Pencil, Plus, Printer, RotateCcw, Trash2 } from "lucide-react";
import { createBatch, deleteBatch, listBatches, patchBatch } from "@/lib/printShop/db";
import { cleanupOld, deleteBatchFiles } from "@/lib/printShop/files";
import { fmtDay, type Batch, type Pack } from "@/lib/printShop/types";
import { confirmDialog, promptDialog } from "@/components/ui/dialog";
import { AdminPage, Badge, Button, PageHeader, toast } from "@/components/admin/ui";
import { Workspace } from "./Workspace";

export function BanIn({ packs }: { packs: Pack[] }) {
  const id = useSearchParams().get("phien");
  return id ? <Workspace batchId={id} packs={packs} /> : <Batches />;
}

function Batches() {
  const router = useRouter();
  const [list, setList] = useState<Batch[]>([]);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    try { const b = await listBatches(); setList(b); setErr(""); const n = await cleanupOld(b); if (n) toast(`Đã tự xoá ${n} ảnh của các phiên xong quá 7 ngày`); }
    catch (e) { setErr(e instanceof Error ? e.message : "Lỗi tải"); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function create() {
    const name = await promptDialog({ title: "Tạo phiên in", label: "Tên phiên", defaultValue: fmtDay(), confirmText: "Tạo" });
    if (!name?.trim()) return;
    try { const b = await createBatch(name.trim()); router.push(`/admin/ban-in?phien=${b.id}`); } catch (e) { toast(e instanceof Error ? e.message : "Lỗi", "err"); }
  }
  const act = async (fn: () => Promise<unknown>, text: string) => { try { await fn(); toast(text); await load(); } catch (e) { toast(e instanceof Error ? e.message : "Lỗi", "err"); } };
  return (
    <AdminPage wide>
      <PageHeader title="Bàn in" actions={<Button icon={<Plus size={16} />} onClick={create}>Tạo phiên in</Button>} />
      {err && <p className="mb-3 rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#b91c1c]">{err}</p>}
      {!err && !list.length && <p className="rounded-[12px] border border-dashed border-[#d4d4d8] bg-white p-8 text-center text-[14px] text-[#71717a]">Chưa có phiên in. Bấm “Tạo phiên in” để bắt đầu đợt in hôm nay.</p>}
      <ul className="divide-y divide-[#efeff1] overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white">
        {list.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Printer size={18} className="text-[#a1a1aa]" />
            <Link href={`/admin/ban-in?phien=${b.id}`} className="min-w-0 flex-1 truncate text-[14px] font-medium hover:text-[#ff5fa2]">{b.name}</Link>
            <span className="text-[12px] text-[#a1a1aa]">{new Date(b.created_at).toLocaleString("vi-VN")}</span>
            {b.status === "done" ? <Badge tone="green">Đã xong</Badge> : <Badge tone="amber">Đang làm</Badge>}
            <span className="flex gap-1">
              <button type="button" title="Đổi tên" className="grid h-8 w-8 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5]" onClick={async () => { const v = await promptDialog({ title: "Đổi tên phiên", defaultValue: b.name }); if (v?.trim()) act(() => patchBatch(b.id, { name: v.trim() }), "Đã đổi tên"); }}><Pencil size={15} /></button>
              {b.status === "doing"
                ? <button type="button" title="Đánh dấu Đã xong" className="grid h-8 w-8 place-items-center rounded-[6px] text-[#16a34a] hover:bg-[#f0fdf4]" onClick={() => act(() => patchBatch(b.id, { status: "done", finished_at: new Date().toISOString() }), "Đã đánh dấu xong")}><CheckCircle2 size={15} /></button>
                : <button type="button" title="Mở lại" className="grid h-8 w-8 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5]" onClick={() => act(() => patchBatch(b.id, { status: "doing", finished_at: null }), "Đã mở lại")}><RotateCcw size={15} /></button>}
              <button type="button" title="Xoá ảnh của phiên (trên máy này)" className="grid h-8 w-8 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5]"
                onClick={async () => { if (await confirmDialog({ title: "Xoá ảnh của phiên?", message: "Xoá mọi ảnh của phiên này đang lưu trên máy (IndexedDB). Danh sách đơn vẫn giữ.", confirmText: "Xoá ảnh", danger: true })) act(async () => toast(`Đã xoá ${await deleteBatchFiles(b.id)} ảnh`), "Xong"); }}><ImageOff size={15} /></button>
              <button type="button" title="Xoá phiên" className="grid h-8 w-8 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#fef2f2] hover:text-[#dc2626]"
                onClick={async () => { if (await confirmDialog({ title: `Xoá phiên “${b.name}”?`, message: "Xoá mọi đơn của phiên và ảnh trên máy. Không khôi phục được.", confirmText: "Xoá", danger: true })) act(async () => { await deleteBatchFiles(b.id).catch(() => 0); await deleteBatch(b.id); }, "Đã xoá phiên"); }}><Trash2 size={15} /></button>
            </span>
          </li>
        ))}
      </ul>
    </AdminPage>
  );
}
