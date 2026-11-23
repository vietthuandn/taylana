/* Tài chính · đọc file Excel của Shopee TRÊN TRÌNH DUYỆT (SheetJS), không gửi file lên server.
   Tự nhận loại file theo tên sheet + tiêu đề cột:
   · income  — Báo cáo Income: sheet "Doanh thu" (dòng Order + dòng Sku), "Service Fee Details" gộp vào đơn
   · balance — My Balance: sheet "Transaction Report" (bảng chi tiết bắt đầu ở dòng có "Ngày", "Loại giao dịch")
   · orders  — File xuất đơn (Order.all / Order.completed…): cột "Mã đơn hàng" + "Tên phân loại hàng"
   Đọc theo TÊN CỘT (không phân biệt hoa thường, dấu). */

export type FileKind = "income" | "balance" | "orders";
export type ShopeeOrder = {
  order_sn: string; order_date: string | null; paid_at: string | null; buyer: string | null;
  total_paid: number | null; product_price: number | null; refund: number | null; amount_paid_by_buyer: number | null; tx_fee_rate: number | null; carrier: string | null;
  fees: Record<string, number>; service_fees: Record<string, number>; raw: Record<string, unknown> | null; service_raw: Record<string, unknown> | null; source_file: string;
};
export type ShopeeItem = { order_sn: string; product_id: string; seq: number; product_name: string | null; product_price: number | null; refund: number | null; raw: Record<string, unknown> };
export type ShopeeLine = { order_sn: string; seq: number; product_name: string | null; variation: string | null; variation_sku: string | null; qty: number | null; price: number | null; raw: Record<string, unknown> };
export type WalletTx = { tx_at: string; tx_type: string; detail: string | null; order_sn: string; direction: string | null; amount: number; status: string | null; balance_after: number | null; is_withdrawal: boolean; raw: Record<string, unknown> };
export type Parsed =
  | { kind: "income"; file: string; orders: ShopeeOrder[]; items: ShopeeItem[]; errors: string[] }
  | { kind: "balance"; file: string; tx: WalletTx[]; errors: string[] }
  | { kind: "orders"; file: string; lines: ShopeeLine[]; errors: string[] };

/** chuẩn hoá tên cột: thường, bỏ dấu, đ→d, bỏ ký tự lạ */
export const fold = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
type Grid = unknown[][];

/** số tiền Shopee: "1.234.567", "-12,500", 12500, "(1.000)" → number */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/vn[dđ]|[₫đ\s]/gi, "");
  if (!s || s === "-") return null;
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()\-+]/g, "");
  if (!/^[\d.,]+$/.test(s)) return null;
  if (s.includes(".") && s.includes(",")) {
    // 1.234.567,89 hoặc 1,234,567.89: dấu xuất hiện SAU CÙNG là dấu thập phân, dấu kia là phân cách nghìn
    const dec = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    s = s.split(dec === "," ? "." : ",").join("").replace(dec, ".");
  } else if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, ""); // 82.000 · 1.234.567 (Excel dạng chữ, chấm phân cách nghìn)
  else s = s.replace(",", "."); // 12,5 · 12.5
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}
/** ô trông như MÃ (mã số thuế, số điện thoại, mã đơn…): chuỗi chỉ gồm chữ số, ≥ 9 ký tự, không có dấu phân cách — không phải tiền */
const isCode = (v: unknown) => typeof v === "string" ? /^\d{9,}$/.test(v.trim()) : typeof v === "number" && Number.isInteger(v) && Math.abs(v) >= 1e9;
/** số tiền của 1 ô phí (bỏ ô trông như mã) */
const money = (v: unknown) => (isCode(v) ? null : num(v));
/** ngày giờ Shopee (giờ Việt Nam): "2025-05-01 10:22", "01/05/2025 10:22:33", số ngày Excel → ISO có +07:00 */
export function date(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (typeof v === "number") { // ngày Excel
    const ms = Math.round((v - 25569) * 86400000), d = new Date(ms);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+07:00`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}T${pad(+(m[4] ?? 0))}:${m[5] ?? "00"}:${m[6] ?? "00"}+07:00`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}T${pad(+(m[4] ?? 0))}:${m[5] ?? "00"}:${m[6] ?? "00"}+07:00`;
  return null;
}
const str = (v: unknown) => { const s = String(v ?? "").trim(); return s || null; };

/** bảng: tìm dòng tiêu đề (dòng đầu tiên chứa đủ các cột bắt buộc), trả về tiêu đề + các dòng dữ liệu */
function table(g: Grid, need: string[], maxScan = 30) {
  for (let i = 0; i < Math.min(g.length, maxScan); i++) {
    const h = (g[i] ?? []).map(fold);
    if (need.every((n) => h.some((c) => c === n || c.includes(n)))) return { head: (g[i] ?? []).map((c) => String(c ?? "").trim()), rows: g.slice(i + 1), at: i };
  }
  return null;
}
/** tìm cột theo tên: ưu tiên TRÙNG KHỚP, rồi cột chứa cụm; exclude = bỏ cột chứa các cụm này */
function col(head: string[], names: string[], exclude: string[] = []) {
  const h = head.map(fold);
  for (const n of names.map(fold)) { const i = h.findIndex((c) => c === n); if (i >= 0) return i; }
  for (const n of names.map(fold)) { const i = h.findIndex((c) => c.includes(n) && !exclude.some((x) => c.includes(fold(x)))); if (i >= 0) return i; }
  return -1;
}
const obj = (head: string[], r: unknown[]) => Object.fromEntries(head.map((h, i) => [h || `Cột ${i + 1}`, r[i] ?? null]).filter(([, v]) => v !== null && v !== ""));
const at = (r: unknown[], i: number) => (i >= 0 ? r[i] : null);
const sheetOf = (names: string[], want: string) => names.find((n) => fold(n) === fold(want)) ?? names.find((n) => fold(n).includes(fold(want)));

// ---------- các khoản phí người bán chịu (Income · sheet Doanh thu) ----------
/** cột là PHÍ SÀN (lấy trị tuyệt đối) */
const FEE_KEYS = ["phi co dinh", "phi dich vu", "phi xu ly giao dich", "phi thanh toan", "hoa hong", "piship", "thue gtgt", "thue tncn", "thue"];
// bỏ cột MÃ / SỐ (vd. "Mã số thuế" chứa chữ "thue" — từng làm phí sàn thành hàng tỉ), cột tỉ lệ %
const notFee = (c: string) => /^ma\b|\bma so\b|\bso dien thoai\b|\bid\b|\bty le\b|\brate\b|%/.test(c) || c.includes("van chuyen");
const isFee = (c: string) => FEE_KEYS.some((k) => c.includes(k)) && !notFee(c);
/** mã ưu đãi / hoàn xu do người bán chịu */
const isSellerVoucher = (c: string) => (c.includes("ma uu dai") || c.includes("hoan xu") || c.includes("voucher")) && (c.includes("nguoi ban") || c.includes("seller"));
/** các cột phí vận chuyển (cộng lại: âm = người bán chịu) */
const isShip = (c: string) => c.includes("phi van chuyen") || c.includes("phi tra hang") || c.includes("shipping");

export async function parseShopeeFile(file: File): Promise<Parsed> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const names = wb.SheetNames;
  const grid = (n: string) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "", raw: true }) as Grid;
  const errors: string[] = [];

  // ---------- Income ----------
  const sRev = sheetOf(names, "Doanh thu");
  if (sRev && (sheetOf(names, "Summary") || sheetOf(names, "Service Fee Details") || names.length >= 2)) {
    const t = table(grid(sRev), ["ma don hang"]);
    if (!t) throw new Error(`"${file.name}": không thấy cột "Mã đơn hàng" ở sheet Doanh thu.`);
    const { head, rows } = t, H = head.map(fold);
    const c = {
      sn: col(head, ["Mã đơn hàng"]), pid: col(head, ["Mã sản phẩm"]), name: col(head, ["Tên sản phẩm"]), od: col(head, ["Ngày đặt hàng"]), paid: col(head, ["Ngày hoàn thành thanh toán"]),
      total: col(head, ["Tổng tiền đã thanh toán"]), price: col(head, ["Giá sản phẩm"]), refund: col(head, ["Số tiền hoàn lại"]), buyer: col(head, ["Người Mua", "Tên người mua"], ["phi", "tra"]),
      apb: col(head, ["Amount Paid By Buyer"]), rate: col(head, ["Transaction Fee Rate (%)", "Transaction Fee Rate"]), carrier: col(head, ["Đơn vị vận chuyển"]),
    };
    const feeCols = H.map((h, i) => (isFee(h) || isSellerVoucher(h) ? i : -1)).filter((i) => i >= 0);
    const shipCols = H.map((h, i) => (isShip(h) && !isFee(h) ? i : -1)).filter((i) => i >= 0);
    // cột loại dòng: ô có giá trị "Order" / "Sku"
    const kindOf = (r: unknown[]) => { for (const v of r.slice(0, 4)) { const f = fold(v); if (f === "order" || f === "sku") return f; } return null; };
    const orders = new Map<string, ShopeeOrder>(), items: ShopeeItem[] = [], seqOf = new Map<string, number>();
    let lastSn = "";
    rows.forEach((r, ri) => {
      if (!r.some((v) => v !== "" && v !== null)) return;
      const k = kindOf(r);
      const sn = str(at(r, c.sn)) ?? (k === "sku" ? lastSn : null);
      if (!sn) { if (k) errors.push(`Doanh thu dòng ${t.at + ri + 2}: thiếu mã đơn hàng`); return; }
      if (k === "sku") {
        const s = (seqOf.get(sn) ?? 0) + 1; seqOf.set(sn, s);
        items.push({ order_sn: sn, product_id: str(at(r, c.pid)) ?? "", seq: s, product_name: str(at(r, c.name)), product_price: num(at(r, c.price)), refund: num(at(r, c.refund)), raw: obj(head, r) });
        return;
      }
      lastSn = sn;
      const fees: Record<string, number> = {};
      for (const i of feeCols) { const v = money(r[i]); if (v) fees[head[i]] = Math.abs(v); }
      const ship = shipCols.reduce((a, i) => a + (num(r[i]) ?? 0), 0);
      if (ship < 0) fees["Phí ship người bán chịu"] = Math.abs(ship);
      orders.set(sn, {
        order_sn: sn, order_date: date(at(r, c.od)), paid_at: date(at(r, c.paid)), buyer: str(at(r, c.buyer)),
        total_paid: num(at(r, c.total)), product_price: num(at(r, c.price)), refund: num(at(r, c.refund)), amount_paid_by_buyer: num(at(r, c.apb)), tx_fee_rate: num(at(r, c.rate)), carrier: str(at(r, c.carrier)),
        fees, service_fees: {}, raw: obj(head, r), service_raw: null, source_file: file.name,
      });
    });
    // Service Fee Details → gộp vào đơn
    const sSvc = sheetOf(names, "Service Fee Details");
    if (sSvc) {
      const st = table(grid(sSvc), ["ma don hang"]);
      if (st) {
        const si = col(st.head, ["Mã đơn hàng"]);
        for (const r of st.rows) {
          const sn = str(at(r, si)); if (!sn) continue;
          const o = orders.get(sn);
          if (!o) { errors.push(`Service Fee Details: đơn ${sn} không có ở sheet Doanh thu`); continue; }
          const sf: Record<string, number> = {};
          st.head.forEach((h, i) => { if (i === si) return; const v = num(r[i]); if (v && !isCode(r[i]) && !notFee(fold(h)) && !/\bngay\b|\bdate\b/.test(fold(h))) sf[h] = Math.abs(v); });
          o.service_fees = sf; o.service_raw = obj(st.head, r);
        }
      }
    }
    return { kind: "income", file: file.name, orders: [...orders.values()], items, errors };
  }

  // ---------- My Balance ----------
  const sTx = sheetOf(names, "Transaction Report");
  if (sTx) {
    const t = table(grid(sTx), ["ngay", "loai giao dich"], 60);
    if (!t) throw new Error(`"${file.name}": không thấy bảng chi tiết (cột "Ngày", "Loại giao dịch").`);
    const { head, rows } = t;
    const c = {
      d: col(head, ["Ngày"]), type: col(head, ["Loại giao dịch"]), detail: col(head, ["Mô tả", "Chi tiết"]), sn: col(head, ["Mã đơn hàng"]), dir: col(head, ["Dòng tiền"]),
      amt: col(head, ["Số tiền"], ["so du"]), status: col(head, ["Trạng thái"]), bal: col(head, ["Số dư sau giao dịch", "Số dư"]),
    };
    const tx: WalletTx[] = [];
    rows.forEach((r, ri) => {
      if (!r.some((v) => v !== "" && v !== null)) return;
      const d = date(at(r, c.d)), a = num(at(r, c.amt));
      if (!d || a === null) { errors.push(`Transaction Report dòng ${t.at + ri + 2}: thiếu ngày hoặc số tiền`); return; }
      const dir = str(at(r, c.dir)), type = str(at(r, c.type)) ?? "";
      const out = dir ? /ra|out/.test(fold(dir)) : a < 0;
      tx.push({ tx_at: d, tx_type: type, detail: str(at(r, c.detail)), order_sn: str(at(r, c.sn)) ?? "", direction: dir, amount: out ? -Math.abs(a) : Math.abs(a),
        status: str(at(r, c.status)), balance_after: num(at(r, c.bal)), is_withdrawal: fold(type).includes("rut tien"), raw: obj(head, r) });
    });
    return { kind: "balance", file: file.name, tx, errors };
  }

  // ---------- File xuất đơn ----------
  for (const n of names) {
    const t = table(grid(n), ["ma don hang", "ten phan loai hang"]);
    if (!t) continue;
    const { head, rows } = t;
    const c = {
      sn: col(head, ["Mã đơn hàng"]), name: col(head, ["Tên sản phẩm"]), vari: col(head, ["Tên phân loại hàng"]), vsku: col(head, ["SKU phân loại hàng"]),
      qty: col(head, ["Số lượng"], ["tra"]), deal: col(head, ["Giá ưu đãi"]), price: col(head, ["Giá gốc"]),
    };
    const lines: ShopeeLine[] = [], seqOf = new Map<string, number>();
    rows.forEach((r, ri) => {
      if (!r.some((v) => v !== "" && v !== null)) return;
      const sn = str(at(r, c.sn));
      if (!sn) { errors.push(`${n} dòng ${t.at + ri + 2}: thiếu mã đơn hàng`); return; }
      const s = (seqOf.get(sn) ?? 0) + 1; seqOf.set(sn, s);
      lines.push({ order_sn: sn, seq: s, product_name: str(at(r, c.name)), variation: str(at(r, c.vari)), variation_sku: str(at(r, c.vsku)), qty: num(at(r, c.qty)), price: num(at(r, c.deal)) ?? num(at(r, c.price)), raw: obj(head, r) });
    });
    return { kind: "orders", file: file.name, lines, errors };
  }
  throw new Error(`"${file.name}": không nhận ra loại file (cần Báo cáo Income, My Balance hoặc file xuất đơn hàng Shopee).`);
}
