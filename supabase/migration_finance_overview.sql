-- Tài chính · Phần 4: Tổng quan tài chính — tính toán HOÀN TOÀN trong Supabase (view + hàm RPC), trình duyệt chỉ vẽ biểu đồ.
-- Tuần bắt đầu thứ Hai, ngày theo giờ Asia/Ho_Chi_Minh. CHỈ admin (security invoker → RLS của bảng gốc: is_admin()).
-- Chạy SAU migration_finance_shopee.sql, migration_finance_costs.sql, migration_finance_offline.sql.

-- ngày bắt đầu tính lãi lỗ: { "date": "YYYY-MM-DD" } · trống = ngày của LẦN NHẬP NGUYÊN LIỆU ĐẦU TIÊN
insert into public.finance_settings (key, value) values ('profit_start', '{"date":null}'::jsonb) on conflict (key) do nothing;

create or replace function public.finance_profit_start() returns date language sql stable security invoker set search_path = public as $$
  select coalesce(nullif((select value->>'date' from public.finance_settings where key = 'profit_start'), '')::date,
                  (select min(bought_on) from public.finance_purchases));
$$;

-- 1 dòng / đơn (Shopee + ngoài sàn)
create or replace view public.finance_order_facts with (security_invoker = true) as
with wal as (
  select order_sn, sum(amount) as amt, min(tx_at) as first_at
  from public.shopee_wallet_tx where order_sn <> '' and not is_withdrawal group by order_sn having bool_or(amount > 0)
), fee as (
  select o.order_sn,
    coalesce((select sum(abs(nullif(f.v, '')::numeric)) from jsonb_each_text(o.fees) f(k, v)), 0)
    + coalesce((select sum(abs(nullif(s.v, '')::numeric)) from jsonb_each_text(o.service_fees) s(k, v)
                where not exists (select 1 from jsonb_object_keys(o.fees) fk where lower(fk) = lower(s.k))), 0) as fee
  from public.shopee_orders o
), ln as (
  select m.order_sn, sum(m.qty * coalesce(rc.cost, 0)) as cogs,
    count(*) filter (where m.recipe_id is null and m.category_id is null) as unknown,
    (array_agg(m.recipe_id order by m.seq))[1] as recipe_id, (array_agg(m.category_id order by m.seq))[1] as category_id
  from public.finance_shopee_line_match m left join public.finance_recipe_cost rc on rc.recipe_id = m.recipe_id
  group by m.order_sn
), pk as (select public.finance_packaging_cost() as v)
select 'shopee'::text as channel, 'Shopee'::text as sub_channel, coalesce(o.order_sn, w.order_sn) as ref,
  (coalesce(o.paid_at, w.first_at) at time zone 'Asia/Ho_Chi_Minh')::date as day_paid,
  (coalesce(o.order_date, w.first_at) at time zone 'Asia/Ho_Chi_Minh')::date as day_placed,
  o.buyer as customer,
  coalesce(w.amt, o.total_paid, 0) as income, (w.amt is null) as income_estimated,
  o.product_price as revenue, coalesce(f.fee, 0) as fee,
  ln.recipe_id, ln.category_id, coalesce(ln.cogs, 0) as cogs, coalesce(ln.unknown, 0) as unknown_lines,
  pk.v as packaging,
  case when o.order_sn is null then 'wallet_only' when w.amt is null then 'pending'
       when o.total_paid is not null and abs(w.amt - o.total_paid) > 1 then 'mismatch' else 'paid' end as status
from public.shopee_orders o
full join wal w on w.order_sn = o.order_sn
left join fee f on f.order_sn = o.order_sn
left join ln on ln.order_sn = coalesce(o.order_sn, w.order_sn)
cross join pk
union all
select 'offline', x.channel, x.id::text, x.order_date, x.order_date, x.customer,
  x.amount, false, x.amount, 0,
  (select l.recipe_id from public.offline_order_lines l where l.order_id = x.id order by l.sort_order limit 1),
  x.category_id, x.cogs, 0, x.packaging_cost, 'paid'
from public.finance_offline_facts x;

-- các đơn trong khoảng ngày (đã lọc kênh, phân loại) + cờ "trong kỳ theo dõi chi phí" (tracked): trước ngày bắt đầu tính lãi → giá vốn, đóng gói, lãi = 0 / null
create or replace function public.finance_facts(p_from date, p_to date, p_channel text default 'all', p_category uuid default null, p_date_field text default 'paid')
returns table (channel text, sub_channel text, ref text, day date, customer text, income numeric, income_estimated boolean, revenue numeric, fee numeric,
  recipe_id uuid, recipe_name text, category_id uuid, category_name text, cogs numeric, packaging numeric, tracked boolean, profit numeric, status text, unknown_lines bigint)
language sql stable security invoker set search_path = public as $$
  with s as (select public.finance_profit_start() as ps)
  select f.channel, f.sub_channel, f.ref, d.day, f.customer, f.income, f.income_estimated, f.revenue, f.fee,
    f.recipe_id, r.name, f.category_id, c.name,
    case when t.tr then f.cogs else 0 end, case when t.tr then f.packaging else 0 end, t.tr,
    case when t.tr then f.income - f.cogs - f.packaging end, f.status, f.unknown_lines
  from public.finance_order_facts f
  cross join s
  cross join lateral (select case when p_date_field = 'order_date' and f.channel = 'shopee' then f.day_placed else f.day_paid end as day) d
  cross join lateral (select (s.ps is not null and d.day >= s.ps) as tr) t
  left join public.finance_recipes r on r.id = f.recipe_id
  left join public.finance_categories c on c.id = f.category_id
  where d.day between p_from and p_to
    and (coalesce(p_channel, 'all') = 'all' or f.channel = p_channel)
    and (p_category is null or f.category_id = p_category);
$$;

-- tổng hợp theo kỳ (day / week / month / quarter / year): thu nhập, doanh thu + phí sàn Shopee, số đơn, chi nguyên liệu, giá vốn, đóng gói, lãi
create or replace function public.finance_summary(p_from date, p_to date, p_group text default 'month', p_channel text default 'all', p_category uuid default null, p_date_field text default 'paid')
returns table (bucket date, income numeric, shopee_revenue numeric, shopee_fee numeric, shopee_orders bigint, offline_orders bigint,
  material numeric, cogs numeric, packaging numeric, profit numeric, untracked bigint)
language sql stable security invoker set search_path = public as $$
  with g as (select case when p_group in ('day', 'week', 'month', 'quarter', 'year') then p_group else 'month' end as u),
  f as (select * from public.finance_facts(p_from, p_to, p_channel, p_category, p_date_field)),
  a as (
    select date_trunc((select u from g), f.day::timestamp)::date as b,
      sum(f.income) as income, sum(f.revenue) filter (where f.channel = 'shopee') as rev, sum(f.fee) filter (where f.channel = 'shopee') as fee,
      count(*) filter (where f.channel = 'shopee') as so, count(*) filter (where f.channel = 'offline') as oo,
      sum(f.cogs) as cogs, sum(f.packaging) as pk, sum(f.profit) as profit, count(*) filter (where not f.tracked) as untracked
    from f group by 1
  ), m as (
    select date_trunc((select u from g), p.bought_on::timestamp)::date as b, sum(p.total) as material
    from public.finance_purchases p
    where p.bought_on between p_from and p_to and (p_category is null or p.category_id = p_category)
    group by 1
  )
  select coalesce(a.b, m.b), coalesce(a.income, 0), coalesce(a.rev, 0), coalesce(a.fee, 0), coalesce(a.so, 0), coalesce(a.oo, 0),
    coalesce(m.material, 0), coalesce(a.cogs, 0), coalesce(a.pk, 0), coalesce(a.profit, 0), coalesce(a.untracked, 0)
  from a full join m on m.b = a.b
  order by 1;
$$;

-- theo loại sản phẩm (công thức → phân loại → "Chưa rõ loại")
create or replace function public.finance_by_type(p_from date, p_to date, p_channel text default 'all', p_category uuid default null, p_date_field text default 'paid')
returns table (label text, orders bigint, revenue numeric, fee numeric, income numeric, cogs numeric, packaging numeric, profit numeric, tracked_income numeric)
language sql stable security invoker set search_path = public as $$
  select coalesce(f.recipe_name, f.category_name, 'Chưa rõ loại'), count(*), coalesce(sum(f.revenue), 0), coalesce(sum(f.fee), 0), sum(f.income),
    sum(f.cogs), sum(f.packaging), coalesce(sum(f.profit), 0), coalesce(sum(f.income) filter (where f.tracked), 0)
  from public.finance_facts(p_from, p_to, p_channel, p_category, p_date_field) f
  group by 1 order by sum(f.income) desc;
$$;

-- theo kênh: Shopee · Ngoài sàn (Facebook, Zalo…)
create or replace function public.finance_by_channel(p_from date, p_to date, p_channel text default 'all', p_category uuid default null, p_date_field text default 'paid')
returns table (label text, orders bigint, revenue numeric, fee numeric, income numeric, cogs numeric, packaging numeric, profit numeric, tracked_income numeric)
language sql stable security invoker set search_path = public as $$
  select case when f.channel = 'shopee' then 'Shopee' else 'Ngoài sàn · ' || f.sub_channel end, count(*), coalesce(sum(f.revenue), 0), coalesce(sum(f.fee), 0), sum(f.income),
    sum(f.cogs), sum(f.packaging), coalesce(sum(f.profit), 0), coalesce(sum(f.income) filter (where f.tracked), 0)
  from public.finance_facts(p_from, p_to, p_channel, p_category, p_date_field) f
  group by 1 order by sum(f.income) desc;
$$;

-- cảnh báo dữ liệu (toàn bộ, không theo kỳ)
create or replace function public.finance_alerts()
returns table (pending bigint, mismatch bigint, wallet_only bigint, unknown_lines bigint, profit_start date)
language sql stable security invoker set search_path = public as $$
  select (select count(*) from public.finance_order_facts where status = 'pending'),
         (select count(*) from public.finance_order_facts where status = 'mismatch'),
         (select count(*) from public.finance_order_facts where status = 'wallet_only'),
         (select count(*) from public.finance_shopee_line_match where recipe_id is null and category_id is null),
         public.finance_profit_start();
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'finance_profit_start()', 'finance_facts(date, date, text, uuid, text)', 'finance_summary(date, date, text, text, uuid, text)',
    'finance_by_type(date, date, text, uuid, text)', 'finance_by_channel(date, date, text, uuid, text)', 'finance_alerts()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
