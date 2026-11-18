// Cắt public/mockup/system/cd-sheet.png (ảnh thật hộp CD, nền trong suốt) thành các sprite cho Mẫu hệ thống (Auto):
//   closed.png (hộp đóng) · open.png (hộp mở có đĩa) · disc.png (chỉ đĩa, tròn) + sheet.json (toạ độ 0..1 trong từng sprite).
// Dò bằng kênh alpha. Thay cd-sheet.png bằng bản độ phân giải cao hơn (CÙNG bố cục 3 vật thể) rồi chạy lại:
//   node scripts/slice-cd-sheet.mjs
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const DIR = "public/mockup/system";
const { data, info } = await sharp(`${DIR}/cd-sheet.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, K = W / 1080; // hệ số so với bản gốc 1080px
const A = (x, y) => data[(y * W + x) * 4 + 3];
const L = (x, y) => { const i = (y * W + x) * 4; return (data[i] + data[i + 1] + data[i + 2]) / 3; };
const median = (a) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];

// khung bao của các điểm alpha > t trong vùng tìm
function bbox(x0, y0, x1, y1, t) {
  let a = Infinity, b = Infinity, c = -1, d = -1;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (A(x, y) > t) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  return { x0: a, y0: b, x1: c + 1, y1: d + 1 };
}
// từ 1 điểm trong ô trong suốt, đi tới khi gặp nhựa (alpha > t)
function run(x, y, dx, dy, t = 8) {
  while (x > 0 && y > 0 && x < W - 1 && y < H - 1 && A(x, y) <= t) { x += dx; y += dy; }
  return dx ? x : y;
}
// ô trong suốt chứa điểm (sx, sy): lấy trung vị trên vài hàng / cột để tránh các mấu giữ bìa
function windowAt(sx, sy, spread) {
  const rows = [-spread, 0, spread].map((o) => sy + Math.round(o * K));
  const cols = [-spread, 0, spread].map((o) => sx + Math.round(o * K));
  return {
    x0: median(rows.map((y) => run(sx, y, -1, 0))) + 1, x1: median(rows.map((y) => run(sx, y, 1, 0))),
    y0: Math.min(...cols.map((x) => run(x, sy, 0, -1))) + 1, y1: Math.max(...cols.map((x) => run(x, sy, 0, 1))),
  };
}
const S = (v) => Math.round(v * K);
const PAD = S(4);

// ---------- 3 vật thể ----------
const zoneA = bbox(0, 0, S(540), S(528), 8);              // hộp đóng A (kèm bóng có sẵn)
const zoneO = bbox(0, S(528), W, H, 8);                   // hộp mở có đĩa
const caseA = bbox(zoneA.x0, zoneA.y0, zoneA.x1, zoneA.y1, 150); // thân hộp (không tính bóng mờ)
const caseO = bbox(zoneO.x0, zoneO.y0, zoneO.x1, zoneO.y1, 150);
const crop = (z) => ({ left: Math.max(0, z.x0 - PAD), top: Math.max(0, z.y0 - PAD), width: Math.min(W, z.x1 + PAD) - Math.max(0, z.x0 - PAD), height: Math.min(H, z.y1 + PAD) - Math.max(0, z.y0 - PAD) });
const cA = crop(zoneA), cO = crop(zoneO);

// ô bìa hộp đóng (dò từ giữa thân hộp, lệch phải khỏi bản lề)
const winA = windowAt(Math.round((caseA.x0 + caseA.x1) / 2 + S(20)), Math.round((caseA.y0 + caseA.y1) / 2), 40);

// ---------- đĩa trong hộp mở ----------
let cx = S(765), cy = S(724);
const edge = (x, y, dx, dy) => { let r = 0; while (A(x + dx * r, y + dy * r) > 200 || r < S(70)) r++; return r; }; // vượt qua hub rồi tìm mép đĩa (alpha đặc)
for (let k = 0; k < 2; k++) { // tinh chỉnh tâm theo mép trái / phải / trên / dưới
  const l = edge(cx, cy, -1, 0), r = edge(cx, cy, 1, 0), u = edge(cx, cy, 0, -1), d = edge(cx, cy, 0, 1);
  cx += Math.round((r - l) / 2); cy += Math.round((d - u) / 2);
}
// trên / dưới đĩa dính mép khay (nhựa đặc) → lấy bán kính nhỏ nhất (mép trái / phải)
const rOut = Math.min(edge(cx, cy, -1, 0), edge(cx, cy, 1, 0), edge(cx, cy, 0, -1), edge(cx, cy, 0, 1));
// vòng hub xám đậm: đi từ tâm ra, tìm đoạn tối (độ sáng < 130)
// lấy đoạn tối DÀI NHẤT trên mỗi hướng (bỏ qua chấm nhiễu)
function hubRing(dx, dy) {
  let best = [-1, -1], start = -1;
  for (let r = 1; r < rOut * 0.6; r++) {
    const x = Math.round(cx + dx * r), y = Math.round(cy + dy * r);
    const dark = A(x, y) > 150 && L(x, y) < 130;
    if (dark && start < 0) start = r;
    if (!dark && start >= 0) { if (r - start > best[1] - best[0]) best = [start, r]; start = -1; }
  }
  return best;
}
const rings = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071]].map(([dx, dy]) => hubRing(dx, dy));
const hubR = median(rings.map((r) => r[0])), printIn = median(rings.map((r) => r[1]));

// ô nắp trong (nửa trái) + ô khay (nửa phải, quanh đĩa)
const midX = Math.round((caseO.x0 + caseO.x1) / 2);
const winLid = windowAt(Math.round((caseO.x0 + midX) / 2), Math.round((caseO.y0 + caseO.y1) / 2), 60);
// điểm dò nằm trong ô khay nhưng ngoài đĩa: gần góc trên trái / trên phải / dưới trái của đĩa
const tyTop = Math.round(cy - rOut * 0.85), tyBot = Math.round(cy + rOut * 0.85);
const txL = Math.round(cx - rOut * 0.8), txR = Math.round(cx + rOut * 0.8);
const winTray = {
  x0: median([run(txL, tyTop, -1, 0), run(txL, tyBot, -1, 0)]) + 1, x1: median([run(txR, tyTop, 1, 0), run(txR, tyBot, 1, 0)]),
  y0: median([run(txL, tyTop, 0, -1), run(txR, tyTop, 0, -1)]) + 1, y1: median([run(txL, tyBot, 0, 1), run(txR, tyBot, 0, 1)]),
};

// ---------- xuất sprite ----------
const src = sharp(`${DIR}/cd-sheet.png`);
await src.clone().extract(cA).png().toFile(`${DIR}/closed.png`);
await src.clone().extract(cO).png().toFile(`${DIR}/open.png`);
const dr = rOut + S(2), dSize = dr * 2;
const mask = Buffer.from(`<svg width="${dSize}" height="${dSize}"><circle cx="${dr}" cy="${dr}" r="${rOut + 0.5}" fill="#fff"/></svg>`);
await src.clone().extract({ left: cx - dr, top: cy - dr, width: dSize, height: dSize })
  .composite([{ input: mask, blend: "dest-in" }]).png().toFile(`${DIR}/disc.png`);

// toạ độ 0..1 trong từng sprite (bán kính chia theo chiều rộng sprite)
const rel = (r, c) => ({ x0: (r.x0 - c.left) / c.width, y0: (r.y0 - c.top) / c.height, x1: (r.x1 - c.left) / c.width, y1: (r.y1 - c.top) / c.height });
const sheet = {
  source: { width: W, height: H },
  closed: { width: cA.width, height: cA.height, case: rel(caseA, cA), cover: rel(winA, cA) },
  open: {
    width: cO.width, height: cO.height, case: rel(caseO, cO), lid: rel(winLid, cO), tray: rel(winTray, cO),
    disc: { cx: (cx - cO.left) / cO.width, cy: (cy - cO.top) / cO.height, r: rOut / cO.width, printIn: printIn / cO.width, hub: hubR / cO.width },
  },
  disc: { width: dSize, height: dSize, cx: 0.5, cy: 0.5, r: rOut / dSize, printIn: printIn / dSize, hub: hubR / dSize },
};
writeFileSync(`${DIR}/sheet.json`, JSON.stringify(sheet, null, 2) + "\n");
console.log(JSON.stringify({ zoneA, caseA, winA, zoneO, caseO, winLid, winTray, disc: { cx, cy, rOut, printIn, hubR } }));
