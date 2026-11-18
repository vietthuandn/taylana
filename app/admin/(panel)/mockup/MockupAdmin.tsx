"use client";

/* Admin → Mẫu mockup: 4a Khung CD (tối đa 5) · 4b Nền của tiệm (chỉ link) */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { proxied } from "@/lib/mockup/images";
import type { MockupBackground, MockupFrame } from "@/lib/mockup/types";
import { revalidatePublic } from "@/app/admin/actions";
import { uploadMockupModel } from "@/lib/upload";
import { Badge, Button, Card, EmptyState, Field, Input, Message, Select, Toggle, confirmDialog } from "@/components/admin/ui";
import { btnClass, cx } from "@/components/admin/styles";

type Msg = { type: "ok" | "err"; text: string } | null;
const PATHS = ["/thiet-ke/mockup"];

// Kéo thả sắp xếp, lưu sort_order
function useSortable<T extends { id: string; sort_order: number }>(table: string, onDone: () => void) {
  const [drag, setDrag] = useState<number | null>(null);
  const drop = async (list: T[], to: number, set: (l: T[]) => void) => {
    if (drag === null || drag === to) return;
    const next = [...list];
    const [x] = next.splice(drag, 1);
    next.splice(to, 0, x);
    set(next);
    const sb = createClient();
    await Promise.all(next.map((r, i) => (r.sort_order === i + 1 ? null : sb.from(table).update({ sort_order: i + 1 }).eq("id", r.id))));
    onDone();
  };
  return { drag, setDrag, drop };
}

export function MockupAdmin() {
  const [frames, setFrames] = useState<MockupFrame[]>([]);
  const [bgs, setBgs] = useState<MockupBackground[]>([]);
  const [msg, setMsg] = useState<Msg>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [mset, setMset] = useState<Record<string, unknown>>({}); // site_settings "mockup" (khay 3D…)

  const load = useCallback(async () => {
    const sb = createClient();
    const [f, b] = await Promise.all([
      sb.from("mockup_frames").select("*").order("sort_order").order("created_at"),
      sb.from("mockup_backgrounds").select("*").order("sort_order").order("created_at"),
    ]);
    const st = await sb.from("site_settings").select("value").eq("key", "mockup").maybeSingle();
    setMset((st.data?.value as Record<string, unknown>) ?? {});
    if (f.error) setMsg({ type: "err", text: "Chưa có bảng mockup — cần chạy supabase/migration_mockups.sql." });
    setFrames((f.data ?? []) as MockupFrame[]);
    setBgs((b.data ?? []) as MockupBackground[]);
    setReady(true);
  }, []);
  useEffect(() => { load(); }, [load]);
  const after = async (text: string) => { setMsg({ type: "ok", text }); await revalidatePublic(PATHS); await load(); };
  const fs = useSortable<MockupFrame>("mockup_frames", () => after("Đã đổi thứ tự."));
  const bs = useSortable<MockupBackground>("mockup_backgrounds", () => after("Đã đổi thứ tự."));

  async function toggle(table: string, id: string, v: boolean) {
    const { error } = await createClient().from(table).update({ is_active: v }).eq("id", id);
    if (error) return setMsg({ type: "err", text: error.message });
    await after(v ? "Đã bật." : "Đã tắt.");
  }
  async function remove(table: string, id: string, label: string) {
    if (!await confirmDialog(`Xoá "${label}"?`)) return;
    const { error } = await createClient().from(table).delete().eq("id", id);
    if (error) return setMsg({ type: "err", text: error.message });
    await after("Đã xoá.");
  }
  async function addBg(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !/^https?:\/\//i.test(url.trim())) return setMsg({ type: "err", text: "Nhập tên và link ảnh (bắt đầu bằng https://)." });
    setChecking(true);
    // kiểm tra ảnh tải được không
    const ok = await new Promise<boolean>((res) => { const im = new Image(); im.onload = () => res(im.naturalWidth > 0); im.onerror = () => res(false); im.src = url.trim(); });
    if (!ok) { setChecking(false); return setMsg({ type: "err", text: "Không tải được ảnh từ link này. Kiểm tra lại link (phải là link trực tiếp tới file ảnh)." }); }
    const { error } = await createClient().from("mockup_backgrounds").insert({ name: name.trim(), url: url.trim(), sort_order: (bgs.at(-1)?.sort_order ?? 0) + 1 });
    setChecking(false);
    if (error) return setMsg({ type: "err", text: error.message });
    setName(""); setUrl("");
    await after("Đã thêm nền.");
  }
  async function saveTray(v: string) { await saveSetting({ tray: v }); }
  async function saveSetting(patch: Record<string, unknown>, okText = "Đã lưu cài đặt 3D.") {
    const value = { ...mset, ...patch };
    setMset(value);
    const { error } = await createClient().from("site_settings").upsert({ key: "mockup", value, updated_at: new Date().toISOString() });
    if (error) return setMsg({ type: "err", text: error.message });
    await after(okText);
  }
  // Mô hình 3D (.glb): tải lên bucket "mockups", kiểm tra tên mesh theo quy ước
  const [modelBusy, setModelBusy] = useState(false);
  const [modelInfo, setModelInfo] = useState<{ found: string[]; missing: string[] } | null>(null);
  const modelUrl = (mset.model_url as string | null) || null;
  useEffect(() => {
    if (!modelUrl) { setModelInfo(null); return; }
    let off = false;
    import("@/lib/mockup3d/glb").then((m) => m.inspectGlb(modelUrl)).then((r) => { if (!off) setModelInfo(r); })
      .catch(() => { if (!off) setModelInfo({ found: [], missing: ["(không đọc được file .glb)"] }); });
    return () => { off = true; };
  }, [modelUrl]);
  async function uploadModel(file: File) {
    setModelBusy(true);
    try {
      const url = await uploadMockupModel(file);
      await saveSetting({ model_url: url }, "Đã tải mô hình 3D.");
    } catch (e) { setMsg({ type: "err", text: e instanceof Error ? e.message : "Tải mô hình thất bại" }); }
    setModelBusy(false);
  }

  if (!ready) return <p className="text-[13px] text-[#71717a]">Đang tải...</p>;
  const regular = frames.filter((f) => !f.is_default_box);
  const full = regular.length >= 5; // mẫu mặc định CD + Hộp không tính
  const hasBox = frames.some((f) => f.is_default_box);
  return (
    <div className="space-y-6">
      <Card title={`Khung CD (${regular.length}/5)`} description="Ảnh PNG hộp CD có các vùng trong suốt để chèn ảnh khách. Kéo thả để sắp xếp."
        actions={<div className="flex flex-wrap gap-2">
          {!hasBox && <Link href="/admin/mockup/moi?box=1" className={btnClass("secondary", "sm")}><Plus size={16} /> Mẫu mặc định CD + Hộp</Link>}
          {full ? <Button size="sm" disabled title="Đã đủ 5 mẫu">Tạo mẫu mới</Button>
            : <Link href="/admin/mockup/moi" className={btnClass("primary", "sm")}><Plus size={16} /> Tạo mẫu mới</Link>}
        </div>}>
        {frames.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {frames.map((f, i) => (
              <li key={f.id} draggable onDragStart={() => fs.setDrag(i)} onDragEnd={() => fs.setDrag(null)} onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); fs.drop(frames, i, setFrames); fs.setDrag(null); }}
                className={cx("overflow-hidden rounded-[12px] border border-[#e5e5e7] bg-white", fs.drag === i && "opacity-40")}>
                <div className="relative aspect-[4/3] bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={proxied(f.image_url)} alt="" className="h-full w-full object-contain" loading="lazy" />
                  <span className="absolute left-2 top-2 cursor-grab rounded-[6px] bg-white/90 p-1 text-[#71717a]"><GripVertical size={16} /></span>
                </div>
                <div className="flex items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{f.name}</p>
                    <p className="text-[12px] text-[#71717a]">{f.is_default_box && <><Badge tone="pink">Mặc định CD + Hộp</Badge> · </>}{f.regions.length} vùng · {f.is_active ? <Badge tone="green">Đang bật</Badge> : <Badge>Đang tắt</Badge>}</p>
                  </div>
                  <Toggle checked={f.is_active} onChange={(v) => toggle("mockup_frames", f.id, v)} label="" />
                  <Link href={`/admin/mockup/${f.id}`} className={btnClass("ghost", "sm")} aria-label="Sửa"><Pencil size={16} /></Link>
                  <Button variant="ghost" size="sm" className="!text-[#dc2626]" aria-label="Xoá" onClick={() => remove("mockup_frames", f.id, f.name)}><Trash2 size={16} /></Button>
                </div>
              </li>
            ))}
          </ul>
        ) : <EmptyState>Chưa có mẫu khung nào.</EmptyState>}
      </Card>

      <Card title="Nền của tiệm" description="Chỉ nhận LINK ảnh (không lưu file). Khách chọn ở trang Xem Mockup.">
        <form onSubmit={addBg} className="mb-4 grid gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-end">
          <Field label="Tên nền"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Bàn gỗ" /></Field>
          <Field label="Link ảnh"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></Field>
          <Button type="submit" icon={<Plus size={16} />} loading={checking}>Thêm nền</Button>
        </form>
        {bgs.length ? (
          <ul className="divide-y divide-[#efeff1] rounded-[12px] border border-[#e5e5e7]">
            {bgs.map((b, i) => (
              <li key={b.id} draggable onDragStart={() => bs.setDrag(i)} onDragEnd={() => bs.setDrag(null)} onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); bs.drop(bgs, i, setBgs); bs.setDrag(null); }}
                className={cx("flex items-center gap-3 p-3", bs.drag === i && "opacity-40")}>
                <GripVertical size={16} className="shrink-0 cursor-grab text-[#a1a1aa]" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.url} alt="" className="h-12 w-16 shrink-0 rounded-[6px] bg-[#f4f4f5] object-cover" loading="lazy" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{b.name}</p>
                  <p className="truncate text-[12px] text-[#71717a]" title={b.url}>{b.url}</p>
                </div>
                <Toggle checked={b.is_active} onChange={(v) => toggle("mockup_backgrounds", b.id, v)} label="" />
                <Button variant="ghost" size="sm" className="!text-[#dc2626]" aria-label="Xoá" onClick={() => remove("mockup_backgrounds", b.id, b.name)}><Trash2 size={16} /></Button>
              </li>
            ))}
          </ul>
        ) : <EmptyState>Chưa có nền nào.</EmptyState>}
      </Card>

      <Card title="Mẫu 3D" description="Thẻ “3D” luôn có ở cuối cột chọn mẫu phía khách (không tính vào 5 mẫu).">
        <Field label="Khay giữ đĩa">
          <Select value={mset.tray === "black" ? "black" : "clear"} onChange={(e) => saveTray(e.target.value)} className="max-w-[240px]">
            <option value="clear">Trong suốt</option>
            <option value="black">Đen</option>
          </Select>
        </Field>
        <Field label="Mặt ngoài bìa">
          <Select value={mset.finish === "gloss" ? "gloss" : "matte"} onChange={(e) => saveSetting({ finish: e.target.value })} className="max-w-[240px]">
            <option value="matte">Mờ</option>
            <option value="gloss">Bóng</option>
          </Select>
        </Field>
      </Card>

      <Card title="Mô hình 3D" description="Tuỳ chọn: file .glb hộp CD thay cho hộp tự dựng. Tên mesh theo quy ước: lid, base, front_cover_outer, front_cover_inner, back_card_outer, back_card_inner, disc_top, disc_bottom + node hinge_lid (trục mở nắp = trục Z cục bộ). Thiếu mesh nào thì vùng đó không dán ảnh.">
        <div className="flex flex-wrap items-center gap-2">
          <label className={btnClass("secondary", "sm")}>
            <Plus size={16} /> {modelBusy ? "Đang tải..." : modelUrl ? "Thay file .glb" : "Tải file .glb"}
            <input type="file" accept=".glb,model/gltf-binary" className="sr-only" disabled={modelBusy}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadModel(f); }} />
          </label>
          {modelUrl && <Button variant="secondary" size="sm" onClick={() => saveSetting({ model_url: null }, "Đã quay về mô hình tự dựng.")}>Dùng mô hình tự dựng</Button>}
          <span className="text-[13px] text-[#71717a]">{modelUrl ? "Đang dùng mô hình tải lên." : "Đang dùng mô hình tự dựng."}</span>
        </div>
        {modelUrl && modelInfo && (
          <div className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2">
            <div><p className="mb-1 font-medium">Tìm thấy ({modelInfo.found.length})</p><p className="break-words text-[#52525b]">{modelInfo.found.join(", ") || "—"}</p></div>
            <div><p className="mb-1 font-medium">Còn thiếu ({modelInfo.missing.length})</p>
              <p className={cx("break-words", modelInfo.missing.length ? "text-[#b45309]" : "text-[#15803d]")}>{modelInfo.missing.join(", ") || "Đủ tất cả mesh quy ước"}</p></div>
          </div>
        )}
      </Card>
      <Message msg={msg} />
    </div>
  );
}
