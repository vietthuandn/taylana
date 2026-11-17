// Tạo link ảnh QR chuyển khoản. Đổi nhà cung cấp QR thì chỉ sửa ở đây.
// Hiện dùng VietQR: https://img.vietqr.io/image/{BIN}-{SỐ_TK}-compact2.png?amount=&addInfo=&accountName=
export type QrInput = { bin: string; accountNo: string; accountName: string; amount: number; content: string };

export function buildQrUrl({ bin, accountNo, accountName, amount, content }: QrInput) {
  const q = new URLSearchParams();
  if (amount > 0) q.set("amount", String(Math.round(amount)));
  if (content) q.set("addInfo", content);
  if (accountName) q.set("accountName", accountName);
  return `https://img.vietqr.io/image/${encodeURIComponent(bin)}-${encodeURIComponent(accountNo.replace(/\s/g, ""))}-compact2.png?${q}`;
}
