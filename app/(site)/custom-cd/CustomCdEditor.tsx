"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Konva from "konva";
import { BACK_SPINE_MM, SPECS, mmToPx, sizeText, type PrintSpec } from "@/lib/print";
import { INNER_SPINE_FROM_CM, INNER_SPINE_ROTATION, INNER_SPINE_TO_CM, LEFT_SPINE_ROTATION, RIGHT_SPINE_ROTATION, TRAY_DISC_DIAMETER_CM, TRAY_DISC_HOLE_CM } from "@/lib/cdSpecs";
import type { DesignTemplate } from "@/lib/templates";
import type { Package } from "@/lib/types";
import { formatVND } from "@/lib/format";
import { renameDesign } from "@/lib/designs";
import { docHasArtwork, emptyDoc, mergeToSpread, splitFromSpread, templateDoc, type El, type PageDoc, type TemplateDoc } from "@/lib/cdDoc";
import { loadDesign, saveDesign, type DesignData } from "@/lib/designs";
import { createClient } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { CdDesigner, FONTS, PX_UNIT, SIZE_PRESETS, TEXT_COLORS, type CdDesignerHandle, type Half, type PageInput } from "@/components/cd-editor/CdDesigner";
import { ColorSelect } from "@/components/cd-editor/ColorSelect";
import { Icon } from "@/components/cd-editor/icons";
import { SpineEditor, dirOf, emptySide, sideHasContent, type SpineSide, type SpineText, type Zone } from "@/components/designer/Spine";
import { TemplateThumb } from "@/components/designer/TemplateThumb";
import { OrderDialog, downloadBlob, type DesignFile } from "@/components/designer/OrderDialog";
import { useSize } from "@/components/designer/useSize";
import { AuthDialog } from "@/components/site/AuthDialog";

type Part = "front" | "back" | "disc";
const PARTS: Part[] = ["front", "back", "disc"];
const PART_LABEL: Record<Part, string> = { front: "Bìa trước", back: "Bìa sau", disc: "Mặt đĩa" };
type PageDef = { id: string; part: Part; label: string; kind: string; page: number | null };
const FRONT_COUNTS = [1, 2, 4, 8, 12] as const;
const BACK_COUNTS = [1, 2] as const;
const DRAFT_KEY = "taylana-cd-draft-v1";
const PREFS_KEY = "taylana-cd-prefs"; // nhớ Hiển thị guideline & Trải đôi

// Danh sách trang. Dữ liệu lưu theo id trang → đổi số trang vẫn giữ thiết kế (trang dư tạm ẩn).
function pagesOf(frontN: number, backN: number): PageDef[] {
  const P = (n: number): PageDef => ({ id: n === 1 ? "F-out" : `P${n}`, part: "front", label: String(n), kind: "booklet", page: n });
  const front: PageDef[] =
    frontN === 1 ? [{ id: "F-out", part: "front", label: "Bìa Trước - Mặt Ngoài", kind: "front", page: 1 }]
    : frontN === 2 ? [{ id: "F-out", part: "front", label: "Bìa Trước - Mặt Ngoài", kind: "front", page: 1 }, { id: "P2", part: "front", label: "Bìa Trước - Mặt Trong", kind: "front", page: 2 }]
    : Array.from({ length: frontN }, (_, i) => P(i + 1));
  const back: PageDef[] = [
    { id: "B-out", part: "back", label: "Bìa Sau - Mặt Ngoài", kind: "back", page: 1 },
    ...(backN === 2 ? [{ id: "B-in", part: "back" as Part, label: "Bìa Sau - Mặt Trong", kind: "back", page: 2 }] : []),
  ];
  return [...front, ...back, { id: "D", part: "disc", label: "Mặt Đĩa", kind: "disc", page: null }];
}
// Trải đôi: 1 | 2–3 | 4–5 | 6–7 | 8 (4 trang: 1 | 2–3 | 4)
function groupsOf(frontN: number): string[][] {
  if (frontN < 4) return [];
  const out: string[][] = [["F-out"]];
  for (let i = 2; i + 1 < frontN; i += 2) out.push([`P${i}`, `P${i + 1}`]);
  out.push([`P${frontN}`]);
  return out;
}
// doc của cả cặp trải đôi: ["P2","P3"] → "S23"
const pairKey = (g: string[]) => `S${g[0].slice(1)}${g[1].slice(1)}`;
const FW1 = mmToPx(SPECS.front.w);
// Mô tả ngắn những gì có trong gói (không có giá)
const describePkg = (pk: Package) => [
  pk.front_pages ? (pk.front_pages >= 4 ? `Booklet ${pk.front_pages} trang` : `Bìa trước ${pk.front_pages} mặt`) : "",
  pk.back_pages ? `Bìa sau ${pk.back_pages} mặt` : "",
  pk.has_disc !== false ? "Mặt đĩa" : "",
].filter(Boolean).join(" · ");
// Danh sách trang theo gói
const pagesOfPkg = (pk: Package, curFront: number, curBack: number) =>
  pagesOf(pk.front_pages || curFront, pk.back_pages || curBack)
    .filter((p) => (p.part === "disc" ? pk.has_disc !== false : p.part === "front" ? (pk.front_pages ?? 0) > 0 : (pk.back_pages ?? 0) > 0));
// "Bìa Trước - 5, 6, 7, 8; Bìa Sau - Mặt Trong"
function listPages(ps: PageDef[]) {
  const out: string[] = [];
  const nums = ps.filter((p) => p.part === "front" && /^\d+$/.test(p.label)).map((p) => p.label);
  if (nums.length) out.push(`Bìa Trước - ${nums.join(", ")}`);
  ps.filter((p) => !(p.part === "front" && /^\d+$/.test(p.label))).forEach((p) => out.push(p.label));
  return out.join("; ");
}
const specOf = (id: string): PrintSpec => (id.startsWith("B") ? SPECS.back : id === "D" ? SPECS.disc : SPECS.front);
const targetsOf = (id: string) => (id === "B-out" ? ["back_outer", "back"] : id === "B-in" ? ["back_inner"] : id === "D" ? ["disc"] : ["front"]);

// Bìa sau: số đo (px bản in) từ lib/cdSpecs.ts
const BW = mmToPx(SPECS.back.w), BH = mmToPx(SPECS.back.h), GAY = mmToPx(BACK_SPINE_MM);
const IN_FROM = mmToPx(INNER_SPINE_FROM_CM * 10), IN_TO = mmToPx(INNER_SPINE_TO_CM * 10);
const TRAY = { cx: (IN_TO + (BW - GAY)) / 2, cy: BH / 2, r: mmToPx(TRAY_DISC_DIAMETER_CM * 5), hole: mmToPx(TRAY_DISC_HOLE_CM * 5) };
type ZoneId = "b1-left" | "b1-right" | "b2-spine";
const ZONE: Record<ZoneId, { page: string; title: string; x: number; w: number; dir: "cw" | "ccw"; cm: number }> = {
  "b1-left": { page: "B-out", title: "gáy trái", x: 0, w: GAY, dir: dirOf(LEFT_SPINE_ROTATION), cm: BACK_SPINE_MM / 10 },
  "b1-right": { page: "B-out", title: "gáy phải", x: BW - GAY, w: GAY, dir: dirOf(RIGHT_SPINE_ROTATION), cm: BACK_SPINE_MM / 10 },
  "b2-spine": { page: "B-in", title: "Spine", x: IN_FROM, w: IN_TO - IN_FROM, dir: dirOf(INNER_SPINE_ROTATION), cm: INNER_SPINE_TO_CM - INNER_SPINE_FROM_CM },
};
const emptyZones = (): Record<ZoneId, SpineSide> => ({ "b1-left": emptySide(), "b1-right": emptySide(), "b2-spine": emptySide() });

// Đo kích thước chữ (để tách trải đôi)
function measureText(e: El) {
  const t = new Konva.Text({ text: e.text, fontFamily: e.fontFamily, fontSize: e.fontSize, lineHeight: e.lineHeight ?? 1.2, width: e.width, wrap: e.width ? "word" : "none" });
  const r = { w: t.width(), h: t.height() };
  t.destroy();
  return r;
}

export function CustomCdEditor({ templates, packages }: { templates: (DesignTemplate & { doc?: TemplateDoc | null })[]; packages: Package[] }) {
  const params = useSearchParams();
  const [frontN, setFrontN] = useState(1);
  const [backN, setBackN] = useState(1);
  const [spreadView, setSpreadView] = useState(false);
  const [activeId, setActiveId] = useState("F-out");
  const [groupIdx, setGroupIdx] = useState(0);
  const [tplTarget, setTplTarget] = useState<0 | 1>(0);
  const [docs, setDocs] = useState<Record<string, PageDoc>>({});
  const [zoneData, setZoneData] = useState<Record<ZoneId, SpineSide>>(emptyZones);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [guides, setGuides] = useState(true);
  const [trayOn, setTrayOn] = useState(true);
  const [spineMode, setSpineMode] = useState<ZoneId | null>(null);
  const [spineBg, setSpineBg] = useState<HTMLCanvasElement | null>(null);
  const [spineSel, setSpineSel] = useState<string | null>(null);
  const [areaRef, area] = useSize<HTMLDivElement>();
  const handles = useRef<Record<string, CdDesignerHandle | null>>({});
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [pkgId, setPkgId] = useState<string>(""); // gói đang chọn — bắt buộc chọn trước khi thiết kế
  const [panelTab, setPanelTab] = useState<"pack" | Part>("front");
  const [pendingPkg, setPendingPkg] = useState<{ id: string; removed: string } | null>(null);
  const [dlOpen, setDlOpen] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [confirmSpread, setConfirmSpread] = useState(false);
  const [draftAsk, setDraftAsk] = useState<(DesignData & { designId?: string | null; designName?: string }) | null>(null);
  const [ready, setReady] = useState(false); // đã quyết định dùng nháp hay làm mới
  const [designId, setDesignId] = useState<string | null>(null);
  const [designName, setDesignName] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [nameAsk, setNameAsk] = useState<false | "save" | "rename">(false);

  // Preset của gói: tab nào hiện, mỗi tab bao nhiêu trang
  const pkg = packages.find((x) => x.id === pkgId);
  const preset = pkg ? { disc: pkg.has_disc !== false, front: pkg.front_pages ?? 0, back: pkg.back_pages ?? 0 } : null;
  const allPages = pagesOf(frontN, backN);
  const filtered = preset ? allPages.filter((p) => (p.part === "disc" ? preset.disc : p.part === "front" ? preset.front > 0 : preset.back > 0)) : allPages;
  const pages = filtered.length ? filtered : allPages;
  const visibleParts = PARTS.filter((pt) => pages.some((p) => p.part === pt));
  const booklet = frontN >= 4;
  const groups = groupsOf(frontN);
  const activePage = pages.find((p) => p.id === activeId) ?? pages[0];
  const part = activePage.part;
  const inSpread = booklet && part === "front" && spreadView;
  const group = groups[Math.min(groupIdx, groups.length - 1)] ?? [activePage.id];
  const visibleIds = inSpread ? group : [activePage.id];
  const docOf = useCallback((id: string) => docs[id] ?? emptyDoc(), [docs]);
  const setDoc = useCallback((id: string, d: PageDoc) => setDocs((cur) => ({ ...cur, [id]: d })), []);

  // ---------- Mẫu ----------
  const tplDocs = useMemo(() => {
    const m = new Map<string, TemplateDoc>();
    for (const t of templates) {
      const sp = t.target === "disc" ? SPECS.disc : t.target === "front" ? SPECS.front : SPECS.back;
      m.set(t.id, templateDoc(t, mmToPx(sp.w), mmToPx(sp.h)));
    }
    return m;
  }, [templates]);
  const inputOf = useCallback((id: string, d?: PageDoc): PageInput => {
    const doc = d ?? docOf(id);
    return { doc, tpl: doc.templateId ? tplDocs.get(doc.templateId) ?? null : null };
  }, [docOf, tplDocs]);

  // ---------- Gáy / Spine ----------
  const zonesFor = useCallback((id: string): Zone[] | undefined => id === "B-out" ? [
    { id: "b1-left", label: "Gáy", x: 0, w: GAY, dir: dirOf(LEFT_SPINE_ROTATION), side: zoneData["b1-left"] },
    { id: "b1-right", label: "Gáy", x: BW - GAY, w: GAY, dir: dirOf(RIGHT_SPINE_ROTATION), side: zoneData["b1-right"] },
  ] : id === "B-in" ? [
    { id: "b2-gay-l", label: "", x: 0, w: GAY, dir: dirOf(LEFT_SPINE_ROTATION), side: null },
    { id: "b2-gay-r", label: "", x: BW - GAY, w: GAY, dir: dirOf(RIGHT_SPINE_ROTATION), side: null },
    { id: "b2-spine", label: "Spine", x: IN_FROM, w: IN_TO - IN_FROM, dir: dirOf(INNER_SPINE_ROTATION), side: zoneData["b2-spine"] },
  ] : undefined, [zoneData]);
  const zB1 = useMemo(() => zonesFor("B-out"), [zonesFor]);
  const zB2 = useMemo(() => zonesFor("B-in"), [zonesFor]);
  const zonesOf = (id: string) => (id === "B-out" ? zB1 : id === "B-in" ? zB2 : undefined);

  // ---------- Có artwork ----------
  const hasArt = (id: string) => docHasArtwork(exportDocs[id] ?? docs[id])
    || (id === "B-out" && (sideHasContent(zoneData["b1-left"]) || sideHasContent(zoneData["b1-right"])))
    || (id === "B-in" && sideHasContent(zoneData["b2-spine"]));
  const countOf = (pt: Part) => { const l = pages.filter((p) => p.part === pt); return `${l.filter((p) => hasArt(p.id)).length}/${l.length}`; };

  // ---------- Bản dùng để xuất file: trải đôi → tách ảo (phần vắt qua được nhân bản) ----------
  const exportDocs = useMemo(() => {
    const out: Record<string, PageDoc> = {};
    for (const p of pages) out[p.id] = docOf(p.id);
    if (spreadView && booklet) for (const g of groups) if (g.length === 2) {
      const [l, r] = splitFromSpread(docs[pairKey(g)], docOf(g[0]), docOf(g[1]), FW1, measureText);
      out[g[0]] = l; out[g[1]] = r;
    }
    return out;
  }, [docs, spreadView, booklet, frontN, backN]); // eslint-disable-line react-hooks/exhaustive-deps
  const exportInputs = useMemo(() => {
    const m: Record<string, PageInput[]> = {};
    for (const p of pages) m[p.id] = [inputOf(p.id, exportDocs[p.id])];
    return m;
  }, [exportDocs, inputOf]); // eslint-disable-line react-hooks/exhaustive-deps
  const visibleInputs = useMemo(() => visibleIds.map((id) => inputOf(id)), [visibleIds.join(","), inputOf]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Nháp (localStorage) ----------
  const draftData = (): DesignData => ({ v: 1, frontN, backN, spread: spreadView, docs, zones: zoneData, guides, pkg: pkgId });
  const applyData = (d: DesignData) => {
    const dd = { ...(d.docs ?? {}) };
    if (dd["F-in"] && !dd["P2"]) { dd["P2"] = dd["F-in"]; } // bản cũ: trang Mặt Trong dùng id F-in
    delete dd["F-in"];
    setFrontN(d.frontN); setBackN(d.backN); setSpreadView(d.spread); setDocs(dd);
    if (typeof d.guides === "boolean") setGuides(d.guides);
    if (d.pkg) setPkgId(d.pkg);
    setPanelTab("front");
    setZoneData({ ...emptyZones(), ...(d.zones as Record<ZoneId, SpineSide>) }); setActiveId("F-out"); setGroupIdx(0);
  };
  useEffect(() => {
    try {
      const pr = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
      if (pr) { if (typeof pr.guides === "boolean") setGuides(pr.guides); if (typeof pr.spread === "boolean") setSpreadView(pr.spread); }
    } catch { /* bỏ qua */ }
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ guides, spread: spreadView })); } catch { /* */ }
  }, [ready, guides, spreadView]);
  // tab đang mở luôn là 1 phần có trong gói
  useEffect(() => {
    if (panelTab !== "pack" && !visibleParts.includes(panelTab)) setPanelTab(visibleParts[0] ?? "pack");
    else if (panelTab !== "pack" && panelTab !== part) setPanelTab(part);
  }, [panelTab, part, visibleParts.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  // Thông báo dạng toast, tự ẩn sau 3 giây
  useEffect(() => {
    if (!msg || msg.endsWith("...")) return;
    const t = setTimeout(() => setMsg(""), 3000);
    return () => clearTimeout(t);
  }, [msg]);
  useEffect(() => {
    if (!dlOpen) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.("[data-dl-menu]")) setDlOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [dlOpen]);
  useEffect(() => {
    const id = params.get("design");
    if (id && hasSupabase) {
      loadDesign(id).then((row) => {
        if (row?.data) { applyData(row.data); setDesignId(row.id); setDesignName(row.name); }
        else setMsg("Không mở được thiết kế (bạn cần đăng nhập đúng tài khoản).");
        setReady(true);
      });
      return;
    }
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      const d = raw ? JSON.parse(raw) : null;
      if (d && d.v === 1 && Object.values(d.docs ?? {}).some((x) => docHasArtwork(x as PageDoc))) { setDraftAsk(d); return; }
    } catch { /* nháp hỏng: bỏ qua */ }
    setReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draftData(), designId, designName })); } catch { /* đầy bộ nhớ */ }
    }, 1000);
    return () => clearTimeout(t);
  }, [ready, docs, zoneData, frontN, backN, spreadView, designId, designName, guides, pkgId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Điều hướng ----------
  function openPage(id: string) {
    setActiveId(id); setSpineMode(null);
    const gi = groups.findIndex((g) => g.includes(id));
    if (gi >= 0) setGroupIdx(gi);
  }
  // tách hết các cặp trải đôi về từng trang
  const splitAll = (cur: Record<string, PageDoc>, gs: string[][]) => {
    const next = { ...cur };
    for (const g of gs) if (g.length === 2) {
      const k = pairKey(g);
      const [l, r] = splitFromSpread(cur[k], cur[g[0]] ?? emptyDoc(), cur[g[1]] ?? emptyDoc(), FW1, measureText);
      next[g[0]] = l; next[g[1]] = r; delete next[k];
    }
    return next;
  };
  // ghép từng cặp trang thành 1 vùng trải đôi (giữ nguyên vị trí)
  const mergeAll = (cur: Record<string, PageDoc>, gs: string[][]) => {
    const next = { ...cur };
    for (const g of gs) if (g.length === 2) {
      const k = pairKey(g);
      const m = mergeToSpread(cur[k], cur[g[0]] ?? emptyDoc(), cur[g[1]] ?? emptyDoc(), FW1);
      next[k] = m.S; next[g[0]] = m.L; next[g[1]] = m.R;
    }
    return next;
  };
  function setCount(pt: Part, n: number) {
    if (pt === "front" && spreadView) {
      const ng = groupsOf(n);
      setDocs((cur) => (n >= 4 ? mergeAll(splitAll(cur, groups), ng) : splitAll(cur, groups)));
    }
    const next = pt === "front" ? pagesOf(n, backN) : pagesOf(frontN, n);
    if (pt === "front") setFrontN(n); else setBackN(n);
    if (!next.some((x) => x.id === activeId)) setActiveId(next.find((x) => x.part === pt)!.id);
    if (pt === "front" && n < 4) setSpreadView(false);
    setGroupIdx(0);
  }
  // Chọn / đổi gói: số trang luôn theo gói.
  // Gói lớn hơn → đổi luôn, giữ artwork. Gói nhỏ hơn mà trang bị bỏ có artwork → hỏi trước, đồng ý thì XOÁ hẳn.
  function choosePkg(id: string) {
    if (id === pkgId) return;
    const pk = packages.find((x) => x.id === id);
    if (!pk) return;
    const keep = new Set(pagesOfPkg(pk, frontN, backN).map((p) => p.id));
    const cur = pkg ? pages : allPages;
    const removed = cur.filter((p) => !keep.has(p.id) && hasArt(p.id));
    if (removed.length) { setPendingPkg({ id, removed: listPages(removed) }); return; }
    applyPkg(id);
  }
  function applyPkg(id: string) {
    setPendingPkg(null);
    const pk = packages.find((x) => x.id === id);
    if (!pk) return;
    const nf = pk.front_pages || frontN, nb = pk.back_pages || backN;
    const np = pagesOfPkg(pk, frontN, backN);
    const keep = new Set(np.map((p) => p.id));
    setDocs((cur0) => {
      let cur = spreadView ? splitAll(cur0, groups) : { ...cur0 };
      for (const k of Object.keys(cur)) if (!k.startsWith("S") && !keep.has(k)) delete cur[k]; // xoá hẳn artwork trang bị bỏ
      if (spreadView && nf >= 4) cur = mergeAll(cur, groupsOf(nf));
      return cur;
    });
    setZoneData((z) => ({ ...z, ...(keep.has("B-out") ? {} : { "b1-left": emptySide(), "b1-right": emptySide() }), ...(keep.has("B-in") ? {} : { "b2-spine": emptySide() }) }));
    if (nf < 4) setSpreadView(false);
    setFrontN(nf); setBackN(nb); setPkgId(id);
    if (np.length && !np.some((p) => p.id === activeId)) setActiveId(np[0].id);
    setGroupIdx(0);
  }
  function toggleSpread() {
    const bk = pages.filter((p) => p.kind === "booklet");
    if (bk.some((p) => hasArt(p.id))) setConfirmSpread(true);
    else doToggleSpread();
  }
  function doToggleSpread() {
    setConfirmSpread(false);
    // Trải đôi → 1 trang: mỗi trang nhận bản sao phần tử chạm vào nó; 1 trang → Trải đôi: ghép cặp, giữ vị trí
    setDocs((cur) => (spreadView ? splitAll(cur, groups) : mergeAll(cur, groups)));
    setSpreadView(!spreadView);
    setSpineMode(null);
  }

  // ---------- Xuất / gửi / lưu ----------
  async function exportPage(p: PageDef): Promise<DesignFile | null> {
    const h = handles.current[p.id];
    if (!h || !hasArt(p.id)) return null;
    return { kind: p.kind, page: p.page, blob: await h.exportBlob("all"), name: `${p.label}.png` };
  }
  async function downloadThis() {
    setBusy(true); setMsg("");
    try {
      let n = 0;
      for (const id of visibleIds) { const p = pages.find((x) => x.id === id)!; const f = await exportPage(p); if (f) { downloadBlob(f.blob, f.name); n++; } }
      setMsg(n ? `✓ Đã tải ${n} file` : "Trang này chưa có gì để tải.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Lỗi xuất file"); }
    setBusy(false);
  }
  async function downloadAll() {
    setBusy(true); setMsg("Đang đóng gói...");
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      let n = 0;
      for (const p of pages) { const f = await exportPage(p); if (f) { zip.file(f.name, f.blob); n++; } }
      if (!n) { setMsg("Chưa có trang nào để tải."); setBusy(false); return; }
      downloadBlob(await zip.generateAsync({ type: "blob" }), "Taylana-Custom-CD.zip");
      setMsg(`✓ Đã tải ${n} trang (Taylana-Custom-CD.zip)`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Lỗi xuất file"); }
    setBusy(false);
  }
  async function startSave() {
    if (!hasSupabase) return setMsg("Web chưa kết nối database.");
    const { data } = await createClient().auth.getUser();
    if (!data.user) { setAuthOpen(true); return; }
    // lưu lần đầu: tự đặt tên mặc định (đổi tên ở trang Thiết kế của tôi)
    await doSave(designName || `Thiết kế CD ${new Date().toLocaleDateString("vi-VN")}`);
  }
  async function doSave(name: string) {
    setNameAsk(false); setBusy(true); setMsg("Đang lưu...");
    try {
      const thumb = handles.current["F-out"]?.snapshot(220) ?? null;
      const r = await saveDesign(draftData(), { id: designId, name, thumbnail: thumb });
      setDesignId(r.id); setDesignName(name); setDocs(r.data.docs);
      setMsg("✓ Đã lưu vào Thiết kế của tôi");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Lưu thất bại"); }
    setBusy(false);
  }

  // ---------- Sửa gáy / Spine ----------
  const zone = spineMode ? ZONE[spineMode] : null;
  const side = spineMode ? zoneData[spineMode] : null;
  const THICK = zone?.w ?? GAY;
  const selText = side?.texts.find((t) => t.id === spineSel);
  const updSide = (fn: (s: SpineSide) => SpineSide) => spineMode && setZoneData((d) => ({ ...d, [spineMode]: fn(d[spineMode]) }));
  const updText = (pp: Partial<SpineText>) => updSide((s) => ({ ...s, texts: s.texts.map((t) => (t.id === spineSel ? { ...t, ...pp } : t)) }));
  function openZone(id: string) {
    if (!(id in ZONE)) return;
    const z = ZONE[id as ZoneId];
    setSpineBg(handles.current[z.page]?.regionCanvas(z.x, z.w) ?? null);
    setSpineMode(id as ZoneId); setSpineSel(null);
  }
  function addSpineText() {
    const fontSize = Math.min(Math.round(14 * PX_UNIT), Math.round(THICK * 0.6));
    const t: SpineText = { id: Math.random().toString(36).slice(2, 9), text: "Tên album", fontFamily: "Be Vietnam Pro", fontSize, fill: "#050505", align: "center", y: Math.round((THICK - fontSize) / 2) };
    updSide((s) => ({ ...s, texts: [...s.texts, t] }));
    setSpineSel(t.id);
  }

  // ---------- Kích thước vùng làm việc ----------
  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;
  const curSpec = specOf(visibleIds[0]);
  const vp = isDesktop ? { w: area.w, h: area.h } : { w: area.w, h: Math.round(((area.w - 48) * curSpec.h) / (curSpec.w * visibleIds.length)) + 90 };

  // Mẫu áp dụng cho trang đang chọn mẫu
  const tplPageId = inSpread && group.length === 2 ? group[tplTarget] : visibleIds[0];
  const tplList = templates.filter((t) => targetsOf(tplPageId).includes(t.target));
  const curTpl = docOf(tplPageId).templateId;
  const setTpl = (id: string | null) => setDoc(tplPageId, { ...docOf(tplPageId), templateId: id, fills: {}, texts: {} });

  const visLabel = visibleIds.map((id) => pages.find((p) => p.id === id)?.label).join(" – ");
  const Label = ({ children }: { children: React.ReactNode }) => <p className="tool-label">{children}</p>;
  const Switch = ({ on, onClick, label, dim }: { on: boolean; onClick: () => void; label: string; dim?: boolean }) => (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} className={`inline-flex items-center gap-2 text-[13px] text-[#18181b] ${dim ? "opacity-50" : ""}`}>
      <span className={`relative h-[18px] w-8 rounded-full transition ${on ? "bg-[#ff5fa2]" : "bg-[#d4d4d8]"}`}>
        <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all ${on ? "left-[16px]" : "left-[2px]"}`} />
      </span>
      {label}
    </button>
  );
  const Thumb = ({ id, className = "", round = false }: { id: string; className?: string; round?: boolean }) => (
    <span className={`relative block overflow-hidden bg-[#f4f4f5] ${round ? "rounded-full" : "rounded-[4px]"} ${className}`} style={{ aspectRatio: `${specOf(id).w} / ${specOf(id).h}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {thumbs[id] && <img src={thumbs[id]} alt="" className="h-full w-full object-cover" />}
      {hasArt(id) && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-[#ff5fa2] ring-1 ring-white" title="Đã có thiết kế" />}
    </span>
  );

  return (
    <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
      {/* ---------- BÊN TRÁI: vùng làm việc ---------- */}
      <div ref={areaRef} className="relative bg-[#efeff1] md:min-h-0 md:w-[62%]" style={!isDesktop ? { height: vp.h } : undefined}>
        {spineMode && zone ? (
          <div key={`spine-${spineMode}`} className="absolute inset-0 flex flex-col items-center justify-center p-4 animate-[flipIn_.3s_ease]">
            <SpineEditor side={zoneData[spineMode]} len={BH} thick={THICK} width={Math.max(200, area.w - 32)} dir={zone.dir} bg={spineBg}
              selectedId={spineSel} onSelect={setSpineSel}
              onMoveText={(id, y) => updSide((s) => ({ ...s, texts: s.texts.map((t) => (t.id === id ? { ...t, y: Math.max(0, Math.min(THICK - t.fontSize, y)) } : t)) }))} />
            <p className="mt-2 text-center text-[12px] font-medium text-[#4d4a46]">{zone.title[0].toUpperCase() + zone.title.slice(1)} · {zone.cm.toFixed(1)} x {SPECS.back.h / 10} cm</p>
          </div>
        ) : area.w > 0 && ready && (
          <div key={visibleIds.join("-")} className={`absolute inset-0 ${part === "back" ? "animate-[flipIn_.3s_ease]" : ""}`}>
            <CdDesigner spec={curSpec} pages={visibleInputs} view="all" viewport={vp} active
              onChange={(i, d) => setDoc(visibleIds[i], d)}
              spreadDoc={visibleIds.length === 2 ? docs[pairKey(visibleIds)] ?? emptyDoc() : undefined}
              onSpreadChange={visibleIds.length === 2 ? (d) => setDoc(pairKey(visibleIds), d) : undefined}
              toolbarTarget={host} guides={guides}
              zones={visibleIds.length === 1 ? zonesOf(visibleIds[0]) : undefined} onZoneClick={openZone}
              tray={visibleIds[0] === "B-in" && trayOn ? TRAY : undefined}
              caption={`${visLabel} · ${sizeText(curSpec)}`}
              reserveTop={44} onToggleGuides={() => setGuides((g) => !g)} />
          </div>
        )}
        {!pkg && ready && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-[#efeff1]/85 backdrop-blur-sm">
            <p className="rounded-full bg-white px-5 py-2.5 font-sans text-[15px] font-medium text-[#4d4a46] shadow-sm">Chọn gói để bắt đầu thiết kế</p>
          </div>
        )}
        {!spineMode && pkg && (
          <div className="absolute right-3 top-3 z-20 rounded-full bg-white px-3 py-1.5 font-sans shadow-[0_2px_10px_rgba(20,20,20,.12)]">
            <Switch on={guides} onClick={() => setGuides(!guides)} label="Hiển thị guideline" />
          </div>
        )}
        {/* Bản ẩn từng trang: xuất file & ảnh thu nhỏ */}
        <div className="pointer-events-none absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden>
          {ready && pages.map((p) => (
            <CdDesigner key={p.id} ref={(h) => { handles.current[p.id] = h; }} spec={specOf(p.id)} pages={exportInputs[p.id]} viewport={{ w: 320, h: 320 }}
              active={false} interactive={false} guides={false} onChange={() => {}} zones={zonesOf(p.id)}
              onSnapshot={(_h, url) => setThumbs((t) => (t[p.id] === url ? t : { ...t, [p.id]: url }))} />
          ))}
        </div>
      </div>

      {/* ---------- BÊN PHẢI: panel ---------- */}
      <aside className="flex flex-col divide-y divide-[#efeff1] bg-white pb-16 font-sans text-[13px] text-[#18181b] md:min-h-0 md:flex-1 md:overflow-y-auto md:border-l md:border-[#e5e5e7] md:pb-0">
        <section className="space-y-2.5 p-4">
          {pkg && (
            <label className="flex items-center gap-2">
              <span className="tool-label w-9 shrink-0">Gói</span>
              <select className="tool-input w-full !h-9 font-medium" value={pkgId} onChange={(e) => choosePkg(e.target.value)} aria-label="Gói">
                {packages.map((pk) => <option key={pk.id} value={pk.id}>{pk.name}</option>)}
              </select>
            </label>
          )}
          <div className={`flex gap-0.5 rounded-[8px] bg-[#f4f4f5] p-0.5 ${pkg ? "" : "hidden"}`}>
            {visibleParts.map((pt) => (
              <button key={pt} aria-pressed={panelTab === pt}
                className={`h-8 flex-1 rounded-[6px] px-1 text-[12px] font-medium ${panelTab === pt ? "bg-[#ff5fa2] text-white shadow-sm" : "text-[#71717a] hover:text-[#18181b]"}`}
                onClick={() => { setPanelTab(pt); openPage(pages.find((x) => x.part === pt)!.id); }}>
                {PART_LABEL[pt]} <span className="opacity-80">{countOf(pt)}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Chưa chọn gói: chỉ hiện danh sách gói */}
        {!pkg && (
          <section className="p-4">
            <Label>Chọn gói để bắt đầu</Label>
            <div className="mt-2 space-y-1.5">
              {packages.map((pk) => (
                <button key={pk.id} onClick={() => choosePkg(pk.id)}
                  className="flex w-full items-center gap-2.5 rounded-[10px] border border-[#e5e5e7] p-2 text-left hover:border-[#ff5fa2]">
                  <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-[6px] bg-[#f4f4f5]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {pk.image_url && <img src={pk.image_url} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{pk.name}</span>
                    <span className="block text-[12px] text-[#71717a]">{describePkg(pk) || "Chưa có cấu hình trang"}</span>
                  </span>
                </button>
              ))}
              {!packages.length && <p className="text-[12px] text-[#71717a]">Tiệm chưa có gói sản phẩm nào.</p>}
            </div>
          </section>
        )}

        <section className={`p-4 ${!pkg ? "hidden" : ""}`}>
          <div className="mb-2 flex items-center justify-between">
            <Label>Trang</Label>
            {booklet && part === "front" && <Switch on={spreadView} onClick={toggleSpread} label="Trải đôi" />}
          </div>
          {inSpread ? (
            <div className="grid grid-cols-3 gap-1.5">
              {groups.map((g, gi) => (
                <button key={g.join()} onClick={() => setGroupIdx(gi)} title={`Trang ${g.map((id) => pages.find((p) => p.id === id)?.label).join("–")}`}
                  className={`rounded-[8px] border p-1 text-center text-[11px] ${gi === groupIdx ? "border-[#ff5fa2] ring-1 ring-[#ff5fa2]" : "border-[#e5e5e7] hover:border-[#d4d4d8]"}`}>
                  <span className="flex justify-center gap-px">{g.map((id) => <Thumb key={id} id={id} className="w-1/2 max-w-[44px]" />)}</span>
                  <span className="mt-1 block font-medium">{g.map((id) => pages.find((p) => p.id === id)?.label).join("–")}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className={`grid gap-1.5 ${booklet && part === "front" ? "grid-cols-4" : "grid-cols-2"}`}>
              {pages.filter((p) => p.part === part).map((p) => {
                const compact = booklet && part === "front";
                return (
                  <button key={p.id} onClick={() => openPage(p.id)} title={p.label}
                    className={`flex items-center gap-1.5 rounded-[8px] border p-1 text-left ${compact ? "flex-col !gap-1 text-center text-[11px]" : "text-[12px]"} ${p.id === activePage.id ? "border-[#ff5fa2] ring-1 ring-[#ff5fa2]" : "border-[#e5e5e7] hover:border-[#d4d4d8]"}`}>
                    <Thumb id={p.id} round={p.part === "disc"} className={compact ? "w-full" : "w-9 shrink-0"} />
                    <span className="min-w-0 font-medium leading-tight">{p.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {spineMode && zone ? (
          <section className={`space-y-3 p-4 ${!pkg ? "hidden" : ""}`}>
            <button className="tool-btn w-full" onClick={() => { setSpineMode(null); setSpineSel(null); }}><Icon name="back" /> Xong, quay lại bìa</button>
            <div className="flex items-center justify-between">
              <Label>Sửa {zone.title}</Label>
              <button className="tool-btn" onClick={addSpineText}><Icon name="text" /> Chữ</button>
            </div>
            {selText ? (
              <div className="space-y-2.5 rounded-[10px] border border-[#e5e5e7] p-3">
                <div className="flex items-center justify-between">
                  <Label>Thuộc tính · chữ</Label>
                  <button className="tool-btn tool-icon !text-[#dc2626]" title="Xoá" aria-label="Xoá"
                    onClick={() => { updSide((s) => ({ ...s, texts: s.texts.filter((t) => t.id !== spineSel) })); setSpineSel(null); }}><Icon name="trash" /></button>
                </div>
                <input className="tool-input w-full" value={selText.text} onChange={(e) => updText({ text: e.target.value })} />
                <select className="tool-input w-full" value={selText.fontFamily} style={{ fontFamily: selText.fontFamily }} onChange={(e) => updText({ fontFamily: e.target.value })}>
                  {FONTS.map((f) => <option key={f.name} value={f.name} style={{ fontFamily: f.name }}>{f.label}</option>)}
                </select>
                <div className="flex gap-1.5">
                  <div className="flex flex-1 items-center">
                    <input type="number" min={4} max={200} value={Math.round((selText.fontSize / PX_UNIT) * 10) / 10} aria-label="Cỡ chữ (px)" className="tool-input w-full rounded-r-none"
                      onChange={(e) => { const v = Number(e.target.value); if (v > 0) { const fontSize = Math.min(THICK, Math.round(v * PX_UNIT)); updText({ fontSize, y: Math.min(selText.y, THICK - fontSize) }); } }} />
                    <select aria-label="Chọn nhanh cỡ chữ" className="tool-input -ml-px w-9 rounded-l-none !px-1" value=""
                      onChange={(e) => { const v = Number(e.target.value); if (v) { const fontSize = Math.min(THICK, Math.round(v * PX_UNIT)); updText({ fontSize, y: Math.min(selText.y, THICK - fontSize) }); } }}>
                      <option value="" disabled>▾</option>
                      {SIZE_PRESETS.map((n) => <option key={n} value={n}>{n} px</option>)}
                    </select>
                  </div>
                  <div className="flex">
                    {(["left", "center", "right"] as const).map((a, i) => (
                      <button key={a} title={{ left: "Canh trái", center: "Canh giữa", right: "Canh phải" }[a]} aria-label={a} aria-pressed={selText.align === a}
                        className={`tool-btn tool-icon ${i === 0 ? "rounded-r-none" : i === 2 ? "-ml-px rounded-l-none" : "-ml-px rounded-none"}`} onClick={() => updText({ align: a })}>
                        <Icon name={a === "left" ? "alignL" : a === "center" ? "alignC" : "alignR"} />
                      </button>
                    ))}
                  </div>
                </div>
                <ColorSelect value={selText.fill} colors={TEXT_COLORS} onChange={(c) => updText({ fill: c })} />
              </div>
            ) : (
              <p className="text-[12px] text-[#71717a]">{side && side.texts.length ? "Bấm vào chữ để sửa, kéo lên/xuống để đổi vị trí." : `Thêm chữ cho ${zone.title}.`}</p>
            )}
            <div>
              <Label>Màu nền {zone.title}</Label>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <button onClick={() => updSide((s) => ({ ...s, bg: null }))} aria-pressed={!side?.bg} title="Không màu" aria-label="Không màu"
                  className="swatch bg-[linear-gradient(135deg,#fff_45%,#dc2626_45%,#dc2626_55%,#fff_55%)]" />
                {TEXT_COLORS.map((c) => (
                  <button key={c.value} aria-label={c.name} title={c.name} aria-pressed={side?.bg === c.value} onClick={() => updSide((s) => ({ ...s, bg: c.value }))} className="swatch" style={{ background: c.value }} />
                ))}
                <label className="swatch relative overflow-hidden bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" title="Màu tuỳ chọn">
                  <input type="color" value={side?.bg ?? "#ffffff"} onChange={(e) => updSide((s) => ({ ...s, bg: e.target.value }))} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Màu nền tuỳ chọn" />
                </label>
              </div>
            </div>
          </section>
        ) : (
          <section className={`p-4 ${!pkg ? "hidden" : ""}`}>
            <div className="mb-2 flex items-center justify-between">
              <Label>Mẫu</Label>
              {inSpread && group.length === 2 && (
                <div className="flex gap-1">
                  {group.map((id, i) => (
                    <button key={id} className="tool-btn !h-6 !px-2 !text-[11px]" aria-pressed={tplTarget === i} onClick={() => setTplTarget(i as 0 | 1)} title={`Trang ${pages.find((p) => p.id === id)?.label}`}>{i === 0 ? "Trang trái" : "Trang phải"}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              <button onClick={() => setTpl(null)} title="Tự do"
                className={`w-16 shrink-0 rounded-[8px] border p-1 text-center text-[11px] ${!curTpl ? "border-[#ff5fa2] ring-1 ring-[#ff5fa2]" : "border-[#e5e5e7]"}`}>
                <div className={`mb-1 grid aspect-square place-items-center bg-[#f4f4f5] text-base ${tplPageId === "D" ? "rounded-full" : "rounded-[4px]"}`}>✎</div>
                Tự do
              </button>
              {tplList.map((t) => {
                const sp = specOf(tplPageId);
                return (
                  <button key={t.id} onClick={() => setTpl(t.id)} title={t.name}
                    className={`w-16 shrink-0 rounded-[8px] border p-1 text-center text-[11px] ${curTpl === t.id ? "border-[#ff5fa2] ring-1 ring-[#ff5fa2]" : "border-[#e5e5e7]"}`}>
                    <div className="mb-1">
                      {t.thumbnail_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={t.thumbnail_url} alt="" className={`w-full object-cover ${tplPageId === "D" ? "rounded-full" : "rounded-[4px]"}`} style={{ aspectRatio: `${sp.w} / ${sp.h}` }} />
                        : <TemplateThumb ratio={sp.w / sp.h} slots={t.slots} overlay={t.overlay_url} background={t.background_url} disc={tplPageId === "D"} />}
                    </div>
                    <span className="line-clamp-1">{t.name}</span>
                  </button>
                );
              })}
            </div>
            {!tplList.length && <p className="mt-2 text-[12px] text-[#71717a]">Chưa có mẫu cho loại trang này.</p>}
          </section>
        )}

        <section className={`p-4 ${spineMode || !pkg ? "hidden" : ""}`}>
          {visibleIds[0] === "B-in" && <div className="mb-3"><Switch on={trayOn} onClick={() => setTrayOn(!trayOn)} label="Ướm khay đĩa" dim={!guides} /></div>}
          <div ref={(el) => { if (el && host !== el) setHost(el); }} />
        </section>

        {/* Thanh hành động cố định ở đáy panel (điện thoại: đáy màn hình) */}
        <div className={`fixed inset-x-0 bottom-0 z-40 mt-auto border-t border-[#efeff1] bg-white p-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:sticky md:inset-x-auto md:pb-3 ${pkg ? "" : "hidden"}`}>
          <div className="flex gap-2">
            <button className="tool-btn !h-10 flex-1" disabled={busy} onClick={startSave}>Lưu</button>
            <div className="relative flex-1" data-dl-menu>
              <button className="tool-btn !h-10 w-full" disabled={busy} onClick={() => setDlOpen(!dlOpen)} aria-expanded={dlOpen}>Tải xuống <span className="text-[10px]">▾</span></button>
              {dlOpen && (
                <div className="absolute bottom-12 left-0 z-50 w-48 rounded-[8px] border border-[#e5e5e7] bg-white p-1 shadow-[0_8px_24px_rgba(20,20,20,.14)]">
                  <button className="block h-8 w-full rounded-[6px] px-2 text-left hover:bg-[#f4f4f5]" onClick={() => { setDlOpen(false); downloadThis(); }}>Tải trang này</button>
                  <button className="block h-8 w-full rounded-[6px] px-2 text-left hover:bg-[#f4f4f5]" onClick={() => { setDlOpen(false); downloadAll(); }}>Tải tất cả (.zip)</button>
                </div>
              )}
            </div>
            <button className="h-10 flex-[1.6] rounded-[8px] bg-[#ff5fa2] text-[14px] font-semibold text-white transition hover:brightness-95 disabled:opacity-50" disabled={busy} onClick={() => setOrdering(true)}>
              Đặt mua
            </button>
          </div>
        </div>
      </aside>

      {msg && (
        <div className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] right-4 z-[70] max-w-xs rounded-[8px] bg-[#18181b] px-3 py-2 font-sans text-[13px] text-white shadow-lg md:bottom-6" role="status">{msg}</div>
      )}
      {pendingPkg && (
        <Modal title="Đổi gói?" danger ok="Đổi và xoá" cancel="Huỷ"
          text={`Gói này có ít trang hơn. Artwork ở các trang sau sẽ bị XOÁ: ${pendingPkg.removed}. Bạn có chắc muốn đổi?`}
          onOk={() => applyPkg(pendingPkg.id)} onCancel={() => setPendingPkg(null)} />
      )}
      {ordering && (
        <OrderDialog orderType="custom_cd" title="Đặt mua Custom CD" packages={packages} onClose={() => setOrdering(false)}
          initialPackageId={pkg ? pkgId : undefined}
          getFiles={async () => (await Promise.all(pages.map(exportPage))).filter((f): f is DesignFile => !!f)} />
      )}

      {/* Hỏi tiếp tục nháp */}
      {draftAsk && (
        <Modal title="Tiếp tục thiết kế đang làm dở?" text="Tiệm tìm thấy bản thiết kế bạn đang làm dở trên máy này."
          ok="Tiếp tục" cancel="Làm mới"
          onOk={() => { applyData(draftAsk); setDesignId(draftAsk.designId ?? null); setDesignName(draftAsk.designName ?? ""); setDraftAsk(null); setReady(true); }}
          onCancel={() => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* */ } setDraftAsk(null); setReady(true); }} />
      )}
      {confirmSpread && (
        <Modal title="Chuyển chế độ xem?" text="Khi chuyển chế độ xem, artwork nằm giữa 2 trang có thể bị chồng lên nhau hoặc bị nhân đôi. Bạn có muốn tiếp tục không?"
          ok="Tiếp tục" cancel="Huỷ" onOk={doToggleSpread} onCancel={() => setConfirmSpread(false)} />
      )}
      {nameAsk && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal>
          <form className="w-full max-w-sm rounded-[14px] bg-white p-5 font-sans text-[14px] shadow-xl" onSubmit={async (e) => {
            e.preventDefault();
            if (nameAsk === "save") return doSave(designName);
            setNameAsk(false);
            if (designId) { try { await renameDesign(designId, designName); setMsg("✓ Đã đổi tên"); } catch (er) { setMsg(er instanceof Error ? er.message : "Lỗi"); } }
          }}>
            <p className="mb-3 text-[16px] font-semibold">Đặt tên thiết kế</p>
            <input autoFocus className="tool-input !h-10 w-full !text-[14px]" maxLength={120} value={designName} onChange={(e) => setDesignName(e.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="tool-btn" onClick={() => setNameAsk(false)}>Huỷ</button>
              <button className="tool-btn is-active">Lưu</button>
            </div>
          </form>
        </div>
      )}
      {authOpen && <AuthDialog title="Đăng nhập để lưu thiết kế" onClose={() => setAuthOpen(false)} onDone={() => { setAuthOpen(false); setTimeout(startSave, 50); }} />}
    </div>
  );
}

function Modal({ title, text, ok, cancel, onOk, onCancel, danger }: { title: string; text: string; ok: string; cancel: string; onOk: () => void; onCancel: () => void; danger?: boolean }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal>
      <div className="w-full max-w-sm rounded-[14px] bg-white p-5 font-sans text-[14px] shadow-xl">
        <p className="text-[16px] font-semibold text-[#18181b]">{title}</p>
        <p className="mt-2 text-[#71717a]">{text}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="tool-btn" onClick={onCancel}>{cancel}</button>
          <button className={danger ? "tool-btn !border-[#dc2626] !bg-[#dc2626] !text-white hover:!brightness-95" : "tool-btn is-active"} onClick={onOk}>{ok}</button>
        </div>
      </div>
    </div>
  );
}
