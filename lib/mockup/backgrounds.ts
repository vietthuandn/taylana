"use client";

// Nền gradient tông SÁNG (pastel) + lớp nhiễu hạt mịn, tạo bằng code (không tốn dung lượng).
export type Gradient = { id: string; name: string; stops: string[]; angle: number };
export const GRADIENTS: Gradient[] = [
  { id: "dao", name: "Hồng đào", stops: ["#ffe4e1", "#ffd1dc", "#ffe9d6"], angle: 135 },
  { id: "kem", name: "Kem", stops: ["#fff8ec", "#f8ecd8"], angle: 160 },
  { id: "bachha", name: "Bạc hà", stops: ["#e3fbf1", "#c9f0e2", "#eefaf6"], angle: 120 },
  { id: "lavender", name: "Lavender", stops: ["#f1eaff", "#e0d4ff", "#f7f1ff"], angle: 145 },
  { id: "bo", name: "Vàng bơ", stops: ["#fff9d8", "#ffefb0"], angle: 130 },
  { id: "suong", name: "Sương xanh", stops: ["#eaf4ff", "#d6e9fb", "#f2f8ff"], angle: 150 },
  { id: "hoahong", name: "Hoa hồng", stops: ["#fff0f6", "#ffd6e8", "#fff4f9"], angle: 125 },
  { id: "may", name: "Mây xám", stops: ["#f7f7f8", "#e9e9ec"], angle: 170 },
];

export function drawGradient(ctx: CanvasRenderingContext2D, W: number, H: number, g: Gradient, noise = 0.07) {
  const a = (g.angle * Math.PI) / 180, r = Math.hypot(W, H) / 2;
  const cx = W / 2, cy = H / 2;
  const lg = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  g.stops.forEach((c, i) => lg.addColorStop(i / Math.max(1, g.stops.length - 1), c));
  ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
  // vầng sáng mềm
  const rg = ctx.createRadialGradient(W * 0.3, H * 0.25, 0, W * 0.3, H * 0.25, Math.max(W, H) * 0.7);
  rg.addColorStop(0, "rgba(255,255,255,0.45)"); rg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  if (noise > 0) drawNoise(ctx, W, H, noise);
}

// Nhiễu hạt mịn (opacity ~6–8%)
let noiseTile: HTMLCanvasElement | null = null;
export function drawNoise(ctx: CanvasRenderingContext2D, W: number, H: number, opacity = 0.07) {
  if (!noiseTile) {
    noiseTile = document.createElement("canvas");
    noiseTile.width = noiseTile.height = 256;
    const x = noiseTile.getContext("2d")!;
    const d = x.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = ctx.createPattern(noiseTile, "repeat")!;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// Ảnh nền phủ kín khung W×H
export function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, W: number, H: number) {
  const s = Math.max(W / img.width, H / img.height);
  ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
}

export type BgChoice = { kind: "gradient"; g: Gradient } | { kind: "image"; img: HTMLImageElement; name: string };
export function bgRatio(b: BgChoice) { return b.kind === "image" ? b.img.naturalHeight / b.img.naturalWidth : 1; }
export function paintBackground(ctx: CanvasRenderingContext2D, W: number, H: number, b: BgChoice) {
  if (b.kind === "gradient") drawGradient(ctx, W, H, b.g);
  else drawCover(ctx, b.img, W, H);
}
