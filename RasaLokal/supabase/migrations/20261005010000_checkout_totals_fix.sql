alter table public.orders
  drop constraint if exists orders_check,
  drop constraint if exists orders_total_amount_check;

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
  v_total_subtotal bigint;
  v_group_count integer;
  v_group_index integer := 0;
  v_allocated_service_fee bigint := 0;
  v_allocated_discount bigint := 0;
  v_group_service_fee bigint;
  v_group_discount bigint;
begin
  if v_user_id is null then
    raise exception 'Masuk terlebih dahulu untuk membuat pesanan.';
  end if;
  if coalesce(trim(p_customer_name), '') = ''
    or coalesce(trim(p_customer_phone), '') = ''
    or coalesce(trim(p_delivery_address), '') = '' then
    raise exception 'Nama, nomor telepon, dan alamat pengiriman wajib diisi.';
  end if;
  if p_payment_method is null or p_payment_method not in ('bank', 'wallet', 'cod') then
    raise exception 'Metode pembayaran tidak valid.';
  end if;
  if coalesce(p_shipping_fee, -1) < 0
    or coalesce(p_service_fee, -1) < 0
    or coalesce(p_discount_amount, -1) < 0 then
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

  select coalesce(sum(product.price * cart.quantity), 0)::bigint, count(distinct product.store_id)::integer
  into v_total_subtotal, v_group_count
  from public.cart_items cart
  join public.products product on product.id = cart.product_id
  where cart.user_id = v_user_id;

  if p_discount_amount > v_total_subtotal then
    raise exception 'Diskon tidak boleh melebihi subtotal pesanan.';
  end if;

  for v_group in
    select product.store_id, sum(product.price * cart.quantity)::bigint as subtotal
    from public.cart_items cart
    join public.products product on product.id = cart.product_id
    where cart.user_id = v_user_id
    group by product.store_id
    order by product.store_id
  loop
    v_group_index := v_group_index + 1;
    if v_group_index = v_group_count then
      v_group_service_fee := p_service_fee - v_allocated_service_fee;
      v_group_discount := p_discount_amount - v_allocated_discount;
    elsif v_total_subtotal = 0 then
      v_group_service_fee := 0;
      v_group_discount := 0;
    else
      v_group_service_fee := floor(p_service_fee::numeric * v_group.subtotal / v_total_subtotal)::bigint;
      v_group_discount := floor(p_discount_amount::numeric * v_group.subtotal / v_total_subtotal)::bigint;
    end if;
    v_allocated_service_fee := v_allocated_service_fee + v_group_service_fee;
    v_allocated_discount := v_allocated_discount + v_group_discount;

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
      v_group_service_fee,
      v_group_discount,
      coalesce(trim(p_voucher_code), ''),
      v_group.subtotal + p_shipping_fee + v_group_service_fee - v_group_discount
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