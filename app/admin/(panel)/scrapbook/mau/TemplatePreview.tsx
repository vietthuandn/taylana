"use client";

/* Admin → Xem mẫu Scrapbook: lọc theo loại — CD Scrapbook (chọn số ảnh N → 5 mẫu mặt đĩa) · Booklet Scrapbook
   (chọn kiểu dàn trang cặp → 5 mẫu cặp trang 24 × 12 cm). Lưới dựng bằng ảnh thử.
   "Đổi seed" ra bố cục khác (lưu vào database) · công tắc ẩn / hiện mẫu với khách · "Sửa mẫu" mở trình sửa mẫu. */
import "@fontsource/dancing-script/700.css";
import "@fontsource/patrick-hand/400.css";
import "@fontsource/pangolin/400.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Dices, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { revalidatePublic } from "@/app/admin/actions";
import { loadAssetImages } from "@/lib/scrapbook/assets";
import { generate } from "@/lib/scrapbook/generate";
import { SPREAD_KINDS, generateSpread } from "@/lib/scrapbook/booklet";
import { mergeStickerCfg, setFrameLibrary, setStickerConfig, type StickerCfg } from "@/lib/scrapbook/decor";
import type { FrameSet } from "@/lib/scrapbook/types";
import { StickerSettings } from "./StickerSettings";
import { loadFonts, renderDisc } from "@/lib/scrapbook/render";
import { settingOf } from "@/lib/scrapbook/templates";
import { samplePhotos } from "@/lib/scrapbook/samples";
import { MAX_PHOTOS, MIN_PHOTOS, STYLES, type ScrapAsset, type Style, type TemplateSetting } from "@/lib/scrapbook/types";
import { Badge, Button, Card, Message, Toggle } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

type Msg = { type: "ok" | "err"; text: string } | null;

type Kind = "disc" | "spread";
const settingFor = (list: TemplateSetting[], kind: Kind, n: number, style: Style): TemplateSetting =>
  kind === "disc" ? settingOf(list, n, style) : list.find((s) => s.surface_type === "spread" && s.n === n && s.style === style) ?? { n, style, seed: n * 1000 + STYLES.findIndex((x) => x.id === style) + 1, is_active: true, surface_type: "spread" };

/** only="spread": chỉ các kiểu cặp trang Booklet (dùng trong tab Booklet Scrapbook của Quản lý template) */
export function TemplatePreview({ only }: { only?: "spread" } = {}) {
  const [kind, setKind] = useState<Kind>(only ? "spread" : "disc");
  const [n, setN] = useState(only ? 1 : MIN_PHOTOS);
  const [settings, setSettings] = useState<TemplateSetting[]>([]);
  const [assets, setAssets] = useState<ScrapAsset[]>([]);
  const [imgs, setImgs] = useState<Awaited<ReturnType<typeof loadAssetImages>>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Msg>(null);
  const [ready, setReady] = useState(false);
  const [cfg, setCfg] = useState<StickerCfg | null>(null);
  const [fsets, setFsets] = useState<FrameSet[]>([]);
  const photos = useMemo(() => (typeof document === "undefined" ? [] : samplePhotos()), []);

  const load = useCallback(async () => {
    const sb = createClient();
    const [t, a, sc] = await Promise.all([sb.from("scrapbook_template_settings").select("*"), sb.from("scrapbook_assets").select("*").eq("is_active", true), sb.from("site_settings").select("value").eq("key", only ? "scrap_stickers_booklet" : "scrap_stickers").maybeSingle()]);
    const c = mergeStickerCfg((sc.data?.value as Partial<StickerCfg>) ?? null);
    setStickerConfig(c); setCfg(c);
    const fs = await sb.from("frame_sets").select("*").eq("is_active", true).order("sort_order");
    setFsets((fs.data ?? []) as FrameSet[]); setFrameLibrary((fs.data ?? []) as FrameSet[]);
    if (t.error) setMsg({ type: "err", text: "Chưa có bảng mẫu — cần chạy supabase/migration_scrapbook.sql." });
    setSettings((t.data ?? []) as TemplateSetting[]);
    const list = (a.data ?? []) as ScrapAsset[];
    setAssets(list);
    await loadFonts();
    setImgs(await loadAssetImages(list));
    setReady(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => STYLES.map((s) => settingFor(settings, kind, n, s.id)), [settings, kind, n]);
  useEffect(() => {
    if (!ready) return;
    const out: Record<string, string> = {};
    for (const s of rows) {
      const t = s.template ? { ...s.template, n, style: s.style } : kind === "disc" ? generate(n, s.style, s.seed, assets) : generateSpread(n, s.style, s.seed, assets);
      out[s.style] = renderDisc({ template: t, photos, text: { main: "Happy Birthday", sub: "Taylana · 2026" }, assets: imgs, size: kind === "disc" ? 420 : 640, guides: true }).canvas.toDataURL("image/png");
    }
    setThumbs(out);
  }, [ready, rows, kind, n, assets, imgs, photos, cfg]);

  async function save(style: Style, v: Partial<TemplateSetting>, text: string) {
    const cur = settingFor(settings, kind, n, style);
    const row = { surface_type: kind, n, style, seed: v.seed ?? cur.seed, is_active: v.is_active ?? cur.is_active, template: cur.template ?? null, updated_at: new Date().toISOString() };
    const { error } = await createClient().from("scrapbook_template_settings").upsert(row, { onConflict: "surface_type,n,style" });
    if (error) return setMsg({ type: "err", text: /surface_type/.test(error.message) ? "Thiếu cột surface_type — cần chạy supabase/migration_booklet_scrapbook.sql." : error.message });
    setSettings((list) => [...list.filter((x) => !(x.n === n && x.style === style && (x.surface_type ?? "disc") === kind)), row]);
    setMsg({ type: "ok", text });
    await revalidatePublic(["/thiet-ke/scrapbook", "/thiet-ke/booklet-scrapbook"]);
  }
  const chip = (on: boolean) => cx("h-9 rounded-full border px-4 text-[14px] font-medium", on ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] bg-white text-[#52525b] hover:border-[#a1a1aa]");

  return (
    <div className="space-y-6">
      {cfg && !only && <StickerSettings value={cfg} onSaved={setCfg} sets={fsets} />}
      <Card title={only ? "Kiểu cặp trang" : "Loại mẫu"} description={only ? "Bộ mẫu booklet tự sinh ghép ngẫu nhiên các kiểu cặp trang đang hiện. Sửa tay 1 kiểu = mọi bộ tự sinh dùng bản đã sửa." : undefined}>
        <div className={cx("mb-3 flex flex-wrap gap-2", only && "hidden")}>
          <button type="button" onClick={() => { setKind("disc"); setN(MIN_PHOTOS); }} className={chip(kind === "disc")}>CD Scrapbook</button>
          <button type="button" onClick={() => { setKind("spread"); setN(1); }} className={chip(kind === "spread")}>Booklet Scrapbook</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {kind === "disc"
            ? Array.from({ length: MAX_PHOTOS - MIN_PHOTOS + 1 }, (_, i) => MIN_PHOTOS + i).map((k) => <button key={k} type="button" onClick={() => setN(k)} className={chip(n === k)}>{k} ảnh</button>)
            : SPREAD_KINDS.map((k) => <button key={k.id} type="button" onClick={() => setN(k.id)} className={chip(n === k.id)}>{k.name}</button>)}
        </div>
        {kind === "spread" && <p className="mt-2 text-[12px] text-[#71717a]">Mỗi kiểu dàn trang cặp × phong cách là 1 mẫu cặp trang. Bộ mẫu booklet của khách ghép ngẫu nhiên các kiểu đang hiện.</p>}
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{/* nhãn "Đã chỉnh" = mẫu admin sửa tay, đè lên mẫu tạo bằng code */}
        {rows.map((s) => (
          <Card key={s.style} title={STYLES.find((x) => x.id === s.style)?.name} actions={<div className="flex gap-1">{s.template && <Badge tone="pink">Đã chỉnh</Badge>}{s.is_active ? <Badge tone="green">Đang hiện</Badge> : <Badge>Đang ẩn</Badge>}</div>}>
            <div className={cx("mx-auto w-full", kind === "disc" ? "aspect-square max-w-[300px]" : "aspect-[2/1]", !s.is_active && "opacity-40")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {thumbs[s.style] ? <img src={thumbs[s.style]} alt="" className="h-full w-full" /> : <div className={cx("h-full w-full animate-pulse bg-[#f4f4f5]", kind === "disc" ? "rounded-full" : "rounded-[6px]")} />}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[12px] tabular-nums text-[#71717a]">Seed {s.seed}</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" href={`/admin/thiet-ke/template/sua?n=${n}&style=${s.style}${kind === "spread" ? "&surface=spread" : ""}`} icon={<Pencil size={14} />}>Sửa mẫu</Button>
                <Button size="sm" variant="secondary" icon={<Dices size={14} />} disabled={!!s.template} title={s.template ? "Mẫu đã chỉnh tay — khôi phục mẫu gốc trong trình sửa để đổi seed" : undefined} onClick={() => save(s.style, { seed: Math.floor(Math.random() * 1e6) }, "Đã đổi seed.")}>Đổi seed</Button>
                <Toggle checked={s.is_active} onChange={(v) => save(s.style, { is_active: v }, v ? "Đã hiện mẫu với khách." : "Đã ẩn mẫu.")} label="" />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Message msg={msg} />
    </div>
  );
}
