"use client";

/* Trang Gửi file in: chọn gói → Bước 1 chọn ảnh (theo gói) → Bước 2 link nhạc → Gửi.
   File GỐC (không nén) được tải lên bucket riêng tư "order-files" khi bấm Gửi. */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { SPECS, type PrintSpec } from "@/lib/print";
import { checkImage, validateFile, type CheckResult } from "@/lib/imageCheck";
import { randomName } from "@/lib/upload";
import { matchFileName, type PackLayout } from "@/lib/matchFileName";
import { PrintArea } from "@/components/mockup/Mockups";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Package } from "@/lib/types";

const PINK = "#ff5fa2";
const ACCEPT = "image/jpeg,image/png,application/pdf";

type SlotDef = { id: string; group: "front" | "back" | "disc"; label: string; full: string; spec: PrintSpec; kind: string; page: number | null };
type Picked = { file: File; preview: string | null; check?: CheckResult; error?: string };

// Bố cục theo gói (dùng chung preset với Custom CD)
function layoutOf(pk: Package): PackLayout {
  if (pk.front_pages == null && pk.back_pages == null) return { front: 1, back: 1, disc: pk.has_disc !== false };
  return { front: pk.front_pages ?? 0, back: pk.back_pages ?? 0, disc: pk.has_disc !== false };
}
const describePkg = (pk: Package) => {
  const l = layoutOf(pk);
  return [
    l.front ? (l.front >= 4 ? `Booklet ${l.front} trang` : `Bìa trước ${l.front} mặt`) : "",
    l.back ? `Bìa sau ${l.back} mặt` : "",
    l.disc ? "Mặt đĩa" : "",
  ].filter(Boolean).join(" · ");
};
function slotsOf(l: PackLayout): SlotDef[] {
  const out: SlotDef[] = [];
  const booklet = l.front >= 4;
  for (let i = 1; i <= l.front; i++) {
    const label = booklet ? String(i) : i === 1 ? "Mặt Ngoài" : "Mặt Trong";
    out.push({ id: `f${i}`, group: "front", label, full: `Bìa trước - ${booklet ? `Trang ${i}` : label}`,
      spec: booklet ? SPECS.booklet : SPECS.front, kind: booklet ? "booklet" : "front", page: l.front > 1 ? i : null });
  }
  for (let i = 1; i <= l.back; i++) {
    const label = i === 1 ? "Mặt Ngoài" : "Mặt Trong";
    out.push({ id: `b${i}`, group: "back", label, full: `Bìa sau - ${label}`, spec: SPECS.back, kind: "back", page: l.back > 1 ? i : null });
  }
  if (l.disc) out.push({ id: "d", group: "disc", label: "Mặt đĩa", full: "Mặt đĩa", spec: SPECS.disc, kind: "disc", page: null });
  return out;
}

async function readPicked(file: File, spec: PrintSpec): Promise<Picked> {
  const invalid = validateFile(file);
  if (invalid) return { file, preview: null, error: invalid };
  const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
  try {
    return { file, preview, check: await checkImage(file, spec) };
  } catch {
    return { file, preview, error: "Không đọc được ảnh, file có thể bị lỗi." };
  }
}

export function SendFiles({ packages, orderCode }: { packages: Package[]; orderCode: string }) {
  const [pkg, setPkg] = useState<Package | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [files, setFiles] = useState<Record<string, Picked>>({});
  const [pendingPkg, setPendingPkg] = useState<{ pk: Package; lost: SlotDef[] } | null>(null);
  const [multiOpen, setMultiOpen] = useState(false);
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ code: string; count: number } | null>(null);
  const filesRef = useRef(files);
  filesRef.current = files;

  const layout = pkg ? layoutOf(pkg) : null;
  const slots = useMemo(() => (layout ? slotsOf(layout) : []), [layout?.front, layout?.back, layout?.disc]); // eslint-disable-line react-hooks/exhaustive-deps
  const missing = slots.filter((s) => !files[s.id] || files[s.id].error);

  // dọn ảnh xem trước khi rời trang
  useEffect(() => () => Object.values(filesRef.current).forEach((p) => p.preview && URL.revokeObjectURL(p.preview)), []);

  function setSlot(id: string, p: Picked | null) {
    setFiles((cur) => {
      const old = cur[id];
      if (old?.preview && old.preview !== p?.preview) URL.revokeObjectURL(old.preview);
      const next = { ...cur };
      if (p) next[id] = p; else delete next[id];
      return next;
    });
  }
  async function pickFor(slot: SlotDef, file: File) {
    setSlot(slot.id, await readPicked(file, slot.spec));
  }

  function choosePkg(pk: Package) {
    if (pkg?.id === pk.id) return setPendingPkg(null);
    const keep = new Set(slotsOf(layoutOf(pk)).map((s) => s.id));
    const lost = slots.filter((s) => files[s.id] && !keep.has(s.id));
    if (lost.length) return setPendingPkg({ pk, lost });
    applyPkg(pk, []);
  }
  function applyPkg(pk: Package, lost: SlotDef[]) {
    lost.forEach((s) => setSlot(s.id, null));
    setPkg(pk); setPendingPkg(null); setStep(1);
  }

  function goToSlot(id: string) {
    setStep(1);
    setTimeout(() => document.getElementById(`slot-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  }

  async function send() {
    setErr("");
    if (!pkg || missing.length) return;
    const music = link.trim();
    if (music && !/^https?:\/\//i.test(music)) return setErr("Link nhạc cần bắt đầu bằng https://");
    if (!orderCode && (!name.trim() || phone.replace(/\D/g, "").length < 8)) return setErr("Vui lòng nhập tên và số điện thoại/Zalo hợp lệ.");
    if (!hasSupabase) return setErr("Web chưa kết nối database.");
    const sb = createClient();
    try {
      let order: { id: string; code: string };
      if (orderCode) {
        setSending("Đang tìm đơn...");
        const { data, error } = await sb.rpc("find_order_for_upload", { p_query: orderCode });
        if (error) throw new Error(error.message);
        if (!data?.[0]) throw new Error(`Không tìm thấy đơn ${orderCode} đang chờ nhận file.`);
        order = { id: data[0].order_id, code: data[0].order_code };
      } else {
        setSending("Đang tạo đơn...");
        const { data, error } = await sb.rpc("create_order", {
          p_customer_name: name.trim(), p_phone: phone, p_address: "", p_note: "Gửi file in",
          p_package_id: pkg.id, p_quantity: 1, p_addons: [], p_order_type: "cd", p_music_link: music,
        });
        if (error || !data?.[0]) throw new Error(error?.message ?? "Không tạo được đơn");
        order = { id: data[0].order_id, code: data[0].order_code };
      }

      let n = 0;
      for (const s of slots) {
        const p = files[s.id];
        n++;
        setSending(`Đang gửi ảnh ${n}/${slots.length}...`);
        // FILE GỐC, không nén
        const path = `${order.id}/${s.kind}${s.page ? `-p${String(s.page).padStart(2, "0")}` : ""}-${randomName(p.file)}`;
        const up = await sb.storage.from("order-files").upload(path, p.file, { contentType: p.file.type, upsert: false });
        if (up.error) throw new Error(`Gửi "${s.full}" thất bại: ${up.error.message}`);
        const reg = await sb.rpc("register_order_file", {
          p_order_id: order.id, p_kind: s.kind, p_storage_path: path, p_file_name: p.file.name,
          p_mime_type: p.file.type, p_size_bytes: p.file.size, p_page: s.page,
          p_width_px: p.check?.width ?? null, p_height_px: p.check?.height ?? null,
        });
        if (reg.error) throw new Error(reg.error.message);
      }
      if (orderCode && music) {
        setSending("Đang lưu link nhạc...");
        const { error } = await sb.rpc("set_order_music_link", { p_order_id: order.id, p_link: music });
        if (error) throw new Error(error.message);
      }
      setDone({ code: order.code, count: slots.length });
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Có lỗi, bạn thử lại nhé.");
    }
    setSending("");
  }

  // ---------- Màn hình cảm ơn ----------
  if (done) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-14 text-center font-sans">
        <p className="text-5xl">✿</p>
        <h1 className="mt-3 font-sans text-[22px] font-bold normal-case tracking-[-0.02em] sm:text-[28px]">Cảm ơn bạn!</h1>
        <p className="mt-3 text-ink-600">Tiệm đã nhận {done.count} ảnh. Mã đơn của bạn:</p>
        <p className="pop-sm mx-auto mt-3 inline-block rounded-2xl bg-white px-5 py-2 font-display text-3xl">{done.code}</p>
        <p className="mt-4 text-sm text-ink-600">Lưu lại mã đơn nhé. Tiệm sẽ kiểm tra file và nhắn bạn qua Zalo/SĐT nếu cần chỉnh sửa.</p>
        <Link href="/" className="btn mt-6">Về trang chủ</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 font-sans text-[14px] text-ink-900">
      <PageHeader inset={false} title="Gửi file in"
        subtitle={orderCode ? <>Gửi file cho đơn <b>{orderCode}</b></> : "Chọn gói, tải ảnh vào đúng ô rồi gửi kèm link nhạc."} />

      {/* ---------- Chọn gói ---------- */}
      {!pkg ? (
        <section className="mt-6">
          <p className="mb-3 text-[15px] font-semibold">Chọn gói của bạn để bắt đầu</p>
          <PackageCards packages={packages} onPick={choosePkg} />
        </section>
      ) : (
        <>
          <Progress step={step} />
          <div className="mt-4 flex items-center gap-3 rounded-[12px] border border-[#e3e0da] bg-white p-2.5">
            <Thumb pk={pkg} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{pkg.name}</p>
              <p className="text-[12px] text-[#8a857e]">{describePkg(pkg)}</p>
            </div>
            <button className="tool-btn shrink-0" onClick={() => setPendingPkg({ pk: pkg, lost: [] })}>Đổi gói</button>
          </div>

          {step === 1 ? (
            <section className="mt-6">
              <p className="text-[13px] text-ink-600">
                Bạn chưa có ảnh? <Link href="/huong-dan" className="font-semibold underline" style={{ color: PINK }}>Nhấn vào đây</Link> để được hướng dẫn
              </p>
              <button className="tool-btn mt-3" onClick={() => setMultiOpen(true)}>⇪ Tải nhiều ảnh</button>

              {(["front", "back", "disc"] as const).map((g) => {
                const list = slots.filter((s) => s.group === g);
                if (!list.length) return null;
                return (
                  <div key={g} className="mt-7">
                    <p className="mb-3 text-[16px] font-semibold">{g === "front" ? "Bìa trước" : g === "back" ? "Bìa sau" : "Mặt đĩa"}
                      <span className="ml-2 text-[12px] font-normal text-[#8a857e]">{g === "front" ? "12 × 12 cm" : g === "back" ? "15 × 11.7 cm" : "Tròn 12 cm"}</span>
                    </p>
                    <div className={`grid gap-4 ${g === "back" ? "grid-cols-1 sm:grid-cols-2" : g === "disc" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
                      {list.map((s) => <SlotTile key={s.id} slot={s} picked={files[s.id]} onFile={(f) => pickFor(s, f)} onRemove={() => setSlot(s.id, null)} />)}
                    </div>
                  </div>
                );
              })}

              <button className="mt-8 h-11 w-full rounded-[10px] text-[15px] font-semibold text-white sm:w-auto sm:px-10"
                style={{ background: PINK }} onClick={() => { setStep(2); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                Tiếp tục →
              </button>
            </section>
          ) : (
            <section className="mt-6 max-w-xl">
              <p className="mb-1 text-[16px] font-semibold">Link file nhạc</p>
              <p className="mb-2 text-[13px] text-ink-600">
                Tải nhạc lên Google Drive, bấm <b>Chia sẻ → Bất kỳ ai có đường liên kết</b>, rồi dán link vào đây.
              </p>
              <p className="mb-2 rounded-[8px] bg-[#f4f2ee] px-3 py-2 text-[12px] text-ink-600">
                ⓘ Bạn chưa tải được nhạc từ YouTube và Spotify? <Link href="/huong-dan#audio" className="font-semibold underline" style={{ color: PINK }}>Nhấn vào đây</Link> để xem hướng dẫn
              </p>
              <input className="tool-input w-full" type="url" inputMode="url" placeholder="https://drive.google.com/..." value={link} onChange={(e) => setLink(e.target.value)} />

              {!orderCode && (
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <p className="text-[13px] font-semibold sm:col-span-2">Thông tin liên hệ</p>
                  <input className="tool-input w-full" placeholder="Tên của bạn" value={name} onChange={(e) => setName(e.target.value)} />
                  <input className="tool-input w-full" type="tel" inputMode="tel" placeholder="Số điện thoại / Zalo" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              )}

              <button className="tool-btn mt-5" onClick={() => setStep(1)}>← Quay lại</button>

              <div className="mt-6">
                {missing.length > 0 && (
                  <p className="mb-2 text-[12px] text-[#d97706]">
                    Còn {missing.length} ảnh chưa tải lên:{" "}
                    {missing.map((s, i) => (
                      <span key={s.id}>
                        <button className="underline" onClick={() => goToSlot(s.id)}>{s.full}</button>{i < missing.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </p>
                )}
                {err && <p className="mb-2 text-[13px] text-[#d0303f]">{err}</p>}
                <button className="h-12 w-full rounded-[10px] text-[16px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                  style={{ background: PINK }} disabled={missing.length > 0 || !!sending} onClick={send}>
                  {sending || "Gửi"}
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {pendingPkg && (
        pendingPkg.lost.length ? (
          <Modal title="Đổi gói?" danger ok="Đổi gói và xoá" cancel="Huỷ" onCancel={() => setPendingPkg(null)} onOk={() => applyPkg(pendingPkg.pk, pendingPkg.lost)}>
            Gói “{pendingPkg.pk.name}” không có các ô sau, ảnh đã tải ở đó sẽ bị xoá: <b>{pendingPkg.lost.map((s) => s.full).join("; ")}</b>
          </Modal>
        ) : (
          <div className="fixed inset-0 z-[60] grid place-items-center bg-ink-900/50 p-4" role="dialog" aria-modal onClick={() => setPendingPkg(null)}>
            <div className="max-h-[90dvh] w-full max-w-2xl overflow-auto rounded-[14px] bg-white p-5 font-sans shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[16px] font-semibold">Đổi gói</p>
                <button className="tool-btn" onClick={() => setPendingPkg(null)}>Đóng</button>
              </div>
              <PackageCards packages={packages} current={pkg?.id} onPick={choosePkg} />
            </div>
          </div>
        )
      )}

      {multiOpen && layout && (
        <MultiUpload slots={slots} layout={layout} onCancel={() => setMultiOpen(false)}
          onConfirm={async (rows) => {
            setMultiOpen(false);
            for (const r of rows) {
              const s = slots.find((x) => x.id === r.slot);
              if (s) await pickFor(s, r.file);
            }
          }} />
      )}
    </div>
  );
}

// ---------- Thanh tiến trình ----------
function Progress({ step }: { step: 1 | 2 }) {
  const item = (n: 1 | 2, label: string) => (
    <div className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-full text-[13px] font-bold"
        style={step >= n ? { background: PINK, color: "#fff" } : { background: "#e7e4de", color: "#8a857e" }}>{n}</span>
      <span className={`text-[14px] ${step === n ? "font-semibold" : "text-[#8a857e]"}`}>{label}</span>
    </div>
  );
  return (
    <div className="mt-5 flex items-center gap-3">
      {item(1, "Chọn ảnh")}
      <span className="h-[2px] w-10 rounded-full sm:w-20" style={{ background: step === 2 ? PINK : "#e7e4de" }} />
      {item(2, "Link nhạc")}
    </div>
  );
}

// ---------- Thẻ gói (giống Custom CD, không hiện giá) ----------
function Thumb({ pk }: { pk: Package }) {
  return (
    <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-[6px] bg-[#f4f2ee]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {pk.image_url && <img src={pk.image_url} alt="" className="h-full w-full object-cover" />}
    </span>
  );
}
function PackageCards({ packages, current, onPick }: { packages: Package[]; current?: string; onPick: (pk: Package) => void }) {
  if (!packages.length) return <p className="text-[13px] text-[#8a857e]">Tiệm chưa có gói sản phẩm nào.</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {packages.map((pk) => (
        <button key={pk.id} onClick={() => onPick(pk)}
          className={`flex w-full items-center gap-2.5 rounded-[10px] border bg-white p-2 text-left font-sans text-[14px] hover:border-[#ff5fa2] ${current === pk.id ? "border-[#ff5fa2]" : "border-[#e3e0da]"}`}>
          <Thumb pk={pk} />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{pk.name}</span>
            <span className="block text-[12px] text-[#8a857e]">{describePkg(pk)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

// ---------- 1 ô ảnh ----------
function SlotTile({ slot, picked, onFile, onRemove }: { slot: SlotDef; picked?: Picked; onFile: (f: File) => void; onRemove: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const isDisc = slot.group === "disc";
  const has = !!picked && !picked.error;
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
              <PrintArea spec={slot.spec} src={picked!.preview} isPdf={picked!.file.type === "application/pdf"} bg="var(--color-cream-50)" />
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
          <div className={`absolute inset-0 grid place-items-center border-2 border-dashed border-[#cfcac2] bg-[#f1efeb] ${isDisc ? "rounded-full" : "rounded-[8px]"}`}>
            {isDisc && <span className="absolute left-1/2 top-1/2 h-[12.5%] w-[12.5%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-[#cfcac2] bg-cream-50" />}
            <button type="button" onClick={open} className={`tool-btn bg-white ${isDisc ? "relative mt-[45%]" : ""}`}>⇪ Tải lên</button>
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
function MultiUpload({ slots, layout, onCancel, onConfirm }: {
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
          <p className="text-[12px] text-[#8a857e]">Đặt tên file như “bia truoc”, “bia sau trong”, “cd”, “trang 2”... để tự xếp vào đúng ô.</p>
        </div>
        <div className="flex-1 overflow-auto p-5">
          <div
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
            className={`grid cursor-pointer place-items-center rounded-[10px] border-2 border-dashed px-4 py-8 text-center ${over ? "border-[#ff5fa2] bg-[#fff0f6]" : "border-[#cfcac2] bg-[#f6f4f0]"}`}>
            <p className="font-medium">Kéo thả ảnh vào đây</p>
            <p className="text-[12px] text-[#8a857e]">hoặc bấm để chọn nhiều file (JPG, PNG, PDF ≤ 30MB)</p>
          </div>
          <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only"
            onChange={(e) => { add(e.target.files); e.target.value = ""; }} />

          {rows.length > 0 && (
            <table className="mt-4 w-full text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-[#8a857e]"><th className="py-1.5 font-medium">Tên file</th><th className="py-1.5 font-medium">Xếp vào ô</th><th /></tr>
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
                        <select className="tool-input w-full" value={r.slot}
                          onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, slot: e.target.value } : x)))}>
                          <option value="">— Bỏ qua —</option>
                          {slots.map((s) => <option key={s.id} value={s.id}>{s.full}</option>)}
                        </select>
                      </td>
                      <td className="w-8 text-right">
                        <button className="text-[16px] text-[#8a857e] hover:text-ink-900" aria-label="Bỏ file"
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
          <button className="tool-btn" onClick={onCancel}>Huỷ</button>
          <button className="h-9 rounded-[8px] px-5 text-[14px] font-semibold text-white disabled:opacity-45" style={{ background: PINK }}
            disabled={!rows.some((r) => r.slot)} onClick={() => onConfirm(rows.filter((r) => r.slot))}>Xác nhận</button>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, children, ok, cancel, onOk, onCancel, danger }: {
  title: string; children: React.ReactNode; ok: string; cancel: string; onOk: () => void; onCancel: () => void; danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink-900/50 p-4" role="dialog" aria-modal>
      <div className="w-full max-w-sm rounded-[14px] bg-white p-5 font-sans text-[14px] shadow-xl">
        <p className="text-[16px] font-semibold text-ink-900">{title}</p>
        <p className="mt-2 text-ink-600">{children}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="tool-btn" onClick={onCancel}>{cancel}</button>
          <button className={danger ? "tool-btn !border-[#d0303f] !bg-[#d0303f] !text-white hover:!brightness-95" : "tool-btn is-active"} onClick={onOk}>{ok}</button>
        </div>
      </div>
    </div>
  );
}
