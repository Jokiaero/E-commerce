begin;

-- Older installations may have addresses without this timestamp. Both the
-- checkout trigger and existing-order backfill below need it for ordering.
alter table public.addresses
  add column if not exists created_at timestamptz not null default now();

-- Driver accounts and assignments are provisioned by a trusted dispatcher, never a buyer/seller.
create table if not exists public.delivery_drivers (
  user_id uuid primary key references auth.users(id) on delete restrict,
  name text not null,
  phone text not null default '',
  vehicle text not null default '',
  active boolean not null default true
);
alter table public.delivery_drivers enable row level security;
revoke all on public.delivery_drivers from anon, authenticated;
grant select on public.delivery_drivers to authenticated;
grant all on public.delivery_drivers to service_role;
drop policy if exists "Drivers read their own registration" on public.delivery_drivers;
create policy "Drivers read their own registration" on public.delivery_drivers
  for select to authenticated using (user_id = (select auth.uid()));

alter table public.orders
  add column if not exists driver_id uuid references public.delivery_drivers(user_id) on delete restrict,
  add column if not exists pickup_latitude double precision,
  add column if not exists pickup_longitude double precision,
  add column if not exists delivery_latitude double precision,
  add column if not exists delivery_longitude double precision,
  add column if not exists driver_latitude double precision,
  add column if not exists driver_longitude double precision,
  add column if not exists driver_accuracy double precision,
  add column if not exists driver_location_at timestamptz;

create index if not exists orders_driver_id_idx on public.orders(driver_id);

-- Remove both the table and the old column-level grants. All status writes use checked RPCs.
revoke update on public.orders from public, anon, authenticated;
revoke update (status, payment_status) on public.orders from public, anon, authenticated;
drop policy if exists "Sellers update their own orders" on public.orders;
drop policy if exists "Assigned drivers read orders" on public.orders;
create policy "Assigned drivers read orders" on public.orders for select to authenticated using (
  driver_id = (select auth.uid()) and exists (
    select 1 from public.delivery_drivers d where d.user_id = (select auth.uid()) and d.active
  )
);
drop policy if exists "Assigned drivers read order items" on public.order_items;
create policy "Assigned drivers read order items" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_items.order_id and o.driver_id = (select auth.uid()))
);

create table if not exists public.order_delivery_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  actor_id uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now()
);
create index if not exists order_delivery_events_order_id_idx on public.order_delivery_events(order_id, id);
alter table public.order_delivery_events enable row level security;
revoke all on public.order_delivery_events from public, anon, authenticated;
grant select on public.order_delivery_events to authenticated;
grant all on public.order_delivery_events to service_role;
grant usage, select on sequence public.order_delivery_events_id_seq to service_role;
drop policy if exists "Order participants read delivery events" on public.order_delivery_events;
create policy "Order participants read delivery events" on public.order_delivery_events for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_delivery_events.order_id)
);

create or replace function public.capture_order_delivery_points()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select s.latitude, s.longitude into new.pickup_latitude, new.pickup_longitude
    from public.stores s where s.id = new.store_id;
  select a.latitude, a.longitude into new.delivery_latitude, new.delivery_longitude
    from public.addresses a where a.user_id = new.buyer_id
      and (new.delivery_address = a.details or new.delivery_address = a.label || ' · ' || a.details)
    order by a.created_at desc limit 1;
  if new.payment_method = 'cod' and new.status in ('pending', 'pending_payment') then
    new.status := 'confirmed';
  end if;
  return new;
end;
$$;
revoke all on function public.capture_order_delivery_points() from public, anon, authenticated;
drop trigger if exists capture_order_delivery_points on public.orders;
create trigger capture_order_delivery_points before insert on public.orders
  for each row execute function public.capture_order_delivery_points();

-- Recover coordinates for existing orders only when the saved address matches exactly.
update public.orders o set pickup_latitude = s.latitude, pickup_longitude = s.longitude
  from public.stores s where s.id = o.store_id and o.pickup_latitude is null;
update public.orders o set (delivery_latitude, delivery_longitude) = (
  select a.latitude, a.longitude from public.addresses a where a.user_id = o.buyer_id
    and (o.delivery_address = a.details or o.delivery_address = a.label || ' · ' || a.details)
  order by a.created_at desc limit 1
) where o.delivery_latitude is null;

create or replace function public.log_order_delivery_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_delivery_events(order_id, status, actor_id) values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function public.log_order_delivery_status() from public, anon, authenticated;
drop trigger if exists log_order_delivery_status on public.orders;
create trigger log_order_delivery_status after insert or update of status on public.orders
  for each row execute function public.log_order_delivery_status();

create or replace function public.delivery_distance_meters(p_lat1 double precision, p_lng1 double precision, p_lat2 double precision, p_lng2 double precision)
returns double precision language sql immutable strict set search_path = '' as $$
  select 6371000.0 * 2 * asin(sqrt(least(1.0, greatest(0.0,
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
  ))));
$$;
revoke all on function public.delivery_distance_meters(double precision, double precision, double precision, double precision) from public, anon, authenticated;

create or replace function public.update_merchant_order_status(p_order_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_expected text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or auth.uid() is null or v_order.store_id <> auth.uid() then
    raise exception 'Pesanan tidak dapat diakses oleh penjual ini.';
  end if;
  v_expected := case v_order.status
    when 'confirmed' then 'merchant_accepted' when 'pending' then 'merchant_accepted'
    when 'merchant_accepted' then 'preparing' when 'accepted' then 'preparing'
    when 'preparing' then 'ready_for_pickup' when 'processing' then 'ready_for_pickup' else null end;
  if v_expected is null or p_status is distinct from v_expected or v_order.driver_id is not null then
    raise exception 'Penjual hanya dapat memperbarui persiapan makanan. Pengiriman mengikuti driver.';
  end if;
  update public.orders set status = p_status, updated_at = now() where id = p_order_id;
end;
$$;
revoke all on function public.update_merchant_order_status(uuid, text) from public, anon;
grant execute on function public.update_merchant_order_status(uuid, text) to authenticated;

create or replace function public.dispatch_order_driver(p_order_id uuid, p_driver_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_driver public.delivery_drivers%rowtype;
begin
  -- Execute is granted only to service_role. Lock the driver to prevent concurrent double assignment.
  select * into v_driver from public.delivery_drivers where user_id = p_driver_id and active for update;
  if not found then raise exception 'Driver belum terdaftar atau tidak aktif.'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pesanan tidak ditemukan.'; end if;
  if v_order.status <> 'ready_for_pickup' or v_order.driver_id is not null then
    raise exception 'Pesanan belum siap atau sudah memiliki driver.';
  end if;
  if p_driver_id in (v_order.buyer_id, v_order.store_id) then
    raise exception 'Driver harus menggunakan akun driver terpisah dari pembeli dan penjual pesanan.';
  end if;
  if exists (select 1 from public.orders where driver_id = p_driver_id and status not in ('completed', 'cancelled', 'payment_failed', 'rejected')) then
    raise exception 'Driver masih memiliki tugas aktif.';
  end if;
  if v_order.payment_method <> 'cod' and v_order.payment_status <> 'success' then
    raise exception 'Pembayaran belum terkonfirmasi.';
  end if;
  if v_order.pickup_latitude is null or v_order.pickup_longitude is null
    or v_order.delivery_latitude is null or v_order.delivery_longitude is null
    or not (v_order.pickup_latitude between -90 and 90 and v_order.delivery_latitude between -90 and 90
      and v_order.pickup_longitude between -180 and 180 and v_order.delivery_longitude between -180 and 180) then
    raise exception 'Titik lokasi toko atau alamat pengiriman belum tersedia.';
  end if;
  update public.orders set driver_id = p_driver_id, driver_name = v_driver.name,
    driver_phone = v_driver.phone, driver_vehicle = v_driver.vehicle,
    status = 'driver_assigned', updated_at = now() where id = p_order_id;
end;
$$;
revoke all on function public.dispatch_order_driver(uuid, uuid) from public, anon, authenticated;
grant execute on function public.dispatch_order_driver(uuid, uuid) to service_role;

create or replace function public.record_driver_location(
  p_order_id uuid, p_latitude double precision, p_longitude double precision,
  p_accuracy double precision, p_recorded_at timestamptz
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_status text; v_distance double precision;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or auth.uid() is null or v_order.driver_id is distinct from auth.uid()
    or not exists (select 1 from public.delivery_drivers d where d.user_id = auth.uid() and d.active) then
    raise exception 'Hanya driver yang ditugaskan dapat mengirim lokasi.';
  end if;
  if p_latitude is null or p_longitude is null or p_accuracy is null or p_recorded_at is null
    or not (p_latitude between -90 and 90 and p_longitude between -180 and 180 and p_accuracy between 0 and 50) then
    raise exception 'Lokasi GPS tidak valid atau akurasi melebihi 50 meter.';
  end if;
  if p_recorded_at < now() - interval '2 minutes' or p_recorded_at > now() + interval '30 seconds' then
    raise exception 'Lokasi GPS sudah lama atau waktu perangkat tidak sesuai.';
  end if;
  if v_order.status in ('completed', 'cancelled', 'payment_failed', 'rejected', 'delivered') then return; end if;
  if v_order.driver_location_at is not null and p_recorded_at <= v_order.driver_location_at then return; end if;
  v_status := v_order.status;
  if v_status in ('driver_assigned', 'driver_going_to_merchant') then
    v_distance := public.delivery_distance_meters(p_latitude, p_longitude, v_order.pickup_latitude, v_order.pickup_longitude);
    v_status := case when v_distance + p_accuracy <= 100 then 'driver_arrived_merchant' else 'driver_going_to_merchant' end;
  elsif v_status in ('picked_up', 'driver_going_to_customer') then
    v_distance := public.delivery_distance_meters(p_latitude, p_longitude, v_order.delivery_latitude, v_order.delivery_longitude);
    v_status := case when v_distance + p_accuracy <= 100 then 'driver_arrived' else 'driver_going_to_customer' end;
  end if;
  -- Arrival is monotonic. Moving away from a location does not prove pickup or handover.
  update public.orders set driver_latitude = p_latitude, driver_longitude = p_longitude,
    driver_accuracy = p_accuracy, driver_location_at = p_recorded_at, status = v_status, updated_at = now()
    where id = p_order_id;
end;
$$;
revoke all on function public.record_driver_location(uuid, double precision, double precision, double precision, timestamptz) from public, anon;
grant execute on function public.record_driver_location(uuid, double precision, double precision, double precision, timestamptz) to authenticated;

create or replace function public.record_driver_handover(p_order_id uuid, p_event text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_distance double precision;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or auth.uid() is null or v_order.driver_id is distinct from auth.uid()
    or not exists (select 1 from public.delivery_drivers d where d.user_id = auth.uid() and d.active) then
    raise exception 'Hanya driver yang ditugaskan dapat mencatat pengambilan atau penyerahan.';
  end if;
  if p_event is null or p_event not in ('picked_up', 'delivered') then raise exception 'Aktivitas driver tidak valid.'; end if;
  if p_event = 'delivered' and v_order.status = 'completed' then return; end if;
  if p_event = 'picked_up' and v_order.status in ('picked_up', 'driver_going_to_customer', 'driver_arrived', 'delivered', 'completed') then return; end if;
  if v_order.driver_location_at is null or v_order.driver_location_at < now() - interval '90 seconds'
    or v_order.driver_location_at > now() + interval '30 seconds' then
    raise exception 'Lokasi driver belum diperbarui. Aktifkan GPS sebelum konfirmasi.';
  end if;
  if p_event = 'picked_up' then
    if v_order.status <> 'driver_arrived_merchant' then raise exception 'Driver belum tiba di toko.'; end if;
    v_distance := public.delivery_distance_meters(v_order.driver_latitude, v_order.driver_longitude, v_order.pickup_latitude, v_order.pickup_longitude);
  else
    if v_order.status <> 'driver_arrived' then raise exception 'Driver belum tiba di alamat pengiriman.'; end if;
    v_distance := public.delivery_distance_meters(v_order.driver_latitude, v_order.driver_longitude, v_order.delivery_latitude, v_order.delivery_longitude);
  end if;
  if v_distance is null or v_order.driver_accuracy is null or v_distance + v_order.driver_accuracy > 100 then
    raise exception 'Driver harus berada di titik pengambilan atau penyerahan.';
  end if;
  if p_event = 'delivered' then
    insert into public.order_delivery_events(order_id, status, actor_id) values (p_order_id, 'delivered', auth.uid());
    update public.orders set status = 'completed',
      payment_status = case when payment_method = 'cod' then 'success' else payment_status end,
      updated_at = now() where id = p_order_id;
  else
    update public.orders set status = 'picked_up', updated_at = now() where id = p_order_id;
  end if;
end;
$$;
revoke all on function public.record_driver_handover(uuid, text) from public, anon;
grant execute on function public.record_driver_handover(uuid, text) to authenticated;

-- The payment provider, not a buyer or seller status button, confirms prepaid orders.
create or replace function public.confirm_paid_order()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.payment_status = 'success' and new.status in ('pending_payment', 'pending') then new.status := 'confirmed'; end if;
  return new;
end;
$$;
revoke all on function public.confirm_paid_order() from public, anon, authenticated;
drop trigger if exists confirm_paid_order on public.orders;
create trigger confirm_paid_order before update of payment_status on public.orders
  for each row execute function public.confirm_paid_order();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

commit;
