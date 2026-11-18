"use client";

/* Trang Gửi file in: Bước 1 chọn ảnh (theo gói) → Bước 2 link nhạc → Gửi.
   - Có mã đơn (?don=): bỏ qua chọn gói, gói cố định theo đơn; file gắn vào đúng đơn + dòng sản phẩm (+ số bản).
   - Không có mã đơn: chọn gói tự do (tạo đơn mới khi gửi), hoặc chọn trong "Đơn đang chờ file".
   File GỐC (không nén) được tải lên bucket riêng tư "order-files" khi bấm Gửi. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { uploadHref } from "@/lib/uploadTools";
import { randomName } from "@/lib/upload";
import type { PackLayout } from "@/lib/matchFileName";
import { CdUploadPanel } from "@/components/cd/CdUploadPanel";
import { saveHandoff } from "@/lib/mockup/handoff";
import { PINK, describeLayout, describePkg, layoutOf, readPicked, slotsOf, type Picked, type SlotDef } from "@/components/cd/cdSlots";
import { PageHeader } from "@/components/ui/PageHeader";
import { btnClass, inputClass } from "@/components/ui/styles";
import type { Package } from "@/lib/types";
import { Check, Disc3, Eye } from "lucide-react";
import { normalizePhone, PHONE_ERROR } from "@/lib/phone";
import { saveOrderCode, savedOrderCodes } from "@/lib/cart";
import type { OrderSummary } from "@/lib/myOrders";

// ---------- Đơn hàng (từ RPC order_upload_info) ----------
type UpFile = { id: string; kind: string; page: number | null; order_item_id: string | null; copy_no: number; file_name: string; mime_type: string; storage_path: string; created_at: string };
type UpLine = { id: string; package_id: string | null; package_name: string; quantity: number; copies_mode: "same" | "different"; front_pages: number | null; back_pages: number | null; has_disc: boolean | null };
type UpOrder = OrderSummary & { editable: boolean; music_link: string; lines: UpLine[]; files: UpFile[] };

const lineLayout = (l: UpLine): PackLayout => layoutOf({ front_pages: l.front_pages ?? undefined, back_pages: l.back_pages ?? undefined, has_disc: l.has_disc ?? undefined } as Package);
const copiesOf = (l: UpLine) => (l.copies_mode === "different" ? Math.max(1, l.quantity) : 1);
// file mới nhất của 1 ô (theo dòng sản phẩm + số bản)
function latestFor(o: UpOrder, line: UpLine, copy: number, s: SlotDef) {
  const single = o.lines.length === 1;
  return o.files
    .filter((f) => (f.order_item_id === line.id || (single && !f.order_item_id)) && (f.copy_no || 1) === copy && f.kind === s.kind && (f.page ?? null) === (s.page ?? null))
    .sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
}
const lineDone = (o: UpOrder, l: UpLine) => {
  const slots = slotsOf(lineLayout(l));
  return slots.length > 0 && Array.from({ length: copiesOf(l) }, (_, i) => i + 1).every((c) => slots.every((s) => latestFor(o, l, c, s)));
};

export function SendFiles({ packages, orderCode }: { packages: Package[]; orderCode: string }) {
  const [pkg, setPkg] = useState<Package | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [allFiles, setAllFiles] = useState<Record<string, Record<string, Picked>>>({});
  const [pendingPkg, setPendingPkg] = useState<{ pk: Package; lost: SlotDef[] } | null>(null);
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ code: string; count: number } | null>(null);
  // đơn hàng
  const [order, setOrder] = useState<UpOrder | null>(null);
  const [orderState, setOrderState] = useState<"none" | "loading" | "need_phone" | "ready">(orderCode ? "loading" : "none");
  const [verifyPhone, setVerifyPhone] = useState("");
  const [verifyErr, setVerifyErr] = useState("");
  const [lineId, setLineId] = useState("");
  const [copyNo, setCopyNo] = useState(1);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [sentNote, setSentNote] = useState("");
  const [waiting, setWaiting] = useState<OrderSummary[]>([]);
  const filesRef = useRef(allFiles);
  filesRef.current = allFiles;

  const line = order?.lines.find((l) => l.id === lineId) ?? order?.lines[0] ?? null;
  const ctx = order && line ? `${line.id}:${copyNo}` : "free";
  const files = useMemo(() => allFiles[ctx] ?? {}, [allFiles, ctx]);
  const layout = order ? (line ? lineLayout(line) : null) : pkg ? layoutOf(pkg) : null;
  const slots = useMemo(() => (layout ? slotsOf(layout) : []), [layout?.front, layout?.back, layout?.disc]); // eslint-disable-line react-hooks/exhaustive-deps
  const existing = useMemo(() => {
    const m: Record<string, UpFile> = {};
    if (order && line) for (const s of slots) { const f = latestFor(order, line, copyNo, s); if (f) m[s.id] = f; }
    return m;
  }, [order, line, copyNo, slots]);
  const readOnly = !!order && !order.editable;
  const missing = slots.filter((s) => !existing[s.id] && (!files[s.id] || files[s.id].error));
  const newCount = slots.filter((s) => files[s.id] && !files[s.id].error).length;

  // dọn ảnh xem trước khi rời trang
  useEffect(() => () => Object.values(filesRef.current).forEach((m) => Object.values(m).forEach((p) => p.preview && URL.revokeObjectURL(p.preview))), []);

  // ---------- tải đơn ----------
  const loadOrder = useCallback(async (code: string, ph = "") => {
    if (!hasSupabase) { setOrderState("none"); return; }
    setOrderState("loading");
    const sb = createClient();
    const saved = savedOrderCodes().some((c) => c.toUpperCase() === code.toUpperCase());
    const { data, error } = await sb.rpc("order_upload_info", { p_code: code, p_phone: ph, p_saved: saved });
    if (error || !data) {
      if (error && error.message.includes("order_upload_info")) {
        setVerifyErr("Tiệm chưa mở tính năng gửi file theo đơn.");
      } else if (ph) setVerifyErr("Số điện thoại không khớp với đơn này.");
      setOrderState("need_phone");
      return;
    }
    const o = data as UpOrder;
    saveOrderCode(o.code);
    setOrder(o);
    setLink((cur) => cur || o.music_link || "");
    setLineId((cur) => (o.lines.some((l) => l.id === cur) ? cur : o.lines[0]?.id ?? ""));
    setOrderState("ready");
    // ảnh đã gửi: chủ đơn (đã đăng nhập) xem được ảnh
    const paths = o.files.filter((f) => f.mime_type.startsWith("image/")).map((f) => f.storage_path);
    if (paths.length) {
      const { data: urls } = await sb.storage.from("order-files").createSignedUrls(paths, 3600);
      const m: Record<string, string> = {};
      urls?.forEach((u) => { if (u.path && u.signedUrl) m[u.path] = u.signedUrl; });
      setPreviews(m);
    }
  }, []);
  useEffect(() => { if (orderCode) loadOrder(orderCode); }, [orderCode, loadOrder]);

  // không có mã đơn + đã đăng nhập → danh sách "Đơn đang chờ file"
  useEffect(() => {
    if (orderCode || !hasSupabase) return;
    const sb = createClient();
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: list } = await sb.rpc("my_orders");
      const need = ((list as OrderSummary[]) ?? []).filter((o) => o.status === "new" && o.file_count < o.items.reduce((t, i) => {
        const pk = packages.find((p) => p.id === i.package_id);
        return t + (pk ? slotsOf(layoutOf(pk)).length * (i.copies_mode === "different" ? i.quantity : 1) : 1);
      }, 0));
      setWaiting(need);
    });
  }, [orderCode, packages]);

  function setSlot(id: string, p: Picked | null) {
    setAllFiles((all) => {
      const cur = all[ctx] ?? {};
      const old = cur[id];
      if (old?.preview && old.preview !== p?.preview) URL.revokeObjectURL(old.preview);
      const next = { ...cur };
      if (p) next[id] = p; else delete next[id];
      return { ...all, [ctx]: next };
    });
  }
  async function pickFor(slot: SlotDef, file: File) {
    setSentNote("");
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

  async function setMode(mode: "same" | "different") {
    if (!order || !line || readOnly) return;
    const { error } = await createClient().rpc("set_item_copies_mode", { p_order_id: order.id, p_item_id: line.id, p_mode: mode });
    if (error) return setErr(error.message);
    setCopyNo(1);
    setOrder({ ...order, lines: order.lines.map((l) => (l.id === line.id ? { ...l, copies_mode: mode } : l)) });
  }

  async function send() {
    setErr("");
    if ((!pkg && !order) || missing.length) return;
    const music = link.trim();
    if (music && !/^https?:\/\//i.test(music)) return setErr("Link nhạc cần bắt đầu bằng https://");
    const ph = normalizePhone(phone);
    if (!order && (!name.trim() || !ph)) return setErr(!name.trim() ? "Vui lòng nhập tên." : PHONE_ERROR);
    if (!hasSupabase) return setErr("Web chưa kết nối database.");
    const sb = createClient();
    try {
      let target: { id: string; code: string };
      if (order) target = { id: order.id, code: order.code };
      else {
        setSending("Đang tạo đơn...");
        const { data, error } = await sb.rpc("create_order", {
          p_customer_name: name.trim(), p_phone: ph, p_address: "", p_note: "Gửi file in",
          p_package_id: pkg!.id, p_quantity: 1, p_addons: [], p_order_type: "cd", p_music_link: music,
        });
        if (error || !data?.[0]) throw new Error(error?.message ?? "Không tạo được đơn");
        target = { id: data[0].order_id, code: data[0].order_code };
        saveOrderCode(target.code);
      }

      const todo = slots.filter((s) => files[s.id] && !files[s.id].error);
      let n = 0;
      for (const s of todo) {
        const p = files[s.id];
        n++;
        setSending(`Đang gửi ảnh ${n}/${todo.length}...`);
        // FILE GỐC, không nén
        const path = `${target.id}/${s.kind}${s.page ? `-p${String(s.page).padStart(2, "0")}` : ""}-${randomName(p.file)}`;
        const up = await sb.storage.from("order-files").upload(path, p.file, { contentType: p.file.type, upsert: false });
        if (up.error) throw new Error(`Gửi "${s.full}" thất bại: ${up.error.message}`);
        const reg = await sb.rpc("register_order_file", {
          p_order_id: target.id, p_kind: s.kind, p_storage_path: path, p_file_name: p.file.name,
          p_mime_type: p.file.type, p_size_bytes: p.file.size, p_page: s.page,
          p_width_px: p.check?.width ?? null, p_height_px: p.check?.height ?? null,
          ...(order && line ? { p_order_item_id: line.id, p_copy_no: copyNo } : {}),
        });
        if (reg.error) throw new Error(reg.error.message);
      }
      if (order && music !== (order.music_link || "")) {
        setSending("Đang lưu link nhạc...");
        const { error } = await sb.rpc("set_order_music_link", { p_order_id: order.id, p_link: music });
        if (error) throw new Error(error.message);
      }
      if (order) {
        setAllFiles((all) => ({ ...all, [ctx]: {} }));
        setSentNote(todo.length ? `Đã gửi ${todo.length} file cho “${line?.package_name ?? ""}”${copiesOf(line!) > 1 ? ` · Bản ${copyNo}` : ""}.` : "Đã lưu.");
        setStep(1);
        await loadOrder(order.code, verifyPhone);
      } else {
        setDone({ code: target.code, count: todo.length });
      }
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Có lỗi, bạn thử lại nhé.");
    }
    setSending("");
  }

  // ---------- Màn hình cảm ơn (gửi file không có đơn sẵn) ----------
  if (done) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-14 text-center font-sans">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#fff0f6] text-[#ff5fa2]"><Check size={24} /></span>
        <h1 className="mt-3 font-sans text-[22px] font-bold normal-case tracking-[-0.02em] sm:text-[28px]">Cảm ơn bạn!</h1>
        <p className="mt-3 text-[#71717a]">Tiệm đã nhận {done.count} ảnh. Mã đơn của bạn:</p>
        <p className="mx-auto mt-3 inline-block rounded-[10px] border border-[#e5e5e7] bg-white px-5 py-2 text-[22px] font-semibold tracking-wide text-[#18181b]">{done.code}</p>
        <p className="mt-4 text-[13px] text-[#71717a]">Lưu lại mã đơn nhé. Tiệm sẽ kiểm tra file và nhắn bạn qua Zalo/SĐT nếu cần chỉnh sửa.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/don-hang-cua-toi" className={btnClass("primary")}>Xem đơn hàng của tôi</Link>
          <Link href="/" className={btnClass("secondary")}>Về trang chủ</Link>
        </div>
      </div>
    );
  }

  const header = <PageHeader inset={false} title="Gửi file" />;

  // ---------- Đơn: đang tải / cần xác nhận SĐT ----------
  if (orderCode && orderState !== "ready") {
    return (
      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-6 font-sans text-[14px]">
        {header}
        {orderState === "loading" ? <p className="mt-6 text-[#71717a]">Đang tải đơn {orderCode}...</p> : (
          <form className="mt-4 rounded-[12px] border border-[#e5e5e7] bg-white p-5" onSubmit={(e) => {
            e.preventDefault(); setVerifyErr("");
            const p = normalizePhone(verifyPhone);
            if (!p) return setVerifyErr(PHONE_ERROR);
            loadOrder(orderCode, p);
          }}>
            <p className="text-[15px] font-semibold">Xác nhận đơn {orderCode}</p>
            <p className="mt-1 text-[13px] text-[#71717a]">Nhập số điện thoại đã đặt hàng để gửi file cho đơn này.</p>
            <input className={`${inputClass} mt-3`} type="tel" inputMode="tel" placeholder="Số điện thoại" value={verifyPhone} onChange={(e) => setVerifyPhone(e.target.value)} />
            {verifyErr && <p className="mt-2 text-[12px] text-[#dc2626]">{verifyErr}</p>}
            <button className={`${btnClass("primary")} mt-3 w-full`}>Xác nhận</button>
            <p className="mt-3 text-[12px] text-[#71717a]">Hoặc <Link href="/don-hang-cua-toi" className="font-medium text-[#ff5fa2] hover:text-[#e0468a]">xem đơn hàng của tôi</Link>.</p>
          </form>
        )}
      </div>
    );
  }

  const title = order ? (line?.package_name ?? "") : pkg?.name ?? "";
  const desc = layout ? describeLayout(layout) : "";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 font-sans text-[14px] text-[#18181b]">
      {header}

      {!order && !pkg ? (
        <>
          {waiting.length > 0 && (
            <section className="mt-4">
              <p className="mb-2 text-[15px] font-semibold">Đơn đang chờ file</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {waiting.map((o) => (
                  <Link key={o.id} href={uploadHref(o.code)}
                    className="flex items-center justify-between gap-3 rounded-[10px] border border-[#e5e5e7] bg-white p-3 hover:border-[#ff5fa2]">
                    <span className="min-w-0">
                      <span className="block font-medium">{o.payment_code ?? o.code}</span>
                      <span className="block truncate text-[12px] text-[#71717a]">{o.items.map((i) => `${i.package_name} × ${i.quantity}`).join(", ")}</span>
                    </span>
                    <span className="shrink-0 text-[13px] font-medium text-[#ff5fa2]">Gửi file →</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <section className="mt-6">
            <p className="mb-3 text-[15px] font-semibold">{waiting.length ? "Hoặc chọn gói để gửi file mới" : "Chọn gói của bạn để bắt đầu"}</p>
            <PackageCards packages={packages} onPick={choosePkg} />
          </section>
        </>
      ) : (
        <>
          <Progress step={step} />
          {/* Thẻ đơn / gói */}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[12px] border border-[#e5e5e7] bg-white p-2.5">
            {order ? (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[8px] bg-[#fff0f6] text-[#ff5fa2]"><Disc3 size={22} /></span>
            ) : <Thumb pk={pkg!} />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{order ? `Đơn ${order.payment_code ?? order.code} · ${title}` : title}</p>
              <p className="text-[12px] text-[#71717a]">{desc}</p>
            </div>
            {!order && <button className={`${btnClass("secondary")} shrink-0`} onClick={() => setPendingPkg({ pk: pkg!, lost: [] })}>Đổi gói</button>}
          </div>

          {order && order.lines.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="text-[13px] text-[#71717a]" htmlFor="line-pick">Gửi file cho sản phẩm</label>
              <select id="line-pick" className={`${inputClass} !w-auto min-w-[240px]`} value={line?.id}
                onChange={(e) => { setLineId(e.target.value); setCopyNo(1); setStep(1); setSentNote(""); }}>
                {order.lines.map((l) => <option key={l.id} value={l.id}>{lineDone(order, l) ? "✓ " : ""}{l.package_name} × {l.quantity}</option>)}
              </select>
            </div>
          )}
          {order && line && line.quantity > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-[#71717a]">{line.quantity} bản:</span>
              <div className="inline-flex rounded-[8px] border border-[#e5e5e7] bg-white p-0.5">
                {(["same", "different"] as const).map((m) => (
                  <button key={m} type="button" disabled={readOnly} onClick={() => setMode(m)}
                    className={`rounded-[6px] px-3 py-1.5 text-[13px] font-medium ${line.copies_mode === m ? "bg-[#fff0f6] text-[#ff5fa2]" : "text-[#52525b]"}`}>
                    {m === "same" ? "Các bản giống nhau" : "Mỗi bản khác nhau"}
                  </button>
                ))}
              </div>
              {line.copies_mode === "different" && (
                <select className={`${inputClass} !w-auto`} value={copyNo} onChange={(e) => { setCopyNo(Number(e.target.value)); setStep(1); setSentNote(""); }} aria-label="Chọn bản">
                  {Array.from({ length: line.quantity }, (_, i) => i + 1).map((c) => {
                    const ok = slots.every((s) => latestFor(order, line, c, s));
                    return <option key={c} value={c}>{ok ? "✓ " : ""}Bản {c}</option>;
                  })}
                </select>
              )}
            </div>
          )}
          {readOnly && <p className="mt-3 rounded-[8px] bg-[#fffbeb] px-3 py-2 text-[13px] text-[#b45309]">Đơn đã chuyển sang “Đang làm” — bạn chỉ xem được file đã gửi, không thay được nữa.</p>}
          {sentNote && <p className="mt-3 flex items-center gap-2 rounded-[8px] bg-[#ecfdf3] px-3 py-2 text-[13px] text-[#15803d]"><Check size={14} /> {sentNote}</p>}

          {step === 1 ? (
            <section className="mt-6">
              {Object.values(files).some((p) => !p.error && p.preview) && (
                <button type="button" className={`${btnClass("secondary", "sm")} mb-3`}
                  onClick={async () => {
                    const map: Record<string, File> = {};
                    for (const [k, p] of Object.entries(files)) if (!p.error) map[k] = p.file;
                    await saveHandoff(order ? line?.package_id ?? null : pkg?.id ?? null, map);
                    window.location.href = "/thiet-ke/mockup";
                  }}><Eye size={16} /> Xem mockup</button>
              )}
              <CdUploadPanel slots={slots} layout={layout!} files={files} readOnly={readOnly}
                existing={Object.fromEntries(Object.entries(existing).map(([k, ex]) => [k, { name: ex.file_name, url: previews[ex.storage_path] ?? null, pdf: ex.mime_type === "application/pdf" }]))}
                onPick={(s, f) => pickFor(s, f)} onRemove={(s) => setSlot(s.id, null)} />

              {!readOnly && (
                <button className="mt-8 h-11 w-full rounded-[10px] text-[15px] font-semibold text-white sm:w-auto sm:px-10"
                  style={{ background: PINK }} onClick={() => { setStep(2); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  Tiếp tục →
                </button>
              )}
            </section>
          ) : (
            <section className="mt-6 max-w-xl">
              <p className="mb-1 text-[16px] font-semibold">Link file nhạc</p>
              <p className="mb-2 text-[13px] text-[#71717a]">
                Tải nhạc lên Google Drive, bấm <b>Chia sẻ → Bất kỳ ai có đường liên kết</b>, rồi dán link vào đây.
              </p>
              <p className="mb-2 rounded-[8px] bg-[#f4f4f5] px-3 py-2 text-[12px] text-[#52525b]">
                ⓘ Bạn chưa tải được nhạc từ YouTube và Spotify? <Link href="/huong-dan#audio" className="font-semibold text-[#ff5fa2] hover:text-[#e0468a]">Nhấn vào đây</Link> để xem hướng dẫn
              </p>
              <input className={inputClass} type="url" inputMode="url" placeholder="https://drive.google.com/..." value={link} onChange={(e) => setLink(e.target.value)} />

              {!order && (
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <p className="text-[13px] font-semibold sm:col-span-2">Thông tin liên hệ</p>
                  <input className={inputClass} placeholder="Tên của bạn" value={name} onChange={(e) => setName(e.target.value)} />
                  <input className={inputClass} type="tel" inputMode="tel" placeholder="Số điện thoại / Zalo" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              )}

              <button className={`${btnClass("secondary")} mt-5`} onClick={() => setStep(1)}>← Quay lại</button>

              <div className="mt-6">
                {missing.length > 0 && (
                  <p className="mb-2 text-[12px] text-[#d97706]">
                    Còn {missing.length} ảnh chưa tải lên:{" "}
                    {missing.map((s, i) => (
                      <span key={s.id}>
                        <button className="font-medium hover:text-[#ff5fa2]" onClick={() => goToSlot(s.id)}>{s.full}</button>{i < missing.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </p>
                )}
                {err && <p className="mb-2 text-[13px] text-[#dc2626]">{err}</p>}
                <button className="h-12 w-full rounded-[10px] text-[16px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                  style={{ background: PINK }} disabled={missing.length > 0 || !!sending || (!!order && !newCount && link.trim() === (order.music_link || ""))} onClick={send}>
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
          <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal onClick={() => setPendingPkg(null)}>
            <div className="max-h-[90dvh] w-full max-w-2xl overflow-auto rounded-[12px] bg-white p-5 font-sans shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[16px] font-semibold">Đổi gói</p>
                <button className={`${btnClass("secondary")}`} onClick={() => setPendingPkg(null)}>Đóng</button>
              </div>
              <PackageCards packages={packages} current={pkg?.id} onPick={choosePkg} />
            </div>
          </div>
        )
      )}

    </div>
  );
}

// ---------- Thanh tiến trình ----------
function Progress({ step }: { step: 1 | 2 }) {
  const item = (n: 1 | 2, label: string) => (
    <div className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-full text-[13px] font-bold"
        style={step >= n ? { background: PINK, color: "#fff" } : { background: "#f4f4f5", color: "#a1a1aa" }}>{n}</span>
      <span className={`text-[14px] ${step === n ? "font-semibold" : "text-[#71717a]"}`}>{label}</span>
    </div>
  );
  return (
    <div className="mt-5 flex items-center gap-3">
      {item(1, "Chọn ảnh")}
      <span className="h-[2px] w-10 rounded-full sm:w-20" style={{ background: step === 2 ? PINK : "#e5e5e7" }} />
      {item(2, "Link nhạc")}
    </div>
  );
}

// ---------- Thẻ gói (giống Custom CD, không hiện giá) ----------
function Thumb({ pk }: { pk: Package }) {
  return (
    <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-[6px] bg-[#f4f4f5]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {pk.image_url && <img src={pk.image_url} alt="" className="h-full w-full object-cover" />}
    </span>
  );
}
function PackageCards({ packages, current, onPick }: { packages: Package[]; current?: string; onPick: (pk: Package) => void }) {
  if (!packages.length) return <p className="text-[13px] text-[#71717a]">Tiệm chưa có gói sản phẩm nào.</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {packages.map((pk) => (
        <button key={pk.id} onClick={() => onPick(pk)}
          className={`flex w-full items-center gap-2.5 rounded-[10px] border bg-white p-2 text-left font-sans text-[14px] hover:border-[#ff5fa2] ${current === pk.id ? "border-[#ff5fa2]" : "border-[#e5e5e7]"}`}>
          <Thumb pk={pk} />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{pk.name}</span>
            <span className="block text-[12px] text-[#71717a]">{describePkg(pk)}</span>
          </span>
        </button>
      ))}
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
          <button className={`${btnClass("secondary")}`} onClick={onCancel}>{cancel}</button>
          <button className={danger ? `${btnClass("primary")} !bg-[#dc2626] hover:!bg-[#b91c1c]` : btnClass("primary")} onClick={onOk}>{ok}</button>
        </div>
      </div>
    </div>
  );
}
