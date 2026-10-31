do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'orders_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders drop constraint orders_status_check;
  end if;
end $$;

alter table public.orders
  add column if not exists payment_status text not null default 'pending' check (payment_status in ('pending', 'processing', 'success', 'failed')),
  add column if not exists service_fee bigint not null default 0 check (service_fee >= 0),
  add column if not exists discount_amount bigint not null default 0 check (discount_amount >= 0),
  add column if not exists voucher_code text not null default '',
  add column if not exists eta_minutes integer not null default 30,
  add column if not exists driver_name text not null default '',
  add column if not exists driver_phone text not null default '',
  add column if not exists driver_vehicle text not null default '';

alter table public.orders
  add constraint orders_status_check
  check (
    status in (
      'pending_payment',
      'confirmed',
      'merchant_accepted',
      'preparing',
      'ready_for_pickup',
      'driver_assigned',
      'driver_going_to_merchant',
      'driver_arrived_merchant',
      'picked_up',
      'driver_going_to_customer',
      'driver_arrived',
      'delivered',
      'completed',
      'cancelled',
      'payment_failed',
      'pending',
      'accepted',
      'processing',
      'shipped',
      'rejected'
    )
  );

grant update (status, payment_status) on public.orders to authenticated;

drop function if exists public.checkout_cart(text, text, text, text, bigint);
create or replace function public.checkout_cart(
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_payment_method text,
  p_shipping_fee bigint,
  p_service_fee bigint default 0,
  p_discount_amount bigint default 0,
  p_voucher_code text default ''
)
returns table (order_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_group record;
  v_order_id uuid;
begin
  if v_user_id is null then
    raise exception 'Masuk terlebih dahulu untuk membuat pesanan.';
  end if;
  if coalesce(trim(p_customer_name), '') = ''
    or coalesce(trim(p_customer_phone), '') = ''
    or coalesce(trim(p_delivery_address), '') = '' then
    raise exception 'Nama, nomor telepon, dan alamat pengiriman wajib diisi.';
  end if;
  if p_payment_method not in ('bank', 'wallet', 'cod') then
    raise exception 'Metode pembayaran tidak valid.';
  end if;
  if p_shipping_fee < 0 or p_service_fee < 0 or p_discount_amount < 0 then
    raise exception 'Ongkos kirim, biaya layanan, atau diskon tidak valid.';
  end if;
  if not exists (select 1 from public.cart_items where user_id = v_user_id) then
    raise exception 'Keranjang masih kosong.';
  end if;
  if exists (
    select 1 from public.cart_items cart
    left join public.products product on product.id = cart.product_id
    where cart.user_id = v_user_id and (product.id is null or not product.is_available)
  ) then
    raise exception 'Ada produk di keranjang yang sudah tidak tersedia.';
  end if;

  for v_group in
    select product.store_id, sum(product.price * cart.quantity)::bigint as subtotal
    from public.cart_items cart
    join public.products product on product.id = cart.product_id
    where cart.user_id = v_user_id
    group by product.store_id
  loop
    insert into public.orders (
      buyer_id, store_id, status, customer_name, customer_phone, delivery_address,
      payment_method, payment_status, subtotal, shipping_fee, service_fee, discount_amount,
      voucher_code, total_amount
    ) values (
      v_user_id,
      v_group.store_id,
      'pending_payment',
      trim(p_customer_name),
      trim(p_customer_phone),
      trim(p_delivery_address),
      p_payment_method,
      'pending',
      v_group.subtotal,
      p_shipping_fee,
      p_service_fee,
      p_discount_amount,
      coalesce(trim(p_voucher_code), ''),
      v_group.subtotal + p_shipping_fee + p_service_fee - p_discount_amount
    ) returning id into v_order_id;

    insert into public.order_items (order_id, product_id, product_name, variant, quantity, unit_price, image_url)
    select v_order_id, product.id, product.name, cart.variant, cart.quantity, product.price, product.image_url
    from public.cart_items cart
    join public.products product on product.id = cart.product_id
    where cart.user_id = v_user_id and product.store_id = v_group.store_id;

    return query select v_order_id;
  end loop;

  delete from public.cart_items where user_id = v_user_id;
end;
$$;

revoke all on function public.checkout_cart(text, text, text, text, bigint, bigint, bigint, text) from public, anon;
grant execute on function public.checkout_cart(text, text, text, text, bigint, bigint, bigint, text) to authenticated;
