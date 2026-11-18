"use client";

/* Admin → Xem mẫu Scrapbook: chọn số ảnh N → lưới 5 mẫu dựng bằng ảnh thử.
   "Đổi seed" ra bố cục khác (lưu vào database) · công tắc ẩn / hiện mẫu với khách. */
import "@fontsource/dancing-script/700.css";
import "@fontsource/patrick-hand/400.css";
import "@fontsource/pangolin/400.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Dices, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { revalidatePublic } from "@/app/admin/actions";
import { loadAssetImages } from "@/lib/scrapbook/assets";
import { generate } from "@/lib/scrapbook/generate";
import { loadFonts, renderDisc } from "@/lib/scrapbook/render";
import { settingOf } from "@/lib/scrapbook/templates";
import { samplePhotos } from "@/lib/scrapbook/samples";
import { MAX_PHOTOS, MIN_PHOTOS, STYLES, type ScrapAsset, type Style, type TemplateSetting } from "@/lib/scrapbook/types";
import { Badge, Button, Card, Message, Toggle } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

type Msg = { type: "ok" | "err"; text: string } | null;

export function TemplatePreview() {
  const [n, setN] = useState(MIN_PHOTOS);
  const [settings, setSettings] = useState<TemplateSetting[]>([]);
  const [assets, setAssets] = useState<ScrapAsset[]>([]);
  const [imgs, setImgs] = useState<Awaited<ReturnType<typeof loadAssetImages>>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Msg>(null);
  const [ready, setReady] = useState(false);
  const photos = useMemo(() => (typeof document === "undefined" ? [] : samplePhotos()), []);

  const load = useCallback(async () => {
    const sb = createClient();
    const [t, a] = await Promise.all([sb.from("scrapbook_template_settings").select("*"), sb.from("scrapbook_assets").select("*").eq("is_active", true)]);
    if (t.error) setMsg({ type: "err", text: "Chưa có bảng mẫu — cần chạy supabase/migration_scrapbook.sql." });
    setSettings((t.data ?? []) as TemplateSetting[]);
    const list = (a.data ?? []) as ScrapAsset[];
    setAssets(list);
    await loadFonts();
    setImgs(await loadAssetImages(list));
    setReady(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => STYLES.map((s) => settingOf(settings, n, s.id)), [settings, n]);
  useEffect(() => {
    if (!ready) return;
    const out: Record<string, string> = {};
    for (const s of rows) {
      const t = s.template ? { ...s.template, n, style: s.style } : generate(n, s.style, s.seed, assets);
      out[s.style] = renderDisc({ template: t, photos, text: { main: "Happy Birthday", sub: "Taylana · 2026" }, assets: imgs, size: 420, guides: true }).canvas.toDataURL("image/png");
    }
    setThumbs(out);
  }, [ready, rows, n, assets, imgs, photos]);

  async function save(style: Style, v: Partial<TemplateSetting>, text: string) {
    const cur = settingOf(settings, n, style);
    const row = { n, style, seed: v.seed ?? cur.seed, is_active: v.is_active ?? cur.is_active, template: cur.template ?? null, updated_at: new Date().toISOString() };
    const { error } = await createClient().from("scrapbook_template_settings").upsert(row);
    if (error) return setMsg({ type: "err", text: error.message });
    setSettings((list) => [...list.filter((x) => !(x.n === n && x.style === style)), row]);
    setMsg({ type: "ok", text });
    await revalidatePublic(["/thiet-ke/scrapbook"]);
  }

  return (
    <div className="space-y-6">
      <Card title="Số ảnh">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: MAX_PHOTOS - MIN_PHOTOS + 1 }, (_, i) => MIN_PHOTOS + i).map((k) => (
            <button key={k} type="button" onClick={() => setN(k)}
              className={cx("h-9 rounded-full border px-4 text-[14px] font-medium", n === k ? "border-[#ff5fa2] bg-[#fff0f6] text-[#ff5fa2]" : "border-[#e5e5e7] bg-white text-[#52525b] hover:border-[#a1a1aa]")}>{k} ảnh</button>
          ))}
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{/* nhãn "Đã chỉnh" = mẫu admin sửa tay, đè lên mẫu tạo bằng code */}
        {rows.map((s) => (
          <Card key={s.style} title={STYLES.find((x) => x.id === s.style)?.name} actions={<div className="flex gap-1">{s.template && <Badge tone="pink">Đã chỉnh</Badge>}{s.is_active ? <Badge tone="green">Đang hiện</Badge> : <Badge>Đang ẩn</Badge>}</div>}>
            <div className={cx("mx-auto aspect-square w-full max-w-[300px]", !s.is_active && "opacity-40")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {thumbs[s.style] ? <img src={thumbs[s.style]} alt="" className="h-full w-full" /> : <div className="h-full w-full animate-pulse rounded-full bg-[#f4f4f5]" />}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[12px] tabular-nums text-[#71717a]">Seed {s.seed}</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" href={`/admin/scrapbook/mau/sua?n=${n}&style=${s.style}`} icon={<Pencil size={14} />}>Sửa mẫu</Button>
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
