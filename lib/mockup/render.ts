"use client";

/* Dựng 1 khung mockup CD. Thứ tự lớp:
   (nền: vẽ ở scene) → ảnh khách kéo giãn phối cảnh vào từng vùng → ảnh khung PNG (có sẵn bóng) → lớp kính. */
import { BACK_SPINE_CM, BACK_W_CM } from "@/lib/cdSpecs";
import { warpToQuad } from "./warp";
import { DEFAULT_DISC_HOLE, REGION_LABELS, type GlassSettings, type Region, type RegionType } from "./types";

export type SourceImage = (CanvasImageSource & { width: number; height: number }) | null;
type Img = CanvasImageSource & { width: number; height: number };

const canvas = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

// Mặt đĩa: cắt tròn + khoét lỗ giữa trước khi kéo giãn (nghiêng thành elip đúng phối cảnh)
function discSource(img: Img, hole: number) {
  const n = Math.min(2048, Math.min(img.width, img.height));
  const c = canvas(n, n), x = c.getContext("2d")!;
  const s = Math.max(n / img.width, n / img.height);
  x.beginPath(); x.arc(n / 2, n / 2, n / 2, 0, Math.PI * 2); x.closePath(); x.clip();
  x.drawImage(img, (n - img.width * s) / 2, (n - img.height * s) / 2, img.width * s, img.height * s);
  x.globalCompositeOperation = "destination-out";
  x.beginPath(); x.arc(n / 2, n / 2, (n / 2) * Math.max(0, Math.min(0.6, hole)), 0, Math.PI * 2); x.fill();
  return c;
}
// Bìa sau: bỏ 2 dải gáy ở 2 bên (số đo từ lib/cdSpecs)
function trimSpines(img: Img) {
  const cut = (BACK_SPINE_CM / BACK_W_CM) * img.width;
  const c = canvas(img.width - cut * 2, img.height);
  c.getContext("2d")!.drawImage(img, cut, 0, img.width - cut * 2, img.height, 0, 0, c.width, c.height);
  return c;
}
// Vùng chưa có ảnh: xám nhạt + tên vùng
function placeholder(type: RegionType) {
  const c = canvas(600, 600), x = c.getContext("2d")!;
  x.fillStyle = "#e4e4e7"; x.fillRect(0, 0, 600, 600);
  x.fillStyle = "#a1a1aa"; x.font = "600 34px Inter, system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  const words = REGION_LABELS[type].split(" - ");
  words.forEach((w, i) => x.fillText(w, 300, 300 + (i - (words.length - 1) / 2) * 44));
  if (type === "disc") return discSource(c, DEFAULT_DISC_HOLE);
  return c;
}

export type RenderInput = {
  frame: Img; regions: Region[]; images: Partial<Record<RegionType, SourceImage>>;
  masks?: Record<string, Img | undefined>; glass: GlassSettings; maxW?: number;
};

/** Trả về canvas khung đã dựng (nền trong suốt), chiều rộng tối đa maxW */
export function renderFrame({ frame, regions, images, masks = {}, glass, maxW = 1600 }: RenderInput): HTMLCanvasElement {
  const k = Math.min(1, maxW / frame.width);
  const W = Math.round(frame.width * k), H = Math.round(frame.height * k);
  const out = canvas(W, H), ctx = out.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  const quadPx = (r: Region) => r.pts.map(([x, y]) => [x * W, y * H] as [number, number]);

  for (const r of [...regions].sort((a, b) => a.order - b.order)) {
    const raw = images[r.type] ?? null;
    let src: Img = raw ?? placeholder(r.type);
    if (raw && r.type === "disc") src = discSource(raw, r.hole ?? DEFAULT_DISC_HOLE);
    if (raw && (r.type === "back_out" || r.type === "back_in") && r.spine === "trim") src = trimSpines(raw);
    const layer = warpToQuad(src, quadPx(r), W, H);
    const mask = r.mask_url ? masks[r.mask_url] : undefined;
    if (mask) { const lx = layer.getContext("2d")!; lx.globalCompositeOperation = "destination-in"; lx.drawImage(mask, 0, 0, W, H); }
    ctx.globalCompositeOperation = r.blend === "multiply" ? "multiply" : "source-over";
    ctx.drawImage(layer, 0, 0);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(frame, 0, 0, W, H);

  // Lớp kính: dải sáng chéo mờ + chút bóng ở mép
  const s = Math.max(0, Math.min(100, glass.strength)) / 100;
  if (s > 0) for (const r of regions.filter((x) => x.glass)) {
    const q = quadPx(r);
    const cx = q.reduce((t, p) => t + p[0], 0) / 4, cy = q.reduce((t, p) => t + p[1], 0) / 4;
    const diag = Math.hypot(q[2][0] - q[0][0], q[2][1] - q[0][1]);
    ctx.save();
    ctx.beginPath(); q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
    ctx.translate(cx, cy); ctx.rotate((glass.angle * Math.PI) / 180);
    const band = diag * 0.35;
    const lg = ctx.createLinearGradient(-band, 0, band, 0);
    lg.addColorStop(0, "rgba(255,255,255,0)");
    lg.addColorStop(0.5, `rgba(255,255,255,${0.2 * s})`); // strength 50% ≈ 10%
    lg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = lg; ctx.fillRect(-diag * 0.2 - band, -diag, band * 2, diag * 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineWidth = Math.max(2, diag * 0.025);
    ctx.strokeStyle = `rgba(0,0,0,${0.14 * s})`;
    ctx.beginPath(); q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
    ctx.restore();
  }
  return out;
}

/** Ghép khung đã dựng lên nền: pos.x, pos.y = tâm khung (0..1), pos.scale = chiều cao khung / chiều cao nền */
export function composeScene(out: HTMLCanvasElement, paintBg: (ctx: CanvasRenderingContext2D, W: number, H: number) => void,
  frame: HTMLCanvasElement | null, pos: { x: number; y: number; scale: number }, watermark: boolean) {
  const ctx = out.getContext("2d")!;
  const W = out.width, H = out.height;
  ctx.clearRect(0, 0, W, H);
  paintBg(ctx, W, H);
  if (frame) {
    const fh = H * pos.scale, fw = fh * (frame.width / frame.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(frame, pos.x * W - fw / 2, pos.y * H - fh / 2, fw, fh);
  }
  if (watermark) {
    ctx.save();
    ctx.font = `600 ${Math.round(W * 0.018)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(24,24,27,0.35)"; ctx.textAlign = "right"; ctx.textBaseline = "bottom";
    ctx.fillText("Taylana", W - W * 0.025, H - W * 0.025);
    ctx.restore();
  }
}

// Bộ ảnh thử cho admin: lưới màu có số để nhận ra hướng ảnh
export function sampleImage(type: RegionType) {
  const c = canvas(800, 800), x = c.getContext("2d")!;
  const colors = ["#ff5fa2", "#60a5fa", "#34d399", "#fbbf24"];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = colors[(i + j) % 4]; x.fillRect(i * 200, j * 200, 200, 200); }
  x.fillStyle = "#fff"; x.font = "700 120px Inter, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  [["1", 100, 100], ["2", 700, 100], ["3", 700, 700], ["4", 100, 700]].forEach(([t, a, b]) => x.fillText(String(t), Number(a), Number(b)));
  x.font = "700 56px Inter, sans-serif"; x.fillStyle = "#18181b"; x.fillText(REGION_LABELS[type].split(" - ").pop()!, 400, 400);
  return c;
}
