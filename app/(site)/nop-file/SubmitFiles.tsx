"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { SPECS, sizeText, mmToPx, type PrintSpec } from "@/lib/print";
import { checkImage, validateFile, type CheckResult } from "@/lib/imageCheck";
import { randomName } from "@/lib/upload";
import { formatBytes } from "@/lib/format";
import { BookletPage, CaseBack, CaseFront, Disc, GuideLegend } from "@/components/mockup/Mockups";

type Slot = {
  file?: File;
  preview?: string;
  check?: CheckResult;
  status: "idle" | "uploading" | "done" | "error";
  error?: string;
  count: number; // số lần đã gửi cho ô này
};

const levelStyle = { ok: "bg-matcha-100 text-matcha-500", warn: "bg-butter-100 text-cocoa-600", bad: "bg-pink-100 text-pink-500" };

export function SubmitFiles({ initialCode }: { initialCode: string }) {
  const [query, setQuery] = useState(initialCode);
  const [order, setOrder] = useState<{ id: string; code: string } | null>(null);
  const [finding, setFinding] = useState(false);
  const [findErr, setFindErr] = useState("");
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [pages, setPages] = useState(0);
  const auto = useRef(false);

  async function find(q = query) {
    setFindErr("");
    if (!q.trim()) return;
    if (!hasSupabase) return setFindErr("Web chưa kết nối database.");
    setFinding(true);
    const { data, error } = await createClient().rpc("find_order_for_upload", { p_query: q.trim() });
    setFinding(false);
    if (error) return setFindErr(error.message);
    if (!data?.[0]) return setFindErr("Không tìm thấy đơn đang chờ nộp file. Bạn kiểm tra lại mã đơn hoặc số điện thoại nhé.");
    setOrder({ id: data[0].order_id, code: data[0].order_code });
  }

  useEffect(() => {
    if (initialCode && !auto.current) {
      auto.current = true;
      find(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  function patch(key: string, s: Partial<Slot>) {
    setSlots((cur) => ({ ...cur, [key]: { ...({ status: "idle", count: 0 } as Slot), ...cur[key], ...s } }));
  }

  async function handleFile(key: string, spec: PrintSpec, file: File, page?: number) {
    if (!order) return;
    const invalid = validateFile(file);
    if (invalid) return patch(key, { status: "error", error: invalid, file: undefined, preview: undefined, check: undefined });

    const old = slots[key]?.preview;
    if (old) URL.revokeObjectURL(old);
    const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
    let check: CheckResult | undefined;
    try {
      check = await checkImage(file, spec);
    } catch {
      return patch(key, { status: "error", error: "Không đọc được ảnh, file có thể bị lỗi." });
    }
    patch(key, { file, preview, check, status: "uploading", error: undefined });

    // Tải FILE GỐC lên (không nén) vào bucket riêng tư
    const sb = createClient();
    const path = `${order.id}/${spec.kind}${page ? `-p${String(page).padStart(2, "0")}` : ""}-${randomName(file)}`;
    const up = await sb.storage.from("order-files").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) return patch(key, { status: "error", error: "Tải lên thất bại: " + up.error.message });
    const reg = await sb.rpc("register_order_file", {
      p_order_id: order.id,
      p_kind: spec.kind,
      p_storage_path: path,
      p_file_name: file.name,
      p_mime_type: file.type,
      p_size_bytes: file.size,
      p_page: page ?? null,
      p_width_px: check.width ?? null,
      p_height_px: check.height ?? null,
    });
    if (reg.error) return patch(key, { status: "error", error: reg.error.message });
    setSlots((cur) => ({ ...cur, [key]: { ...cur[key], status: "done", count: (cur[key]?.count ?? 0) + 1 } }));
  }

  // Chọn nhiều trang booklet một lúc → điền lần lượt vào các trang còn trống
  async function handleMany(files: FileList) {
    const empty = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => !slots[`booklet-${p}`]?.file);
    const list = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    await Promise.all(list.slice(0, empty.length).map((f, i) => handleFile(`booklet-${empty[i]}`, SPECS.booklet, f, empty[i])));
  }

  if (!order) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); find(); }}
        className="pop stitch mx-auto max-w-md rounded-[2rem] bg-cream-50 px-5 py-8 text-center">
        <h2 className="text-2xl">Bước 1: Tìm đơn của bạn</h2>
        <p className="mb-4 mt-1 text-sm text-cocoa-500">Nhập mã đơn (ví dụ TL-261116-AB12) hoặc số điện thoại đã đặt.</p>
        <input className="field text-center" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mã đơn hoặc SĐT" autoFocus />
        {findErr && <p className="mt-3 rounded-xl bg-pink-100 px-3 py-2 text-sm text-pink-500">{findErr}</p>}
        <button className="btn mt-4 w-full bg-pink-300" disabled={finding}>{finding ? "Đang tìm..." : "Tiếp tục →"}</button>
        <p className="mt-4 text-xs text-cocoa-400">Chưa có đơn? <Link className="underline" href="/dat-don">Đặt đơn tại đây</Link></p>
      </form>
    );
  }

  const doneCount = Object.values(slots).filter((s) => s.status === "done").length;
  const busy = Object.values(slots).some((s) => s.status === "uploading");

  return (
    <div className="mx-auto max-w-5xl px-4">
      <div className="pop-sm mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-matcha-100 px-5 py-3">
        <p>Đang nộp file cho đơn <b className="font-display text-xl">{order.code}</b></p>
        <button className="text-sm underline" onClick={() => { setOrder(null); setSlots({}); }}>Đổi đơn khác</button>
      </div>

      <div className="mb-6 rounded-3xl bg-cream-50 p-4 text-sm text-cocoa-600">
        <p>• Chỉ cần nộp những phần có trong gói của bạn. Nhận file <b>JPG, PNG, PDF</b>, tối đa <b>30MB</b>/file — tiệm lưu nguyên file gốc, không nén.</p>
        <p>• Nộp lại một ô thì tiệm sẽ dùng file mới nhất. Xem kích thước chuẩn ở <Link href="/huong-dan" className="underline">Hướng dẫn làm file</Link>.</p>
        <div className="mt-3"><GuideLegend /></div>
      </div>

      <h2 className="mb-4 text-2xl">Bước 2: Tải file hình ảnh</h2>
      <div className="grid gap-6 md:grid-cols-3">
        <UploadCard spec={SPECS.front} slot={slots.front} onFile={(f) => handleFile("front", SPECS.front, f)}>
          {(src, pdf) => <CaseFront spec={SPECS.front} src={src} isPdf={pdf} />}
        </UploadCard>
        <UploadCard spec={SPECS.back} slot={slots.back} onFile={(f) => handleFile("back", SPECS.back, f)}
          note="2 dải tối ở hai bên là gáy hộp (gập vào)">
          {(src, pdf) => <CaseBack spec={SPECS.back} src={src} isPdf={pdf} />}
        </UploadCard>
        <UploadCard spec={SPECS.disc} slot={slots.disc} onFile={(f) => handleFile("disc", SPECS.disc, f)}
          note="Làm ảnh vuông — phần ngoài vòng tròn và lỗ giữa sẽ không in">
          {(src, pdf) => <Disc spec={SPECS.disc} src={src} isPdf={pdf} />}
        </UploadCard>
      </div>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h3 className="text-xl">Booklet</h3>
          <div className="flex flex-wrap gap-2">
            {[0, 4, 8, 12].map((n) => (
              <button key={n} onClick={() => setPages(n)}
                className={`pop-sm rounded-full px-4 py-1.5 font-display ${pages === n ? "bg-pink-300" : "bg-cream-50"}`}>
                {n ? `${n} trang` : "Không có"}
              </button>
            ))}
          </div>
        </div>
        {pages > 0 && (
          <>
            <p className="mb-3 text-sm text-cocoa-500">
              Mỗi trang {sizeText(SPECS.booklet)} ({mmToPx(SPECS.booklet.w)} x {mmToPx(SPECS.booklet.h)} px). Trang 1 là bìa booklet.
              <label className="ml-2 cursor-pointer underline">
                Chọn nhiều trang một lúc
                <input type="file" multiple accept="image/jpeg,image/png,application/pdf" className="sr-only"
                  onChange={(e) => { if (e.target.files) handleMany(e.target.files); e.target.value = ""; }} />
              </label>
            </p>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <UploadCard key={p} compact spec={SPECS.booklet} slot={slots[`booklet-${p}`]}
                  onFile={(f) => handleFile(`booklet-${p}`, SPECS.booklet, f, p)} title={p === 1 ? "Trang 1 (bìa)" : `Trang ${p}`}>
                  {(src, pdf) => <BookletPage pageNo={p} spec={SPECS.booklet} src={src} isPdf={pdf} placeholder={`Trang ${p}`} />}
                </UploadCard>
              ))}
            </div>
          </>
        )}
      </section>

      <MusicLink orderId={order.id} />

      <div className="pop mt-10 rounded-[2rem] bg-pink-100 px-5 py-6 text-center">
        {busy ? (
          <p className="font-display text-xl">Đang tải file lên, bạn đừng đóng trang nhé...</p>
        ) : doneCount ? (
          <>
            <p className="font-display text-2xl">Tiệm đã nhận {doneCount} file ✿</p>
            <p className="mt-1 text-sm text-cocoa-500">Tiệm sẽ kiểm tra và nhắn bạn qua Zalo nếu cần chỉnh sửa. Cảm ơn bạn!</p>
          </>
        ) : (
          <p className="text-cocoa-500">Chưa có file nào được gửi.</p>
        )}
      </div>
    </div>
  );
}

function UploadCard({ spec, slot, onFile, children, note, title, compact }: {
  spec: PrintSpec; slot?: Slot; onFile: (f: File) => void;
  children: (src: string | undefined, isPdf: boolean) => React.ReactNode;
  note?: string; title?: string; compact?: boolean;
}) {
  const isPdf = slot?.file?.type === "application/pdf";
  return (
    <div className={`pop flex flex-col rounded-[2rem] bg-cream-50 ${compact ? "p-3" : "p-4"}`}>
      {!compact && (
        <div className="mb-3">
          <h3 className="text-xl">{title ?? spec.label}</h3>
          <p className="text-xs text-cocoa-400">{sizeText(spec)} · {mmToPx(spec.w)} x {mmToPx(spec.h)} px</p>
        </div>
      )}
      <div className={compact ? "mb-3 mt-2" : "mb-3 px-2"}>{children(slot?.preview, isPdf)}</div>
      {note && !compact && <p className="mb-2 text-xs text-cocoa-400">{note}</p>}

      {slot?.check && slot.status !== "error" && (
        <ul className={`mb-2 space-y-1 rounded-xl px-3 py-2 text-xs ${levelStyle[slot.check.level]}`}>
          {slot.check.messages.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
      {slot?.error && <p className="mb-2 rounded-xl bg-pink-100 px-3 py-2 text-xs text-pink-500">{slot.error}</p>}
      {slot?.file && <p className="mb-2 truncate text-xs text-cocoa-400">{slot.file.name} · {formatBytes(slot.file.size)}</p>}

      <label className={`btn mt-auto cursor-pointer !text-base ${slot?.status === "done" ? "bg-matcha-200" : "bg-pink-200"} ${compact ? "!min-h-10 !px-3 !text-sm" : ""}`}>
        {slot?.status === "uploading" ? "Đang gửi..." : slot?.status === "done" ? "✓ Đã gửi · Đổi file" : compact ? "Chọn file" : `Chọn file ${spec.label.toLowerCase()}`}
        <input type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only" disabled={slot?.status === "uploading"}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
      </label>
    </div>
  );
}

function MusicLink({ orderId }: { orderId: string }) {
  const [link, setLink] = useState("");
  const [state, setState] = useState<"" | "saving" | "saved" | "error">("");
  const [err, setErr] = useState("");
  return (
    <section className="mt-10">
      <h2 className="mb-2 text-2xl">Bước 3: Link file nhạc</h2>
      <form className="pop-sm rounded-3xl bg-cream-50 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!/^https?:\/\//i.test(link.trim())) { setState("error"); setErr("Link cần bắt đầu bằng https://"); return; }
          setState("saving");
          const { error } = await createClient().rpc("set_order_music_link", { p_order_id: orderId, p_link: link.trim() });
          if (error) { setState("error"); setErr(error.message); } else setState("saved");
        }}>
        <p className="mb-3 text-sm text-cocoa-500">
          Tải file nhạc lên Google Drive, bấm <b>Chia sẻ → Bất kỳ ai có đường liên kết</b>, rồi dán link vào đây (không upload nhạc lên web).
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="field" type="url" inputMode="url" placeholder="https://drive.google.com/..." value={link}
            onChange={(e) => { setLink(e.target.value); setState(""); }} />
          <button className="btn shrink-0 bg-matcha-200" disabled={state === "saving"}>{state === "saving" ? "Đang lưu..." : "Lưu link"}</button>
        </div>
        {state === "saved" && <p className="mt-2 text-sm text-matcha-500">✓ Đã lưu link nhạc</p>}
        {state === "error" && <p className="mt-2 text-sm text-pink-500">{err}</p>}
      </form>
    </section>
  );
}
