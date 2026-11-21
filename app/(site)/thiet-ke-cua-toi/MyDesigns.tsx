"use client";
/* Thiết kế của tôi: thiết kế lưu 24 giờ kể từ lần sửa gần nhất (tối đa 5). CD · Booklet · Bìa sau là các phần của 1 gói combo
   → chọn nhiều thiết kế (mỗi loại 1) rồi "Tải về" hoặc "Đặt đơn": web tự chọn gói khớp (preset Bìa trước / Bìa sau / Mặt đĩa của gói).
   Thiếu phần nào → modal "Có vẻ bạn đang muốn in: {gói}" + hướng dẫn ngắn mở / thêm đúng thiết kế còn thiếu. */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Check, Clock, Download, ShoppingBag, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { DESIGN_TTL_MS, MAX_DESIGNS, deleteDesign, listDesigns, type PrintRef } from "@/lib/designs";
import { downloadPrivate } from "@/lib/storage/client";
import { saveBlob, saveZip } from "@/lib/imageTools";
import { savePendingFiles, type PendingFile } from "@/lib/pendingOrderFiles";
import { CD_SLUG } from "@/lib/catalog";
import { layoutOf } from "@/components/cd/cdSlots";
import type { Package } from "@/lib/types";
import { AuthDialog } from "@/components/site/AuthDialog";
import { Button, confirmDialog, toast } from "@/components/ui/kit";
import { btnClass, cx } from "@/components/ui/styles";

type Row = Awaited<ReturnType<typeof listDesigns>>[number];
type Part = "booklet" | "back" | "disc";
const PART: Record<string, Part> = { "booklet-scrapbook": "booklet", "back-scrapbook": "back", "cd-scrapbook": "disc" };
const PART_LABEL: Record<Part, string> = { booklet: "Booklet", back: "Bìa sau", disc: "Mặt đĩa CD" };
const openHref = (r: { id: string; kind?: string | null }) =>
  r.kind === "lyrics-booklet" ? `/thiet-ke/booklet-lyrics?design=${r.id}` : r.kind === "booklet-scrapbook" ? `/thiet-ke/booklet?design=${r.id}`
    : r.kind === "cd-scrapbook" ? `/thiet-ke/cd-template?design=${r.id}` : r.kind === "back-scrapbook" ? `/thiet-ke/back-template?design=${r.id}` : `/thiet-ke/cd?design=${r.id}`;
const left = (r: Row) => Math.max(0, Date.parse(r.updated_at) + DESIGN_TTL_MS - Date.now());
const leftText = (ms: number) => { const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000); return h ? `Còn ${h} giờ ${m} phút` : `Còn ${m} phút`; };

type Missing = { text: string; how: string; href: string; cta: string };
/** so khớp các thiết kế đã chọn với gói: đúng gói → đặt luôn · thiếu → gói "có vẻ muốn in" + các phần còn thiếu */
function matchPackage(pkgs: Package[], sel: Partial<Record<Part, Row>>) {
  const s = { front: sel.booklet ? sel.booklet.pages ?? 0 : 0, back: sel.back ? sel.back.faces ?? 1 : 0, disc: !!sel.disc };
  const list = pkgs.map((p) => ({ p, l: layoutOf(p) }));
  const exact = list.find(({ l }) => l.front === s.front && l.back === s.back && l.disc === s.disc);
  if (exact) return { pkg: exact.p, missing: [] as Missing[] };
  const score = ({ l }: (typeof list)[number]) =>
    (s.front && l.front !== s.front ? 10 : 0) + (s.back > l.back ? 4 : 0) + (s.disc && !l.disc ? 4 : 0) + (s.front && !l.front ? 4 : 0)
    + (l.front && !s.front ? 1 : 0) + (l.back > s.back ? 1 : 0) + (l.disc && !s.disc ? 1 : 0);
  const best = [...list].sort((a, b) => score(a) - score(b))[0];
  if (!best) return { pkg: null, missing: [] as Missing[] };
  const l = best.l, m: Missing[] = [];
  if (l.front && !s.front) m.push({ text: `Booklet ${l.front} trang`, how: `Mở Booklet Template, chọn Số trang: ${l.front}, thiết kế rồi bấm Lưu.`, href: "/thiet-ke/booklet", cta: "Mở Booklet Template" });
  else if (l.front && s.front !== l.front) m.push({ text: `Booklet đang có ${s.front} trang, gói cần ${l.front} trang`, how: `Mở thiết kế Booklet, đổi Số trang thành ${l.front} rồi bấm Lưu lại.`, href: openHref(sel.booklet!), cta: "Mở thiết kế Booklet" });
  if (l.back > s.back) m.push(s.back
    ? { text: `Bìa sau mới có ${s.back} mặt, gói cần ${l.back} mặt`, how: `Mở thiết kế Bìa sau, chọn Số mặt: ${l.back}, thiết kế thêm Mặt trong rồi bấm Lưu lại.`, href: openHref(sel.back!), cta: "Mở thiết kế Bìa sau" }
    : { text: `Bìa sau ${l.back} mặt`, how: `Mở Back cover Template, chọn Số mặt: ${l.back}, thiết kế rồi bấm Lưu.`, href: "/thiet-ke/back-template", cta: "Mở Back cover Template" });
  if (l.disc && !s.disc) m.push({ text: "Mặt đĩa CD", how: "Mở CD Template, thiết kế mặt đĩa rồi bấm Lưu.", href: "/thiet-ke/cd-template", cta: "Mở CD Template" });
  return { pkg: best.p, missing: m };
}

export function MyDesigns({ packages }: { packages: Package[] }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");
  const [auth, setAuth] = useState(false);
  const [sel, setSel] = useState<Partial<Record<Part, string>>>({});
  const [busy, setBusy] = useState("");
  const [gap, setGap] = useState<{ pkg: Package | null; missing: Missing[] } | null>(null);

  const load = useCallback(async () => {
    try { setRows(await listDesigns()); } catch (e) { setErr(e instanceof Error ? e.message : "Lỗi tải danh sách"); }
  }, []);
  useEffect(() => {
    if (!hasSupabase) { setUser(null); return; }
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  const picked = useMemo(() => {
    const out: Partial<Record<Part, Row>> = {};
    for (const [k, id] of Object.entries(sel) as [Part, string][]) { const r = rows.find((x) => x.id === id); if (r) out[k] = r; }
    return out;
  }, [sel, rows]);
  const pickedList = Object.values(picked) as Row[];
  const toggle = (r: Row) => { const p = PART[r.kind ?? ""]; if (!p) return; setSel((s) => ({ ...s, [p]: s[p] === r.id ? undefined : r.id })); };

  async function blobs(list: Row[]) {
    const out: { ref: PrintRef; blob: Blob }[] = [];
    for (const r of list) for (const ref of r.prints ?? []) {
      const b = await downloadPrivate(`design-assets/${ref.path}`);
      if (!b) throw new Error(`Không tải được file của “${r.name}” — mở thiết kế và bấm Lưu lại nhé.`);
      out.push({ ref, blob: b });
    }
    return out;
  }
  async function download() {
    setBusy("dl");
    try {
      const f = await blobs(pickedList);
      if (f.length === 1) saveBlob(f[0].blob, f[0].ref.name); else await saveZip(f.map((x) => ({ name: x.ref.name, blob: x.blob })), "Taylana-thiet-ke.zip");
      toast("Đã tải xuống");
    } catch (e) { toast(e instanceof Error ? e.message : "Tải thất bại", "err"); }
    setBusy("");
  }
  async function order() {
    const m = matchPackage(packages, picked);
    if (!m.pkg || m.missing.length) return setGap(m);
    setBusy("order");
    try {
      const f = await blobs(pickedList);
      const files: PendingFile[] = f.map(({ ref, blob }) => ({ kind: ref.kind, page: ref.page, name: ref.name, blob, w: ref.w, h: ref.h }));
      await savePendingFiles(files); // giữ trên máy, gắn vào đơn ngay sau khi đặt
      router.push(`/san-pham/${CD_SLUG}?goi=${encodeURIComponent(m.pkg.id)}`);
    } catch (e) { toast(e instanceof Error ? e.message : "Có lỗi, thử lại nhé", "err"); setBusy(""); }
  }

  if (user === undefined) return <p className="px-4 py-12 text-center text-[#71717a]">Đang tải...</p>;
  if (!user) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pb-12">
        <div className="rounded-[12px] border border-[#e5e5e7] bg-white p-8 text-center">
          <p className="mb-4 text-[#71717a]">Đăng nhập bằng số điện thoại để xem các thiết kế đã lưu.</p>
          <Button onClick={() => setAuth(true)}>Đăng nhập</Button>
        </div>
        {auth && <AuthDialog onClose={() => setAuth(false)} />}
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28">
      <p className="mb-4 flex items-start gap-2 rounded-[10px] border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5 text-[13px] text-[#92400e]">
        <Clock size={16} className="mt-0.5 shrink-0" />
        <span>Mẫu chỉ được lưu <b>24 tiếng</b> kể từ lần sửa gần nhất (tối đa {MAX_DESIGNS} mẫu). Liên hệ với admin nếu bạn đang vướng mắc gì nhé. Chọn các phần của 1 bộ (Booklet · Bìa sau · Mặt đĩa CD) rồi bấm Tải về hoặc Đặt đơn.</span>
      </p>
      {err && <p className="mb-4 rounded-[8px] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{err}</p>}
      {!rows.length ? (
        <div className="rounded-[12px] border border-[#e5e5e7] bg-white p-10 text-center">
          <p className="text-[#71717a]">Bạn chưa lưu thiết kế nào.</p>
          <Button href="/thiet-ke" className="mt-4">Bắt đầu thiết kế</Button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((r) => {
            const part = PART[r.kind ?? ""], can = !!part && !!r.prints?.length, on = !!part && sel[part] === r.id;
            return (
              <li key={r.id} className={cx("relative overflow-hidden rounded-[12px] border bg-white text-[13px] transition-shadow hover:shadow-[0_4px_16px_rgb(0_0_0/0.06)]", on ? "border-[var(--c-primary)] ring-2 ring-[var(--c-primary)]/25" : "border-[#e5e5e7]")}>
                {can && (
                  <button type="button" onClick={() => toggle(r)} aria-pressed={on} aria-label={on ? "Bỏ chọn" : "Chọn"}
                    className={cx("absolute left-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full border-2 shadow", on ? "border-[var(--c-primary)] bg-[var(--c-primary)] text-white" : "border-white bg-white/90 text-transparent")}><Check size={15} /></button>
                )}
                <button type="button" onClick={() => (can ? toggle(r) : router.push(openHref(r)))} className="block aspect-square w-full bg-[#f4f4f5]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {r.thumbnail ? <img src={r.thumbnail} alt="" className="h-full w-full object-contain" /> : <span className="grid h-full place-items-center text-ink-500">Chưa có ảnh</span>}
                </button>
                <div className="space-y-2 p-3">
                  <p className="truncate font-semibold text-ink-900" title={r.name}>{r.name}</p>
                  <p className="text-[12px] text-[#71717a]">{part ? PART_LABEL[part] : "Thiết kế"}{r.kind === "booklet-scrapbook" && r.pages ? ` · ${r.pages} trang` : ""}{r.kind === "back-scrapbook" ? ` · ${r.faces ?? 1} mặt` : ""}</p>
                  <p className="text-[12px] text-[#b45309]">{leftText(left(r))}</p>
                  <div className="flex gap-1.5">
                    <Button href={openHref(r)} size="sm" className="min-w-0 flex-1">Mở</Button>
                    <button className={cx(btnClass("danger", "sm"), "shrink-0")} aria-label="Xoá" onClick={async () => {
                      if (!await confirmDialog(`Xoá thiết kế "${r.name}"?`)) return;
                      try { await deleteDesign(r.id); setSel((s) => Object.fromEntries(Object.entries(s).filter(([, v]) => v !== r.id))); await load(); } catch (e) { setErr(e instanceof Error ? e.message : "Lỗi"); }
                    }}><Trash2 size={16} /></button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pickedList.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5e5e7] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
            <p className="min-w-0 flex-1 text-[13px] text-[#3f3f46]">Đã chọn: <b>{(Object.keys(picked) as Part[]).map((k) => PART_LABEL[k]).join(" · ")}</b></p>
            <Button variant="ghost" size="sm" onClick={() => setSel({})}>Bỏ chọn</Button>
            <Button variant="secondary" size="sm" icon={<Download size={16} />} loading={busy === "dl"} disabled={!!busy} onClick={download}>Tải về</Button>
            <Button size="sm" icon={<ShoppingBag size={16} />} loading={busy === "order"} disabled={!!busy} onClick={order}>Đặt đơn</Button>
          </div>
        </div>
      )}

      {gap && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onMouseDown={(e) => { if (e.target === e.currentTarget) setGap(null); }}>
          <div className="w-full max-w-[460px] rounded-[14px] bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-start gap-2">
              <p className="min-w-0 flex-1 text-[16px] font-semibold">{gap.pkg ? <>Có vẻ bạn đang muốn in: <span className="text-[var(--c-primary)]">{gap.pkg.name}</span></> : "Chưa tìm được gói phù hợp"}</p>
              <button type="button" onClick={() => setGap(null)} className="grid h-7 w-7 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5]" aria-label="Đóng"><X size={16} /></button>
            </div>
            {gap.missing.length ? (
              <>
                <p className="mb-2 text-[14px] text-[#3f3f46]">Nhưng còn thiếu:</p>
                <ul className="space-y-2">
                  {gap.missing.map((m) => (
                    <li key={m.text} className="rounded-[10px] border border-[#e5e5e7] p-3">
                      <p className="text-[14px] font-semibold text-[#18181b]">{m.text}</p>
                      <p className="mt-0.5 text-[13px] text-[#52525b]">{m.how}</p>
                      <Link href={m.href} className={cx(btnClass("secondary", "sm"), "mt-2")}>{m.cta}</Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : <p className="text-[14px] text-[#3f3f46]">Các thiết kế đã chọn chưa khớp gói nào của tiệm — bỏ chọn bớt hoặc liên hệ tiệm để được tư vấn nhé.</p>}
            <div className="mt-4 flex justify-end"><Button variant="secondary" onClick={() => setGap(null)}>Chọn lại</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
