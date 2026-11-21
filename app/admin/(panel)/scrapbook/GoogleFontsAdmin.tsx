"use client";
/* Quản lý chất liệu → Font chữ → "Font Google": các font có tiếng Việt (lib/fonts/catalog.ts) + font admin thêm theo tên.
   Bật / tắt từng font, kéo thả sắp xếp (thứ tự hiện trong bộ chọn font của khách). Lưu site_settings.google_fonts = { order, off, extra }.
   Phía khách chỉ hiện font đang bật. "Thêm font Google theo tên": kiểm tra font có tồn tại + có tiếng Việt trước khi thêm. */
import { useEffect, useRef, useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FONT_CATALOG, FONT_GROUPS, type FontGroup, type GFont } from "@/lib/fonts/catalog";
import { applyFontSettings, loadPreview, previewFamily, probeGoogleFont, type FontSettings } from "@/lib/fonts/load";
import { Badge, Button, Card, Select, toast } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

function Name({ f }: { f: string }) {
  const [ok, setOk] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); loadPreview(f).then(() => setOk(true)); } });
    io.observe(el); return () => io.disconnect();
  }, [f]);
  return <span ref={ref} className="truncate text-[16px]" style={{ fontFamily: ok ? previewFamily(f) : undefined }}>{f}</span>;
}

export function GoogleFontsAdmin() {
  const [list, setList] = useState<GFont[]>(FONT_CATALOG);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState<GFont[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(""), [grp, setGrp] = useState<FontGroup>("sans");
  const [drag, setDrag] = useState<number | null>(null);
  useEffect(() => {
    createClient().from("site_settings").select("value").eq("key", "google_fonts").maybeSingle().then(({ data }) => {
      const v = (data?.value ?? null) as FontSettings | null;
      const r = applyFontSettings(v), offs = new Set(v?.off ?? []);
      const order = v?.order ?? [], rank = (f: GFont) => { const i = order.indexOf(f.family); return i < 0 ? 1000 + r.all.indexOf(f) : i; };
      setList([...r.all].sort((a, b) => rank(a) - rank(b))); setOff(offs); setExtra((v?.extra ?? []).filter((f) => !FONT_CATALOG.some((c) => c.family === f.family)));
    });
  }, []);
  const touch = () => setDirty(true);
  async function add() {
    if (list.some((f) => f.family.toLowerCase() === name.trim().toLowerCase())) return toast("Font này đã có trong danh sách", "err");
    setBusy(true);
    const r = await probeGoogleFont(name);
    setBusy(false);
    if ("error" in r) return toast(r.error, "err");
    const f = { ...r, group: grp };
    setList((l) => [f, ...l]); setExtra((e) => [...e, f]); setName(""); touch();
    toast(`Đã thêm “${f.family}” — nhớ bấm Lưu`);
  }
  async function save() {
    setBusy(true);
    const value: FontSettings = { order: list.map((f) => f.family), off: [...off], extra };
    const { error } = await createClient().from("site_settings").upsert({ key: "google_fonts", value, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return toast(error.message, "err");
    setDirty(false); toast("Đã lưu danh sách font");
  }
  const on = list.length - list.filter((f) => off.has(f.family)).length;
  return (
    <Card title={`Font Google (${on} / ${list.length} đang bật)`} description="Chỉ gồm font có tiếng Việt. Khách chỉ thấy font đang bật, theo thứ tự dưới đây (kéo thả để sắp xếp). Font chỉ được tải khi khách dùng."
      actions={<Button size="sm" onClick={save} loading={busy} disabled={!dirty}>Lưu</Button>}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Thêm font Google theo tên (vd. Alexandria)"
          className="h-9 min-w-0 flex-1 rounded-[8px] border border-[#e5e5e7] px-3 text-[14px] outline-none focus:border-[#ff5fa2]" />
        <Select value={grp} onChange={(e) => setGrp(e.target.value as FontGroup)} className="h-9 w-[140px]">{FONT_GROUPS.map(([g, n]) => <option key={g} value={g}>{n}</option>)}</Select>
        <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={add} loading={busy} disabled={!name.trim()}>Kiểm tra và thêm</Button>
      </div>
      <ul className="max-h-[520px] divide-y divide-[#efeff1] overflow-y-auto rounded-[10px] border border-[#e5e5e7]">
        {list.map((f, i) => {
          const isOff = off.has(f.family), isExtra = extra.some((e) => e.family === f.family);
          return (
            <li key={f.family} draggable onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(null)} onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (drag === null || drag === i) return; setList((l) => { const a = [...l]; const [x] = a.splice(drag, 1); a.splice(i, 0, x); return a; }); setDrag(null); touch(); }}
              className={cx("flex items-center gap-2 bg-white px-2 py-1.5", drag === i && "opacity-40", isOff && "bg-[#fafafa]")}>
              <GripVertical size={15} className="shrink-0 cursor-grab text-[#a1a1aa]" />
              <input type="checkbox" checked={!isOff} onChange={(e) => { setOff((o) => { const n = new Set(o); if (e.target.checked) n.delete(f.family); else n.add(f.family); return n; }); touch(); }} aria-label={`Bật ${f.family}`} className="accent-[#ff5fa2]" />
              <span className={cx("min-w-0 flex-1", isOff && "opacity-50")}><Name f={f.family} /></span>
              <span className="hidden text-[11px] text-[#a1a1aa] sm:inline">{FONT_GROUPS.find(([g]) => g === f.group)?.[1]} · {f.weights.join(", ")}{f.italic ? " · nghiêng" : ""}</span>
              {isExtra && <Badge>Tự thêm</Badge>}
              {isExtra && <button type="button" onClick={() => { setList((l) => l.filter((x) => x.family !== f.family)); setExtra((e) => e.filter((x) => x.family !== f.family)); touch(); }} className="grid h-7 w-7 place-items-center rounded-[6px] text-[#a1a1aa] hover:text-[#dc2626]" aria-label="Xoá font"><Trash2 size={14} /></button>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
