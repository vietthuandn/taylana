"use client";

/* Trình tạo mẫu Custom CD cho admin — dùng chung CdDesigner (chế độ "template"):
   ảnh trang trí (trên/dưới ảnh khách), khung ảnh, chữ, màu nền, ảnh nền; cùng zoom/guideline/gáy/Spine/ướm khay. */
import { useMemo, useRef, useState } from "react";
import { BACK_SPINE_MM, SPECS, mmToPx, sizeText } from "@/lib/print";
import { INNER_SPINE_FROM_CM, INNER_SPINE_ROTATION, INNER_SPINE_TO_CM, LEFT_SPINE_ROTATION, RIGHT_SPINE_ROTATION, TRAY_DISC_DIAMETER_CM, TRAY_DISC_HOLE_CM } from "@/lib/cdSpecs";
import { emptyDoc, templateDoc, type PageDoc, type TemplateDoc } from "@/lib/cdDoc";
import type { DesignTemplate } from "@/lib/templates";
import { uploadPublicImage } from "@/lib/upload";
import { useSize } from "@/components/designer/useSize";
import { dirOf, type Zone } from "@/components/designer/Spine";
import { CdDesigner, type CdDesignerHandle } from "./CdDesigner";
import { Icon } from "./icons";

export type TplTarget = "front" | "back_outer" | "back_inner" | "disc";
export const TPL_TARGETS: { value: TplTarget; label: string }[] = [
  { value: "front", label: "Bìa trước (12 × 12 cm)" },
  { value: "back_outer", label: "Bìa sau - Mặt Ngoài (15 × 11.7 cm, có gáy)" },
  { value: "back_inner", label: "Bìa sau - Mặt Trong (15 × 11.7 cm, gáy + Spine)" },
  { value: "disc", label: "Mặt đĩa (tròn 12 cm)" },
];
const specFor = (t: TplTarget) => (t === "disc" ? SPECS.disc : t === "front" ? SPECS.front : SPECS.back);

export type TemplateRow = DesignTemplate & { doc?: TemplateDoc | null; target: string };

const BW = mmToPx(SPECS.back.w), BH = mmToPx(SPECS.back.h), GAY = mmToPx(BACK_SPINE_MM);
const IN_FROM = mmToPx(INNER_SPINE_FROM_CM * 10), IN_TO = mmToPx(INNER_SPINE_TO_CM * 10);
const TRAY = { cx: (IN_TO + (BW - GAY)) / 2, cy: BH / 2, r: mmToPx(TRAY_DISC_DIAMETER_CM * 5), hole: mmToPx(TRAY_DISC_HOLE_CM * 5) };

async function dataUrlToBlob(url: string) { return (await fetch(url)).blob(); }

export function CdTemplateEditor({ row, onSave, onCancel }: {
  row: Partial<TemplateRow> & { name: string; is_active: boolean };
  onSave: (r: { name: string; target: TplTarget; is_active: boolean; doc: TemplateDoc; thumbnail_url: string | null }) => Promise<unknown>;
  onCancel: () => void;
}) {
  const initTarget: TplTarget = row.target === "back" ? "back_outer" : ((row.target as TplTarget) ?? "front");
  const [target, setTarget] = useState<TplTarget>(initTarget);
  const [name, setName] = useState(row.name);
  const [active, setActive] = useState(row.is_active);
  const [guides, setGuides] = useState(true);
  const [trayOn, setTrayOn] = useState(true);
  const [doc, setDoc] = useState<PageDoc>(() => {
    const sp = specFor(initTarget);
    const t = row.id ? templateDoc(row as TemplateRow, mmToPx(sp.w), mmToPx(sp.h)) : null;
    return { ...emptyDoc(), ...(t ? { bg: t.bg, bgImage: t.bgImage, els: t.els } : {}) };
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [areaRef, area] = useSize<HTMLDivElement>();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const handle = useRef<CdDesignerHandle | null>(null);
  const spec = specFor(target);

  const zones = useMemo<Zone[] | undefined>(() => target === "back_outer" ? [
    { id: "gl", label: "", x: 0, w: GAY, dir: dirOf(LEFT_SPINE_ROTATION), side: null },
    { id: "gr", label: "", x: BW - GAY, w: GAY, dir: dirOf(RIGHT_SPINE_ROTATION), side: null },
  ] : target === "back_inner" ? [
    { id: "gl", label: "", x: 0, w: GAY, dir: dirOf(LEFT_SPINE_ROTATION), side: null },
    { id: "gr", label: "", x: BW - GAY, w: GAY, dir: dirOf(RIGHT_SPINE_ROTATION), side: null },
    { id: "sp", label: "", x: IN_FROM, w: IN_TO - IN_FROM, dir: dirOf(INNER_SPINE_ROTATION), side: null },
  ] : undefined, [target]);
  const pages = useMemo(() => [{ doc, tpl: null }], [doc]);

  async function save() {
    if (!name.trim()) return setErr("Cần đặt tên mẫu");
    setSaving(true); setErr("");
    try {
      // ảnh thumbnail tự tạo từ canvas
      let thumbnail_url: string | null = row.thumbnail_url ?? null;
      const shot = handle.current?.snapshot(320);
      if (shot) {
        const blob = await dataUrlToBlob(shot);
        thumbnail_url = await uploadPublicImage(new File([blob], "thumb.png", { type: "image/png" }), "templates/thumbs");
      }
      await onSave({ name: name.trim(), target, is_active: active, doc: { bg: doc.bg, bgImage: doc.bgImage, els: doc.els }, thumbnail_url });
    } catch (e) { setErr(e instanceof Error ? e.message : "Lưu thất bại"); }
    setSaving(false);
  }

  const Switch = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} className="inline-flex items-center gap-2 text-[13px] text-[#18181b]">
      <span className={`relative h-[18px] w-8 rounded-full transition ${on ? "bg-[#ff5fa2]" : "bg-[#d4d4d8]"}`}>
        <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all ${on ? "left-[16px]" : "left-[2px]"}`} />
      </span>
      {label}
    </button>
  );

  return (
    <div className="flex h-[calc(100dvh-56px)] flex-col bg-white font-sans text-[13px] text-[#18181b]">
      {/* thanh nhỏ phía trên workspace */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-[#e5e5e7] px-3">
        <button className="tool-btn shrink-0" onClick={onCancel}><Icon name="back" /> Danh sách mẫu</button>
        <input className="h-8 min-w-0 flex-1 rounded-[6px] border border-transparent bg-transparent px-2 text-[14px] font-semibold hover:border-[#e5e5e7] focus:border-[#ff5fa2] focus:outline-none focus:ring-[3px] focus:ring-[#ff5fa2]/15 sm:max-w-sm"
          placeholder="Tên mẫu" value={name} onChange={(e) => setName(e.target.value)} aria-label="Tên mẫu" />
        <div className="ml-auto flex items-center gap-3">
          {err && <p className="hidden text-[12px] text-[#dc2626] sm:block">{err}</p>}
          <button className="h-9 rounded-[8px] bg-[#ff5fa2] px-4 text-[14px] font-medium text-white hover:bg-[#f0468f] disabled:opacity-50" disabled={saving} onClick={save}>
            {saving ? "Đang lưu..." : "Lưu mẫu"}
          </button>
        </div>
      </div>
      {err && <p className="border-b border-[#e5e5e7] px-3 py-1.5 text-[12px] text-[#dc2626] sm:hidden">{err}</p>}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div ref={areaRef} className="relative h-[480px] min-w-0 bg-[#efeff1] lg:h-auto lg:flex-1">
          {area.w > 0 && (
            <div key={target} className="absolute inset-0">
              <CdDesigner ref={(h) => { handle.current = h; }} spec={spec} mode="template" pages={pages} viewport={{ w: area.w, h: area.h }}
                active onChange={(_i, d) => setDoc(d)} toolbarTarget={host} guides={guides} zones={zones}
                tray={target === "back_inner" && trayOn ? TRAY : undefined}
                uploadImage={(f) => uploadPublicImage(f, "templates", 15, true)}
                caption={`${TPL_TARGETS.find((t) => t.value === target)?.label.split(" (")[0]} · ${sizeText(spec)}`} />
            </div>
          )}
        </div>
        <aside className="flex flex-col divide-y divide-[#efeff1] border-[#e5e5e7] lg:w-[320px] lg:shrink-0 lg:overflow-y-auto lg:border-l">
          <section className="space-y-2.5 p-4">
            <p className="tool-label">Loại mẫu</p>
            <select className="tool-input w-full" value={target} onChange={(e) => setTarget(e.target.value as TplTarget)} aria-label="Loại mẫu">
              {TPL_TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <Switch on={active} onClick={() => setActive(!active)} label="Hiển thị cho khách" />
          </section>
          <section className="p-4">
            <div className="mb-3 flex flex-col gap-2">
              <Switch on={guides} onClick={() => setGuides(!guides)} label="Hiển thị guideline" />
              {target === "back_inner" && <Switch on={trayOn} onClick={() => setTrayOn(!trayOn)} label="Ướm khay đĩa" />}
            </div>
            <div ref={(el) => { if (el && host !== el) setHost(el); }} />
            <p className="mt-3 text-[11px] text-[#71717a]">Khung ảnh: vị trí để khách đặt ảnh (khách bấm vào khung để tải ảnh). Chữ của mẫu: khách sửa được nội dung, không di chuyển được.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
