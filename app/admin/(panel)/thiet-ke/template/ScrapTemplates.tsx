"use client";

/* Quản lý template → CD Scrapbook / Booklet Scrapbook: lưới mẫu = mẫu tự sinh bằng code (5 phong cách × số ảnh / số trang)
   + mẫu admin tạo mới / nhân bản (bảng scrapbook_templates, không giới hạn). Ảnh thu nhỏ dựng bằng ảnh thử.
   Mỗi thẻ: Sửa · Đổi tên · Nhân bản · Bật/Tắt · Xoá (chỉ mẫu tạo mới) · kéo thả đổi thứ tự (trong cùng số ảnh / số trang).
   Nút bánh răng "Cài đặt rải sticker" (CD: site_settings "scrap_stickers" · Booklet: "scrap_stickers_booklet"). */
import "@fontsource/dancing-script/700.css";
import "@fontsource/patrick-hand/400.css";
import "@fontsource/pangolin/400.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eye, EyeOff, GripVertical, Pencil, Plus, Settings, Trash2, Type, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { revalidatePublic } from "@/app/admin/actions";
import { loadAssetImages } from "@/lib/scrapbook/assets";
import { loadFrameImages } from "@/lib/scrapbook/frames";
import { templatesFor } from "@/lib/scrapbook/templates";
import { BOOKLET_PAGES, generateBooklet } from "@/lib/scrapbook/booklet";
import { generate, resolveFrameSets } from "@/lib/scrapbook/generate";
import { bookletOverride, catalog, photoCountOf, type CatalogItem } from "@/lib/scrapbook/catalog";
import { mergeStickerCfg, setFrameLibrary, setStickerConfig, type StickerCfg } from "@/lib/scrapbook/decor";
import { loadFonts, renderSurface, type LoadedFrame } from "@/lib/scrapbook/render";
import { samplePhotos } from "@/lib/scrapbook/samples";
import { MAX_PHOTOS, MIN_PHOTOS, STYLES, type CustomTemplate, type Frame, type FrameSet, type ScrapAsset, type Style, type Template, type TemplateSetting } from "@/lib/scrapbook/types";
import { loadImg } from "@/lib/mockup/images";
import { confirmDialog, promptDialog } from "@/components/ui/dialog";
import { Badge, Button, toast } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";
import { StickerSettings } from "../../scrapbook/mau/StickerSettings";
import { TemplatePreview } from "../../scrapbook/mau/TemplatePreview";

type Surface = "disc" | "booklet";
const EDITOR = "/admin/thiet-ke/template/sua";
const PATHS = ["/thiet-ke/scrapbook", "/thiet-ke/booklet-scrapbook"];
const now = () => new Date().toISOString();
const MIGRATE = "Thiếu bảng / cột — cần chạy supabase/migration_staff_templates.sql.";
const errText = (m: string) => (/scrapbook_templates|name|sort_order|surface_check|schema cache/.test(m) ? MIGRATE : m);

export function ScrapTemplates({ surface }: { surface: Surface }) {
  const router = useRouter();
  const disc = surface === "disc";
  const ns = useMemo(() => (disc ? Array.from({ length: MAX_PHOTOS - MIN_PHOTOS + 1 }, (_, i) => MIN_PHOTOS + i) : [...BOOKLET_PAGES]), [disc]);
  const [settings, setSettings] = useState<TemplateSetting[]>([]);
  const [customs, setCustoms] = useState<CustomTemplate[]>([]);
  const [assets, setAssets] = useState<ScrapAsset[]>([]);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [fsets, setFsets] = useState<FrameSet[]>([]);
  const [imgs, setImgs] = useState<Awaited<ReturnType<typeof loadAssetImages>>>({});
  const [frameImgs, setFrameImgs] = useState<Record<string, LoadedFrame>>({});
  const [bgImgs, setBgImgs] = useState<Record<string, HTMLImageElement>>({});
  const [cfg, setCfg] = useState<StickerCfg | null>(null);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<number | 0>(0);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [gear, setGear] = useState(false);
  const [creating, setCreating] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  const photos = useMemo(() => (typeof document === "undefined" ? [] : samplePhotos()), []);
  const cfgKey = disc ? "scrap_stickers" : "scrap_stickers_booklet";

  const load = useCallback(async () => {
    const sb = createClient();
    const [t, c, a, fs, fr, sc, sc0] = await Promise.all([
      sb.from("scrapbook_template_settings").select("*"),
      sb.from("scrapbook_templates").select("*").eq("surface", surface).order("sort_order").order("created_at"),
      sb.from("scrapbook_assets").select("*").eq("is_active", true).order("sort_order"),
      sb.from("frame_sets").select("*").eq("is_active", true).order("sort_order"),
      sb.from("frames").select("*").eq("is_active", true).order("sort_order"),
      sb.from("site_settings").select("value").eq("key", cfgKey).maybeSingle(),
      sb.from("site_settings").select("value").eq("key", "scrap_stickers").maybeSingle(),
    ]);
    if (c.error) toast(MIGRATE, "err");
    const conf = mergeStickerCfg(((sc.data?.value ?? sc0.data?.value) as Partial<StickerCfg>) ?? null);
    setStickerConfig(conf); setCfg(conf);
    const sets = (fs.data ?? []) as FrameSet[], fl = ((fr.data ?? []) as Frame[]).filter((x) => sets.some((s) => s.id === x.set_id));
    setFsets(sets); setFrameLibrary(sets); setFrames(fl);
    setSettings((t.data ?? []) as TemplateSetting[]);
    setCustoms((c.data ?? []) as CustomTemplate[]);
    const list = ((a.data ?? []) as ScrapAsset[]).filter((x) => x.grp !== "frame" || !fl.length);
    setAssets(list);
    await loadFonts();
    const [ai, fi] = await Promise.all([loadAssetImages(list), loadFrameImages(fl)]);
    setImgs(ai); setFrameImgs(fi); setReady(true);
  }, [surface, cfgKey]);
  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => catalog(surface, settings, customs), [surface, settings, customs]);
  const shown = useMemo(() => (filter ? items.filter((x) => x.n === filter) : items), [items, filter]);

  /** các bề mặt của 1 mẫu (để dựng ảnh thu nhỏ / nhân bản) */
  const surfacesOf = useCallback((it: CatalogItem): Template[] => {
    if (it.kind === "custom") return (it.custom!.config?.surfaces ?? []).map((t, i) => ({ ...t, layers: resolveFrameSets(t.layers, frames, i + 7) }));
    if (disc) return templatesFor(it.n, settings, assets, {}, true, frames).filter((t) => t.style === it.style);
    return bookletOverride(it.setting) ?? generateBooklet(it.n, it.style, it.setting!.seed, assets, frames, settings.filter((s) => s.surface_type === "spread")).surfaces;
  }, [disc, settings, assets, frames]);

  // ảnh nền admin tải lên (khoá = link ảnh)
  useEffect(() => {
    const urls = new Set(customs.flatMap((c) => (c.config?.surfaces ?? []).flatMap((t) => [t.bg?.image, t.bg2?.image])).concat(settings.flatMap((s) => [s.template?.bg?.image, s.template?.bg2?.image])).filter((u): u is string => !!u && /^https?:/.test(u)));
    urls.forEach((u) => { if (!bgImgs[u]) loadImg(u).then((im) => setBgImgs((m) => ({ ...m, [u]: im }))).catch(() => {}); });
  }, [customs, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  // ảnh thu nhỏ: dựng dần từng mẫu, nhớ theo nội dung (không dựng lại khi đổi bộ lọc / bật tắt)
  const cache = useRef(new Map<string, string>());
  const sigOf = useCallback((it: CatalogItem) => `${it.key}|${it.kind === "custom" ? it.custom!.created_at ?? "" : ""}|${JSON.stringify(it.kind === "custom" ? it.custom!.config : it.setting?.template ?? it.setting?.seed ?? "").length}|${Object.keys(bgImgs).length}`, [bgImgs]);
  useEffect(() => {
    if (!ready) return;
    let stop = false;
    const o = { photos, text: { main: "Happy Birthday", sub: "Ghi chú nhỏ" }, assets: imgs, frames: frameImgs, bgImages: bgImgs };
    (async () => {
      for (const it of shown) {
        if (stop) return;
        const sig = sigOf(it);
        if (cache.current.has(sig)) { setThumbs((m) => (m[it.key] === cache.current.get(sig) ? m : { ...m, [it.key]: cache.current.get(sig)! })); continue; }
        let url = "";
        try {
          const ss = surfacesOf(it);
          if (ss.length && disc) url = renderSurface({ template: ss[0], ...o, size: 260 }).canvas.toDataURL("image/jpeg", 0.85);
          else if (ss.length) {
            const c = document.createElement("canvas"); c.width = 540; c.height = 180;
            const x = c.getContext("2d")!; x.fillStyle = "#f4f4f5"; x.fillRect(0, 0, 540, 180);
            x.drawImage(renderSurface({ template: ss[0], ...o, size: 174 }).canvas, 0, 3);
            if (ss[1]) x.drawImage(renderSurface({ template: ss[1], ...o, size: 354 }).canvas, 184, 3);
            url = c.toDataURL("image/jpeg", 0.85);
          }
        } catch { url = ""; } // 1 mẫu lỗi không chặn các mẫu sau
        cache.current.set(sig, url);
        setThumbs((m) => ({ ...m, [it.key]: url }));
        await new Promise((res) => setTimeout(res, 0));
      }
    })();
    return () => { stop = true; };
  }, [ready, shown, surfacesOf, sigOf, disc, photos, imgs, frameImgs, bgImgs]);

  // ---------- lưu ----------
  async function saveSetting(it: CatalogItem, v: Partial<TemplateSetting>) {
    const s = it.setting!;
    const row = { surface_type: disc ? "disc" : "booklet", n: it.n, style: it.style, seed: s.seed, is_active: s.is_active, template: s.template ?? null, name: s.name ?? null, sort_order: s.sort_order ?? null, ...v, updated_at: now() };
    const { error } = await createClient().from("scrapbook_template_settings").upsert(row, { onConflict: "surface_type,n,style" });
    if (error) { toast(errText(error.message), "err"); return false; }
    setSettings((l) => [...l.filter((x) => !(x.n === it.n && x.style === it.style && (x.surface_type ?? "disc") === row.surface_type)), row as TemplateSetting]);
    return true;
  }
  async function saveCustom(id: string, v: Partial<CustomTemplate>) {
    const { error } = await createClient().from("scrapbook_templates").update({ ...v, updated_at: now() }).eq("id", id);
    if (error) { toast(errText(error.message), "err"); return false; }
    setCustoms((l) => l.map((c) => (c.id === id ? { ...c, ...v } : c)));
    return true;
  }
  const done = async (text: string) => { toast(text); await revalidatePublic(PATHS); };
  const update = (it: CatalogItem, v: { name?: string | null; is_active?: boolean; sort_order?: number }) =>
    it.kind === "custom" ? saveCustom(it.custom!.id, v as Partial<CustomTemplate>) : saveSetting(it, v);
  const nextSort = (n: number) => Math.max(0, ...items.filter((x) => x.n === n).map((x) => x.sort)) + 1;

  async function insert(name: string, n: number, style: Style | null, surfaces: Template[]) {
    const { data, error } = await createClient().from("scrapbook_templates")
      .insert({ name, surface, n, style, config: { surfaces: structuredClone(surfaces) }, is_active: true, sort_order: nextSort(n) }).select("*").single();
    if (error || !data) { toast(errText(error?.message ?? "Không tạo được mẫu"), "err"); return null; }
    setCustoms((l) => [...l, data as CustomTemplate]);
    return data as CustomTemplate;
  }

  async function edit(it: CatalogItem) {
    if (it.kind === "custom") return router.push(`${EDITOR}?id=${it.custom!.id}`);
    router.push(`${EDITOR}?n=${it.n}&style=${it.style}${disc ? "" : "&surface=booklet"}`); // sửa trực tiếp mẫu tự sinh
  }
  async function rename(it: CatalogItem) {
    const v = await promptDialog({ title: "Đổi tên mẫu", label: "Tên mẫu", defaultValue: it.name });
    if (v == null || !v.trim() || v.trim() === it.name) return;
    if (await update(it, { name: v.trim() })) await done("Đã đổi tên");
  }
  async function duplicate(it: CatalogItem) {
    const c = await insert(`${it.name} (bản sao)`, it.n, it.style, surfacesOf(it));
    if (c) await done("Đã nhân bản — mẫu mới nằm cuối nhóm");
  }
  async function toggle(it: CatalogItem) {
    if (await update(it, { is_active: !it.active })) await done(it.active ? "Đã tắt mẫu" : "Đã bật mẫu");
  }
  async function remove(it: CatalogItem) {
    if (!(await confirmDialog({ title: `Xoá mẫu “${it.name}”?`, message: "Không khôi phục được.", confirmText: "Xoá", danger: true }))) return;
    const { error } = await createClient().from("scrapbook_templates").delete().eq("id", it.custom!.id);
    if (error) return toast(errText(error.message), "err");
    setCustoms((l) => l.filter((c) => c.id !== it.custom!.id));
    await done("Đã xoá mẫu");
  }
  async function drop(target: CatalogItem) {
    const from = items.find((x) => x.key === drag);
    setDrag(null);
    if (!from || from.key === target.key) return;
    if (from.n !== target.n) return toast(disc ? "Chỉ đổi thứ tự trong cùng số ảnh" : "Chỉ đổi thứ tự trong cùng số trang", "err");
    const group = items.filter((x) => x.n === from.n && x.key !== from.key);
    group.splice(group.findIndex((x) => x.key === target.key) + (from.sort < target.sort ? 1 : 0), 0, from);
    for (const [i, it] of group.entries()) if (it.sort !== i + 1 && !(await update(it, { sort_order: i + 1 }))) return;
    await done("Đã đổi thứ tự");
  }

  const chip = (on: boolean) => cx("h-9 rounded-full border px-4 text-[14px] font-medium", on ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] bg-white text-[#52525b] hover:border-[#a1a1aa]");
  const icon = "grid h-7 w-7 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#18181b]";
  const unit = disc ? "ảnh" : "trang";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setFilter(0)} className={chip(!filter)}>Tất cả</button>
          {ns.map((k) => <button key={k} type="button" onClick={() => setFilter(k)} className={chip(filter === k)}>{k} {unit}</button>)}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Settings size={16} />} onClick={() => setGear(true)} disabled={!cfg}>Cài đặt rải sticker</Button>
          <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>Tạo mẫu mới</Button>
        </div>
      </div>
      <p className="text-[12px] text-[#71717a]">Kéo thả thẻ để đổi thứ tự khách thấy (trong cùng {disc ? "số ảnh" : "số trang"}). Mẫu tắt không hiện với khách.</p>

      <ul className={cx("grid gap-4", disc ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3")}>
        {shown.map((it) => {
          const count = it.kind === "custom" ? photoCountOf(it.custom!.config?.surfaces ?? []) : disc ? it.n : null;
          return (
            <li key={it.key} draggable onDragStart={() => setDrag(it.key)} onDragEnd={() => setDrag(null)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(it)}
              className={cx("group flex flex-col overflow-hidden rounded-[12px] border bg-white transition-shadow hover:shadow-[0_4px_16px_rgb(0_0_0/0.06)]", drag === it.key ? "border-[#ff5fa2] opacity-50" : "border-[#e5e5e7]")}>
              <button type="button" onClick={() => edit(it)} className={cx("relative grid place-items-center bg-[#f4f4f5] p-3", disc ? "aspect-square" : "aspect-[3/1]")} aria-label={`Sửa ${it.name}`}>
                <GripVertical size={16} className="absolute left-1.5 top-1.5 cursor-grab text-[#a1a1aa]" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {thumbs[it.key] ? <img src={thumbs[it.key]} alt="" draggable={false} className={cx("max-h-full max-w-full", !it.active && "opacity-40")} />
                  : thumbs[it.key] === "" ? <span className="text-[12px] text-[#a1a1aa]">Trống</span>
                  : <div className={cx("animate-pulse bg-[#e4e4e7]", disc ? "aspect-square w-full rounded-full" : "h-full w-full rounded-[6px]")} />}
              </button>
              <div className="flex flex-1 flex-col border-t border-[#efeff1] p-3">
                <p className="truncate text-[14px] font-medium text-[#18181b]" title={it.name}>{it.name}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Badge>{disc ? `${it.n} ảnh` : `${it.n} trang${count != null ? ` · ${count} ảnh` : ""}`}</Badge>
                  {it.kind === "custom" && <Badge tone="pink">Tự tạo</Badge>}
                  {it.edited && <Badge tone="pink">Đã chỉnh</Badge>}
                  {it.active ? <Badge tone="green">Bật</Badge> : <Badge>Tắt</Badge>}
                </div>
                <div className="mt-auto flex items-center justify-end gap-0.5 pt-2">
                  <button type="button" className={icon} title="Sửa" onClick={() => edit(it)}><Pencil size={15} /></button>
                  <button type="button" className={icon} title="Đổi tên" onClick={() => rename(it)}><Type size={15} /></button>
                  <button type="button" className={icon} title="Nhân bản" onClick={() => duplicate(it)}><Copy size={15} /></button>
                  <button type="button" className={icon} title={it.active ? "Tắt" : "Bật"} onClick={() => toggle(it)}>{it.active ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                  {it.kind === "custom"
                    ? <button type="button" className="grid h-7 w-7 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#fef2f2] hover:text-[#dc2626]" title="Xoá" onClick={() => remove(it)}><Trash2 size={15} /></button>
                    : <span className="grid h-7 w-7 place-items-center text-[#d4d4d8]" title="Mẫu tự sinh không xoá được — hãy tắt"><Trash2 size={15} /></span>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {!disc && (
        <details className="rounded-[12px] border border-[#e5e5e7] bg-white p-4">
          <summary className="cursor-pointer text-[14px] font-semibold">Kiểu cặp trang của bộ mẫu tự sinh (nâng cao)</summary>
          <div className="mt-4"><TemplatePreview only="spread" /></div>
        </details>
      )}

      {gear && cfg && (
        <Modal onClose={() => setGear(false)} wide>
          <StickerSettings value={cfg} sets={fsets} storeKey={cfgKey} title={`Cài đặt rải sticker · ${disc ? "CD Scrapbook" : "Booklet Scrapbook"}`} onSaved={(v) => { setCfg(v); setGear(false); setReady((r) => r); setThumbs({}); load(); }} />
        </Modal>
      )}
      {creating && <CreateModal disc={disc} ns={ns} onClose={() => setCreating(false)} onCreate={async (name, n, style) => {
       try {
        let ss: Template[];
        if (disc) {
          const t = generate(n, style ?? "polaroid", Math.floor(Math.random() * 1e6), assets, frames);
          ss = [style ? t : { ...t, layers: [], accents: [], bg: { color: "#ffffff", pattern: "plain", ink: "#3f3f46" } }];
        } else {
          const b = generateBooklet(n, style ?? "polaroid", Math.floor(Math.random() * 1e6), assets, frames, settings.filter((s) => s.surface_type === "spread")).surfaces;
          ss = style ? b : b.map((t) => ({ ...t, layers: [], accents: [], bg: { color: "#ffffff", pattern: "plain", ink: "#3f3f46" }, bg2: undefined }));
        }
        const c = await insert(name, n, style, ss);
        if (!c) return;
        toast("Đã tạo mẫu — đang mở trình sửa…");
        router.push(`${EDITOR}?id=${c.id}`);
        revalidatePublic(PATHS).catch(() => undefined);
       } catch (e) { toast(e instanceof Error ? e.message : "Không tạo được mẫu", "err"); }
      }} />}
    </div>
  );
}

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={cx("relative w-full rounded-[14px] bg-white shadow-xl", wide ? "max-w-[960px]" : "max-w-[440px]")}>
        <button type="button" onClick={onClose} className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-[6px] text-[#71717a] hover:bg-[#f4f4f5]" aria-label="Đóng"><X size={16} /></button>
        {children}
      </div>
    </div>
  );
}

function CreateModal({ disc, ns, onClose, onCreate }: { disc: boolean; ns: number[]; onClose: () => void; onCreate: (name: string, n: number, style: Style | null) => Promise<void> }) {
  const [n, setN] = useState(ns[disc ? 2 : 1] ?? ns[0]);
  const [style, setStyle] = useState<Style | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const chip = (on: boolean) => cx("h-8 rounded-full border px-3 text-[13px] font-medium", on ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] text-[#52525b] hover:border-[#a1a1aa]");
  return (
    <Modal onClose={onClose}>
      <form className="space-y-4 p-5" onSubmit={async (e) => { e.preventDefault(); setBusy(true); await onCreate(name.trim() || "Mẫu mới", n, style); setBusy(false); }}>
        <h2 className="text-[17px] font-semibold">Tạo mẫu mới · {disc ? "CD Scrapbook" : "Booklet Scrapbook"}</h2>
        <div>
          <p className="mb-1.5 text-[13px] font-medium">{disc ? "Số ảnh" : "Số trang"}</p>
          <div className="flex flex-wrap gap-1.5">{ns.map((k) => <button key={k} type="button" onClick={() => setN(k)} className={chip(n === k)}>{k} {disc ? "ảnh" : "trang"}</button>)}</div>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-medium">Bắt đầu từ</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setStyle(null)} className={chip(style === null)}>Trang trống</button>
            {STYLES.map((s) => <button key={s.id} type="button" onClick={() => setStyle(s.id)} className={chip(style === s.id)}>{s.name}</button>)}
          </div>
          <p className="mt-1 text-[12px] text-[#71717a]">{style ? "Bố cục ngẫu nhiên theo phong cách này — chỉnh tiếp trong trình sửa." : `Bề mặt trắng, chưa có lớp nào — thêm ${disc ? "khung ảnh" : "khung ảnh, chữ"} trong trình sửa.`}</p>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">Tên mẫu</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mẫu mới" className="h-10 w-full rounded-[8px] border border-[#e5e5e7] px-3 text-[14px] outline-none focus:border-[#ff5fa2]" autoFocus />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Huỷ</Button>
          <Button type="submit" loading={busy}>Tạo và mở trình sửa</Button>
        </div>
      </form>
    </Modal>
  );
}
