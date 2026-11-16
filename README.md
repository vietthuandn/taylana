# Tiệm In Taylana

Web của Tiệm In Taylana. Dùng Next.js 16, Tailwind CSS 4 và Supabase.

## Cấu trúc thư mục

| Thư mục | Chứa gì |
|---|---|
| `app/(site)/` | Các trang cho khách (trang chủ, đặt đơn, nộp file...) |
| `app/admin/` | Trang quản trị (`/admin`) |
| `app/globals.css` | **Bảng màu và font**. Muốn đổi màu thì sửa khối `@theme` |
| `components/decor/` | Hoạ tiết SVG vẽ tay (CD, nốt nhạc, sao, hoa) và viền ren |
| `lib/supabase/` | Kết nối Supabase |
| `supabase/schema.sql` | Toàn bộ database, quyền truy cập và kho file |

## Cài đặt Supabase (làm 1 lần)

### 1. Chạy schema
1. Vào https://supabase.com/dashboard và mở project.
2. Ở menu trái, bấm **SQL Editor**, rồi bấm **New query** (hoặc dấu **+**).
3. Mở file `supabase/schema.sql` trên GitHub, bấm nút **Copy raw file** rồi dán vào ô soạn thảo.
4. Bấm **Run** (hoặc Ctrl/Cmd + Enter). Kết quả hiện `Success. No rows returned` là được.
   - Nếu Supabase hỏi xác nhận về "destructive operation", bấm **Run this query**. File này không xoá dữ liệu: nó chỉ tạo lại các quy tắc truy cập.

### 2. Tạo tài khoản admin đầu tiên
1. Ở menu trái, bấm **Authentication**, chọn **Users**.
2. Bấm **Add user** rồi chọn **Create new user**.
3. Nhập email và mật khẩu, **tích chọn "Auto Confirm User"**, rồi bấm **Create user**.
4. Quay lại **SQL Editor**, chạy câu lệnh sau (đổi email thành email của bạn):
   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'email-cua-ban@gmail.com';
   ```
   Kết quả hiện `Success. 1 rows affected` là được.
5. Mở `<địa chỉ web>/admin`, đăng nhập bằng email và mật khẩu vừa tạo.

### 3. Tắt đăng ký tự do (khuyên làm)
Vào **Authentication**, chọn **Sign In / Providers**, tắt **Allow new users to sign up**, rồi bấm **Save**.
Kể cả không tắt, người lạ đăng ký được cũng không vào được admin. Tắt đi thì sạch hơn.

## Chạy trên máy (tuỳ chọn)
```bash
npm install
cp .env.example .env.local   # rồi điền URL và publishable key của Supabase
npm run dev                  # mở http://localhost:3000
```

## Bảo mật
- Web chỉ dùng **publishable key**. Không bao giờ đưa `service_role` key vào code.
- Khách chỉ được tạo đơn (qua hàm `create_order`) và upload file vào bucket riêng tư `order-files` (jpg, png, pdf, tối đa 30MB). Khách không xem được đơn hay file của bất kỳ ai.
