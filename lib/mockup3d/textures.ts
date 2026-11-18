"use client";

/* Texture tạo bằng canvas cho hộp CD 3D (không cần file ảnh): vết xước nhựa, vân giấy, vòng đồng tâm mặt dưới đĩa. */
import * as THREE from "three";

const cv = (n: number) => { const c = document.createElement("canvas"); c.width = c.height = n; return c; };
let cache: { scratch?: THREE.Texture; paper?: THREE.Texture; rings?: THREE.Texture } = {};

/** roughnessMap nhựa: nền ~0.04, các đường xước mảnh ngẫu nhiên nhám hơn, opacity thấp (chỉ thấy khi bắt sáng) */
export function scratchMap() {
  if (cache.scratch) return cache.scratch;
  const c = cv(1024), x = c.getContext("2d")!;
  x.fillStyle = "rgb(10,10,10)"; x.fillRect(0, 0, 1024, 1024); // kênh G × roughness(1) ≈ 0.04
  x.lineCap = "round";
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * Math.PI * 2, len = 20 + Math.random() * 180;
    const px = Math.random() * 1024, py = Math.random() * 1024;
    x.strokeStyle = `rgba(90,90,90,${0.05 + Math.random() * 0.12})`;
    x.lineWidth = 0.4 + Math.random() * 0.9;
    x.beginPath(); x.moveTo(px, py);
    x.quadraticCurveTo(px + Math.cos(a) * len * 0.5 + (Math.random() - 0.5) * 12, py + Math.sin(a) * len * 0.5, px + Math.cos(a) * len, py + Math.sin(a) * len);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (cache.scratch = t);
}

/** normalMap vân giấy rất mịn (noise → pháp tuyến bằng sai phân) */
export function paperNormal() {
  if (cache.paper) return cache.paper;
  const n = 512, h = new Float32Array(n * n);
  for (let i = 0; i < h.length; i++) h[i] = Math.random();
  // làm mềm 2 lần cho vân sợi giấy
  for (let pass = 0; pass < 2; pass++) for (let y = 0; y < n; y++) for (let x0 = 0; x0 < n; x0++) {
    const k = y * n + x0;
    h[k] = (h[k] * 2 + h[y * n + ((x0 + 1) % n)] + h[((y + 1) % n) * n + x0] + h[y * n + ((x0 - 1 + n) % n)]) / 5;
  }
  const c = cv(n), x = c.getContext("2d")!, d = x.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x0 = 0; x0 < n; x0++) {
    const k = y * n + x0;
    const dx = (h[y * n + ((x0 + 1) % n)] - h[y * n + ((x0 - 1 + n) % n)]) * 4;
    const dy = (h[((y + 1) % n) * n + x0] - h[((y - 1 + n) % n) * n + x0]) * 4;
    const len = Math.hypot(dx, dy, 1);
    d.data[k * 4] = ((-dx / len) * 0.5 + 0.5) * 255;
    d.data[k * 4 + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
    d.data[k * 4 + 2] = ((1 / len) * 0.5 + 0.5) * 255;
    d.data[k * 4 + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return (cache.paper = t);
}

/** Vòng tròn đồng tâm rất mịn cho mặt dưới đĩa (dùng làm map + iridescenceThicknessMap → vệt cầu vồng chạy theo vòng) */
export function discRings() {
  if (cache.rings) return cache.rings;
  const n = 1024, c = cv(n), x = c.getContext("2d")!;
  x.fillStyle = "#e9ebef"; x.fillRect(0, 0, n, n);
  for (let r = n / 2; r > 0; r -= 1.2) {
    const v = 200 + Math.round(Math.random() * 55);
    x.strokeStyle = `rgb(${v},${v},${Math.min(255, v + 4)})`;
    x.lineWidth = 1;
    x.beginPath(); x.arc(n / 2, n / 2, r, 0, Math.PI * 2); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return (cache.rings = t);
}

export const resetTextureCache = () => { cache = {}; };
