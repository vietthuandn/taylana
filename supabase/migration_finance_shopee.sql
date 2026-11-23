-- Tài chính · Phần 1: dữ liệu Shopee (Income, My Balance, file xuất đơn) + lịch sử nhập.
-- Đọc file Excel trên trình duyệt, ghi thẳng vào đây. CHỈ admin được đọc / ghi (RLS, hàm is_admin()).

create table if not exists public.shopee_orders (
  order_sn text primary key,                 -- Mã đơn hàng
  order_date timestamptz,                    -- Ngày đặt hàng
  paid_at timestamptz,                       -- Ngày hoàn thành thanh toán
  buyer text,                                -- Người Mua
  total_paid numeric,                        -- Tổng tiền đã thanh toán (tiền Shopee trả người bán)
  product_price numeric,                     -- Giá sản phẩm (doanh thu trước phí)
  refund numeric,                            -- Số tiền hoàn lại
  amount_paid_by_buyer numeric,              -- Amount Paid By Buyer
  tx_fee_rate numeric,                       -- Transaction Fee Rate (%)
  carrier text,                              -- Đơn vị vận chuyển
  fees jsonb not null default '{}'::jsonb,   -- các khoản phí (số dương = người bán chịu): tên cột → số tiền
  service_fees jsonb not null default '{}'::jsonb, -- sheet Service Fee Details: Phí Hạ Tầng, Voucher Xtra...
  raw jsonb,                                 -- toàn bộ dòng "Order" gốc
  service_raw jsonb,                         -- dòng gốc ở Service Fee Details
  source_file text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shopee_orders_date_idx on public.shopee_orders (order_date);

create table if not exists public.shopee_order_items (
  id bigint generated always as identity primary key,
  order_sn text not null,
  product_id text not null default '',       -- Mã sản phẩm
  seq int not null,                          -- thứ tự dòng Sku trong đơn
  product_name text,
  product_price numeric,
  refund numeric,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_sn, product_id, seq)
);
create index if not exists shopee_order_items_sn_idx on public.shopee_order_items (order_sn);

create table if not exists public.shopee_order_lines (
  id bigint generated always as identity primary key,
  order_sn text not null,
  seq int not null,                          -- thứ tự dòng trong đơn (file xuất đơn)
  product_name text,                         -- Tên sản phẩm
  variation text,                            -- Tên phân loại hàng
  variation_sku text,                        -- SKU phân loại hàng
  qty numeric,                               -- Số lượng
  price numeric,                             -- giá (giá ưu đãi, không có thì giá gốc)
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_sn, seq)
);
create index if not exists shopee_order_lines_sn_idx on public.shopee_order_lines (order_sn);

create table if not exists public.shopee_wallet_tx (
  id bigint generated always as identity primary key,
  tx_at timestamptz not null,                -- Ngày (giờ) giao dịch
  tx_type text not null default '',          -- Loại giao dịch
  detail text,                               -- Mô tả / chi tiết
  order_sn text not null default '',         -- Mã đơn ('' nếu không có)
  direction text,                            -- Dòng tiền (Tiền vào / Tiền ra)
  amount numeric not null,                   -- số tiền (âm = tiền ra)
  status text,                               -- Trạng thái
  balance_after numeric,                     -- Số dư sau giao dịch
  is_withdrawal boolean not null default false, -- Rút tiền: KHÔNG tính vào thu nhập
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (tx_at, tx_type, order_sn, amount)
);
create index if not exists shopee_wallet_tx_sn_idx on public.shopee_wallet_tx (order_sn);

create table if not exists public.finance_imports (
  id bigint generated always as identity primary key,
  file_name text not null,
  kind text not null,                        -- income · balance · orders
  new_count int not null default 0,
  update_count int not null default 0,
  dup_count int not null default 0,
  err_count int not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- RLS: chỉ admin
do $$
declare t text;
begin
  foreach t in array array['shopee_orders','shopee_order_items','shopee_order_lines','shopee_wallet_tx','finance_imports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s admin all" on public.%I', t, t);
    execute format('create policy "%s admin all" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;
