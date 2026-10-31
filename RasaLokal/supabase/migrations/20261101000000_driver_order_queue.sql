begin;

create or replace function public.list_driver_order_queue()
returns table (
  order_id uuid,
  order_status text,
  store_name text,
  created_at timestamptz,
  total_amount numeric,
  payment_method text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_driver_id uuid := auth.uid();
begin
  if v_driver_id is null or not exists (
    select 1 from public.delivery_drivers d
    where d.user_id = v_driver_id and d.active
  ) then
    raise exception 'Hanya driver aktif yang dapat melihat antrean tugas.';
  end if;

  if exists (
    select 1 from public.orders o
    where o.driver_id = v_driver_id
      and o.status not in ('completed', 'cancelled', 'payment_failed', 'rejected', 'delivered')
  ) then
    return;
  end if;

  return query
  select o.id, o.status, s.name, o.created_at, o.total_amount::numeric, o.payment_method
  from public.orders o
  join public.stores s on s.id = o.store_id
  where o.driver_id is null
    and o.status in ('confirmed', 'merchant_accepted', 'preparing', 'ready_for_pickup')
    and (o.payment_method = 'cod' or o.payment_status = 'success')
    and o.buyer_id <> v_driver_id
    and o.store_id <> v_driver_id
    and o.pickup_latitude between -90 and 90
    and o.pickup_longitude between -180 and 180
    and o.delivery_latitude between -90 and 90
    and o.delivery_longitude between -180 and 180
  order by o.created_at
  limit 50;
end;
$$;
revoke all on function public.list_driver_order_queue() from public, anon;
grant execute on function public.list_driver_order_queue() to authenticated;

create or replace function public.claim_driver_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver_id uuid := auth.uid();
  v_driver public.delivery_drivers%rowtype;
  v_order public.orders%rowtype;
begin
  if v_driver_id is null then
    raise exception 'Masuk menggunakan akun driver untuk mengambil tugas.';
  end if;

  select * into v_driver
  from public.delivery_drivers d
  where d.user_id = v_driver_id and d.active
  for update;
  if not found then
    raise exception 'Akun driver belum aktif.';
  end if;

  if exists (
    select 1 from public.orders o
    where o.driver_id = v_driver_id
      and o.status not in ('completed', 'cancelled', 'payment_failed', 'rejected', 'delivered')
  ) then
    raise exception 'Selesaikan tugas aktif sebelum mengambil pesanan lain.';
  end if;

  select * into v_order
  from public.orders o
  where o.id = p_order_id
  for update;
  if not found then
    raise exception 'Pesanan tidak ditemukan atau sudah diambil driver lain.';
  end if;
  if v_order.driver_id is not null then
    raise exception 'Pesanan sudah diambil driver lain.';
  end if;
  if v_order.status <> 'ready_for_pickup' then
    raise exception 'Tugas dapat diambil setelah merchant menandai pesanan siap diambil.';
  end if;
  if v_order.payment_method <> 'cod' and v_order.payment_status <> 'success' then
    raise exception 'Pembayaran belum terkonfirmasi.';
  end if;
  if v_order.buyer_id = v_driver_id or v_order.store_id = v_driver_id then
    raise exception 'Gunakan akun driver terpisah dari pembeli atau penjual pesanan.';
  end if;
  if v_order.pickup_latitude is null or v_order.pickup_longitude is null
    or v_order.delivery_latitude is null or v_order.delivery_longitude is null
    or not (v_order.pickup_latitude between -90 and 90 and v_order.delivery_latitude between -90 and 90
      and v_order.pickup_longitude between -180 and 180 and v_order.delivery_longitude between -180 and 180) then
    raise exception 'Titik lokasi toko atau alamat pengiriman belum tersedia.';
  end if;

  update public.orders
  set driver_id = v_driver_id,
      driver_name = v_driver.name,
      driver_phone = v_driver.phone,
      driver_vehicle = v_driver.vehicle,
      status = 'driver_assigned',
      updated_at = now()
  where id = p_order_id;
end;
$$;
revoke all on function public.claim_driver_order(uuid) from public, anon;
grant execute on function public.claim_driver_order(uuid) to authenticated;

comment on function public.list_driver_order_queue() is
  'Returns only non-sensitive metadata for paid/COD delivery orders to an active driver without an active task.';
comment on function public.claim_driver_order(uuid) is
  'Atomically assigns a ready, paid/COD order to the active authenticated driver who claims it.';

commit;
