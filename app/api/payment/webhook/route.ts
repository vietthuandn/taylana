// Webhook thanh toán — MỨC 2 (CHƯA HỖ TRỢ, hiện chỉ trả 501).
//
// Sau này gắn SePay (hoặc payOS) để tự xác nhận tiền vào:
// 1. Kiểm tra chữ ký / API key trong header (biến môi trường SEPAY_WEBHOOK_KEY — KHÔNG để ở trình duyệt).
// 2. Đọc nội dung chuyển khoản, tìm mã thanh toán dạng <TIỀN TỐ><SỐ ĐƠN> (ví dụ TAYLANA1024) → tìm đơn theo orders.payment_code.
// 3. So số tiền nhận được với orders.amount_due / orders.total.
// 4. Tạo 1 dòng public.payments (source = 'sepay', bank_txn_id = mã giao dịch ngân hàng — chỉ mục unique chống ghi trùng,
//    raw = dữ liệu gốc) và cập nhật orders.payment_status = 'paid' hoặc 'deposited', paid_amount, payment_log.
//    Việc ghi này cần quyền server (Supabase service role hoặc 1 hàm RPC riêng có kiểm tra khoá bí mật).
// 5. Trang /thanh-toan/[mã đơn] của khách tự kiểm tra trạng thái mỗi 10 giây nên sẽ tự hiện "Thanh toán thành công".
export async function POST() {
  return Response.json({ ok: false, error: "Chưa hỗ trợ tự xác nhận thanh toán (webhook)." }, { status: 501 });
}

export async function GET() {
  return Response.json({ ok: false, error: "Chưa hỗ trợ." }, { status: 501 });
}
