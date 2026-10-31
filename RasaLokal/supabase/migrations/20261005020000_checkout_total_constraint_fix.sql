alter table public.orders
  drop constraint if exists orders_check,
  drop constraint if exists orders_total_amount_check;