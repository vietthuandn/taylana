// Cài đặt thanh toán QR (bảng site_settings, key "payment"). Đều là thông tin công khai.
export type PaymentSettings = {
  enabled: boolean;
  bank_bin: string;
  bank_name: string;
  account_no: string;
  account_name: string; // VIẾT HOA, không dấu
  prefix: string; // tiền tố nội dung chuyển khoản
  mode: "full" | "deposit";
  deposit_percent: number;
  deadline_hours: number;
  note: string;
};

export const defaultPayment: PaymentSettings = {
  enabled: false,
  bank_bin: "970436",
  bank_name: "Vietcombank",
  account_no: "",
  account_name: "",
  prefix: "TAYLANA",
  mode: "full",
  deposit_percent: 50,
  deadline_hours: 24,
  note: "Tiệm sẽ xác nhận trong vòng 30 phút giờ hành chính.",
};

export function mergePayment(v: unknown): PaymentSettings {
  const o = (v && typeof v === "object" ? v : {}) as Partial<PaymentSettings>;
  return {
    ...defaultPayment,
    ...o,
    enabled: !!o.enabled,
    mode: o.mode === "deposit" ? "deposit" : "full",
    deposit_percent: Number(o.deposit_percent) || defaultPayment.deposit_percent,
    deadline_hours: Number(o.deadline_hours) || defaultPayment.deadline_hours,
  };
}

// Tên chủ TK: viết HOA, bỏ dấu (đ → D), chỉ chữ/số/khoảng trắng
export const toAccountName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trimStart();
// Tiền tố: chữ HOA không dấu + số, không khoảng trắng
export const toPrefix = (s: string) => toAccountName(s).replace(/ /g, "");

// Đủ thông tin để hiện QR chưa
export const paymentReady = (p: PaymentSettings) => p.enabled && !!p.bank_bin && !!p.account_no.trim() && !!p.account_name.trim();

export type PaymentStatus = "unpaid" | "pending" | "deposited" | "paid" | "expired" | "cancelled";
export const paymentLabels: Record<PaymentStatus, string> = {
  unpaid: "Chưa thanh toán", pending: "Chờ xác nhận", deposited: "Đã cọc",
  paid: "Đã thanh toán", expired: "Hết hạn", cancelled: "Đã huỷ",
};
export const paymentTone = {
  unpaid: "gray", pending: "pink", deposited: "blue", paid: "green", expired: "amber", cancelled: "red",
} as const;
