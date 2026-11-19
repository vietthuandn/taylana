"use client";
/* Bàn in — "Danh sách soạn hàng": PDF A4 dạng bảng (STT, username, mã đơn, gói, món lẻ, số lượng, ô tick Đã in,
   ô tick Đã đóng gói), xếp đúng thứ tự in. Vẽ bằng canvas (chữ tiếng Việt đầy đủ, không cần nhúng font) → mỗi trang 1 ảnh. */
import { PDFDocument } from "pdf-lib";
import type { Step } from "./layout";
import type { Addon, Order, Pack } from "./types";

const A4 = { w: 210, h: 297 }, DPI = 150, PX = DPI / 25.4, MM = 72 / 25.4;
/** thứ tự in: theo lần đầu đơn xuất hiện trong các bước; đơn không có bước thì theo số thứ tự */
export function printOrder(orders: Order[], sections: { steps: Step[] }[]) {
  const seen: string[] = [];
  for (const s of sections) for (const st of s.steps) for (const id of st.orderIds) if (!seen.includes(id)) seen.push(id);
  return [...orders].sort((a, b) => { const i = seen.indexOf(a.id), j = seen.indexOf(b.id); return (i < 0 ? 1e6 + a.seq : i) - (j < 0 ? 1e6 + b.seq : j); });
}
export async function pickingListPdf(orders: Order[], packs: Pack[], addons: Addon[], sections: { steps: Step[] }[], title = "Danh sách soạn hàng") {
  const list = printOrder(orders, sections);
  const doc = await PDFDocument.create();
  const cols: [string, number][] = [["STT", 11], ["Username", 36], ["Mã đơn", 30], ["Gói", 40], ["Món lẻ", 47], ["SL", 9], ["Đã in", 12], ["Đóng gói", 15]];
  const rowH = 9, top = 24, perPage = Math.floor((A4.h - top - 12) / rowH) - 1;
  const addonText = (o: Order) => { const m = new Map<string, number>(); for (const id of o.addons) m.set(id, (m.get(id) ?? 0) + 1); return [...m].map(([id, n]) => `${addons.find((a) => a.id === id)?.name ?? "?"}${n > 1 ? ` ×${n}` : ""}`).join(", "); };
  for (let p = 0; p < Math.max(1, Math.ceil(list.length / perPage)); p++) {
    const c = document.createElement("canvas"); c.width = Math.round(A4.w * PX); c.height = Math.round(A4.h * PX);
    const x = c.getContext("2d")!; x.scale(PX, PX); x.fillStyle = "#fff"; x.fillRect(0, 0, A4.w, A4.h);
    x.fillStyle = "#18181b"; x.font = `600 5.5px "Be Vietnam Pro", Arial, sans-serif`; x.fillText(title, 10, 14);
    x.font = `3px "Be Vietnam Pro", Arial, sans-serif`; x.fillStyle = "#71717a"; x.fillText(`${list.length} đơn · trang ${p + 1}/${Math.max(1, Math.ceil(list.length / perPage))} · ${new Date().toLocaleString("vi-VN")}`, 10, 19);
    const cell = (t: string, cx: number, y: number, w: number, bold = false) => {
      x.font = `${bold ? "600 " : ""}3.1px "Be Vietnam Pro", Arial, sans-serif`;
      let s = t; while (s.length > 1 && x.measureText(s).width > w - 2) s = s.slice(0, -2) + "…";
      x.fillText(s, cx + 1, y + rowH / 2 + 1.1);
    };
    let y = top;
    x.fillStyle = "#f4f4f5"; x.fillRect(10, y, 190, rowH); x.fillStyle = "#18181b";
    let cx = 10; for (const [h, w] of cols) { cell(h, cx, y, w, true); cx += w; }
    y += rowH;
    for (const o of list.slice(p * perPage, (p + 1) * perPage)) {
      const vals = [String(o.seq), o.username, o.order_code, packs.find((k) => k.id === o.package_id)?.name ?? (o.unresolved ? "Chưa xác định" : "—"), addonText(o), String(o.qty)];
      cx = 10; x.fillStyle = "#18181b";
      vals.forEach((v, i) => { cell(v, cx, y, cols[i][1]); cx += cols[i][1]; });
      x.strokeStyle = "#52525b"; x.lineWidth = 0.25;
      for (const w of [cols[6][1], cols[7][1]]) { x.strokeRect(cx + w / 2 - 2.2, y + rowH / 2 - 2.2, 4.4, 4.4); cx += w; }
      x.strokeStyle = "#e4e4e7"; x.beginPath(); x.moveTo(10, y + rowH); x.lineTo(200, y + rowH); x.stroke();
      y += rowH;
    }
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    const img = await doc.embedPng(new Uint8Array(await blob!.arrayBuffer()));
    doc.addPage([A4.w * MM, A4.h * MM]).drawImage(img, { x: 0, y: 0, width: A4.w * MM, height: A4.h * MM });
  }
  return doc.save();
}
