-- Công thức giá vốn: thứ tự hiển thị + giá bán trên Shopee & % phí sàn (tính lãi / biên lãi từng công thức).
alter table public.finance_recipes add column if not exists sort_order int not null default 0;
alter table public.finance_recipes add column if not exists sale_price numeric;          -- giá bán trên Shopee
alter table public.finance_recipes add column if not exists fee_pct numeric not null default 30; -- % phí sàn áp dụng
