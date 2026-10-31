-- Run once as the Supabase project owner AFTER the existing RasaLokal base migrations.
-- This does not provision an admin identity. See the dashboard access guide.

-- 20261031000000_driver_tracking.sql
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


-- 20261031010000_driver_registration.sql
begin;

-- The account owner may apply, but only an administrator can activate the driver.
create or replace function public.register_driver_account(
  p_name text, p_phone text, p_vehicle_type text, p_plate_number text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_digits text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_plate text := btrim(regexp_replace(upper(coalesce(p_plate_number, '')), '\s+', ' ', 'g'));
begin
  if v_user_id is null then raise exception 'Masuk terlebih dahulu untuk mendaftar sebagai driver.'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Isi nama lengkap antara 2 hingga 80 karakter.';
  end if;
  if v_phone !~ '^\+?[0-9[:space:]()-]+$' or char_length(v_digits) < 8 or char_length(v_digits) > 15 or char_length(v_phone) > 24 then
    raise exception 'Masukkan nomor telepon yang valid.';
  end if;
  if p_vehicle_type is null or p_vehicle_type not in ('Motor', 'Mobil') then raise exception 'Pilih jenis kendaraan.'; end if;
  if char_length(v_plate) < 3 or char_length(v_plate) > 20 or v_plate !~ '^[A-Z0-9 -]+$' or v_plate !~ '[A-Z]' or v_plate !~ '[0-9]' then
    raise exception 'Isi nomor polisi yang valid, contoh BG 1234 AB.';
  end if;
  insert into public.delivery_drivers(user_id, name, phone, vehicle, active)
    values (v_user_id, v_name, v_phone, p_vehicle_type || ' · ' || v_plate, false)
    on conflict (user_id) do nothing;
  -- Retries must not overwrite an existing registration or reactivate a suspended driver.
end;
$$;
revoke all on function public.register_driver_account(text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_driver_account(text, text, text, text) to authenticated;

commit;


-- 20261031020000_marketplace_admin.sql
begin;

-- Admin membership is provisioned by the project owner, never by user metadata.
create table if not exists public.marketplace_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.marketplace_admins enable row level security;
revoke all on public.marketplace_admins from public, anon, authenticated;
grant select on public.marketplace_admins to authenticated;
grant all on public.marketplace_admins to service_role;
drop policy if exists "Admin reads own membership" on public.marketplace_admins;
create policy "Admin reads own membership" on public.marketplace_admins for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.is_marketplace_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.marketplace_admins where user_id = auth.uid() and active);
$$;
revoke all on function public.is_marketplace_admin() from public, anon;
grant execute on function public.is_marketplace_admin() to authenticated;

create or replace function public.require_marketplace_admin()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_marketplace_admin() then
    raise exception 'Akses khusus admin. Minta pemilik proyek mengaktifkan akun admin Anda.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.require_marketplace_admin() from public, anon, authenticated;

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_id uuid not null,
  value text,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from public, anon, authenticated;
grant all on public.admin_audit_log to service_role;
grant usage, select on sequence public.admin_audit_log_id_seq to service_role;

alter table public.stores add column if not exists is_suspended boolean not null default false;
alter table public.products add column if not exists is_blocked boolean not null default false;
alter table public.delivery_drivers add column if not exists created_at timestamptz not null default now();

-- Table-level seller grants must not permit clearing moderation flags or deleting
-- a moderated record and recreating it under the same identity.
create or replace function public.guard_admin_moderation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_protected boolean;
begin
  if current_setting('role', true) in ('anon', 'authenticated') and not public.is_marketplace_admin() then
    if tg_table_name = 'stores' then
      if tg_op = 'INSERT' then v_protected := new.is_suspended;
      elsif tg_op = 'DELETE' then v_protected := old.is_suspended;
      else v_protected := new.is_suspended is distinct from old.is_suspended; end if;
    else
      if tg_op = 'INSERT' then v_protected := new.is_blocked;
      elsif tg_op = 'DELETE' then v_protected := old.is_blocked;
      else v_protected := new.is_blocked is distinct from old.is_blocked; end if;
      if tg_op = 'DELETE' then
        v_protected := v_protected or exists(select 1 from public.stores where id = old.store_id and is_suspended);
      end if;
    end if;
    if v_protected then raise exception 'Moderasi hanya dapat diubah oleh admin.' using errcode = '42501'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.guard_admin_moderation() from public, anon, authenticated;
drop trigger if exists guard_store_moderation on public.stores;
create trigger guard_store_moderation before insert or update or delete on public.stores
  for each row execute function public.guard_admin_moderation();
drop trigger if exists guard_product_moderation on public.products;
create trigger guard_product_moderation before insert or update or delete on public.products
  for each row execute function public.guard_admin_moderation();

drop policy if exists "Available products are publicly readable" on public.products;
create policy "Available products are publicly readable" on public.products for select using (
  (is_available and not is_blocked and exists(select 1 from public.stores s where s.id = store_id and not s.is_suspended))
  or store_id = (select auth.uid())
);

-- Definer checkout functions bypass RLS; enforce moderation at the write boundary
-- too, including carts created before a shop/product was moderated.
create or replace function public.guard_moderated_checkout()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_suspended boolean; v_blocked boolean; v_store uuid;
begin
  if tg_table_name = 'orders' then
    select is_suspended into v_suspended from public.stores where id = new.store_id for share;
  else
    if new.product_id is null then return new; end if;
    select store_id, is_blocked into v_store, v_blocked from public.products where id = new.product_id for share;
    select is_suspended into v_suspended from public.stores where id = v_store for share;
  end if;
  if coalesce(v_suspended, false) or coalesce(v_blocked, false) then
    raise exception 'Toko atau produk sedang dinonaktifkan oleh admin.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_moderated_checkout() from public, anon, authenticated;
drop trigger if exists guard_order_moderation on public.orders;
create trigger guard_order_moderation before insert on public.orders for each row execute function public.guard_moderated_checkout();
drop trigger if exists guard_cart_moderation on public.cart_items;
create trigger guard_cart_moderation before insert or update on public.cart_items for each row execute function public.guard_moderated_checkout();
drop trigger if exists guard_item_moderation on public.order_items;
create trigger guard_item_moderation before insert on public.order_items for each row execute function public.guard_moderated_checkout();

create or replace function public.admin_dashboard_snapshot(p_start date, p_end date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_start timestamptz; v_end timestamptz; v_bucket text; v_step interval; v_chart jsonb;
begin
  perform public.require_marketplace_admin();
  if p_start is null or p_end is null or p_end < p_start or p_end - p_start > 366 then raise exception 'Periode maksimal 366 hari.'; end if;
  v_start := p_start::timestamp at time zone 'Asia/Jakarta';
  v_end := (p_end + 1)::timestamp at time zone 'Asia/Jakarta';
  v_bucket := case when p_end - p_start <= 14 then 'day' when p_end - p_start <= 90 then 'week' else 'month' end;
  v_step := case v_bucket when 'day' then interval '1 day' when 'week' then interval '1 week' else interval '1 month' end;
  select coalesce(jsonb_agg(jsonb_build_object('date', b.bucket::date, 'amount', coalesce(t.amount,0), 'orders', coalesce(t.orders,0)) order by b.bucket), '[]') into v_chart
  from generate_series(date_trunc(v_bucket,p_start::timestamp),date_trunc(v_bucket,p_end::timestamp),v_step) b(bucket)
  left join (
    select date_trunc(v_bucket,created_at at time zone 'Asia/Jakarta') bucket,
      coalesce(sum(total_amount) filter (where payment_status = 'success'),0) amount, count(*) orders
    from public.orders where created_at >= v_start and created_at < v_end group by 1
  ) t using(bucket);
  return jsonb_build_object(
    'stores', (select count(*) from public.stores),
    'active_stores', (select count(*) from public.stores where not is_suspended),
    'users', (select count(*) from auth.users),
    'orders', (select count(*) from public.orders where created_at >= v_start and created_at < v_end),
    'paid_amount', (select coalesce(sum(total_amount),0) from public.orders where created_at >= v_start and created_at < v_end and payment_status = 'success'),
    'service_fees', (select coalesce(sum(service_fee),0) from public.orders where created_at >= v_start and created_at < v_end and payment_status = 'success'),
    'completed_orders', (select count(*) from public.orders where created_at >= v_start and created_at < v_end and status in ('completed','delivered')),
    'pending_drivers', (select count(*) from public.delivery_drivers where not active),
    'pending_payments', (select count(*) from public.orders where payment_method <> 'cod' and payment_status in ('pending','processing') and status not in ('cancelled','rejected','payment_failed','completed','delivered')),
    'ready_orders', (select count(*) from public.orders where status = 'ready_for_pickup' and driver_id is null and (payment_method = 'cod' or payment_status = 'success')),
    'chart', v_chart, 'bucket', v_bucket, 'updated_at', now()
  );
end;
$$;
revoke all on function public.admin_dashboard_snapshot(date,date) from public, anon;
grant execute on function public.admin_dashboard_snapshot(date,date) to authenticated;

-- The source queries are an allowlist. Search/filter/page values are always bound
-- parameters, and the admin check precedes all auth.users access.
create or replace function public.admin_list_entities(
  p_kind text, p_search text default '', p_status text default '', p_offset integer default 0,
  p_limit integer default 10, p_start date default null, p_end date default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_sql text; v_result jsonb;
begin
  perform public.require_marketplace_admin();
  if p_limit is null or p_limit < 1 or p_limit > 100 or p_offset is null or p_offset < 0 or char_length(coalesce(p_search,'')) > 200 then raise exception 'Parameter pencarian tidak valid.'; end if;
  if (p_start is null) <> (p_end is null) or p_end < p_start or p_end - p_start > 366 then raise exception 'Periode tidak valid.'; end if;
  case p_kind
  when 'stores' then v_sql := $q$
    select s.id, s.name, s.owner_name secondary, u.email, s.address, s.created_at, s.is_suspended,
      case when s.is_suspended then 'suspended' when s.is_open then 'open' else 'closed' end status,
      (select count(*) from public.products p where p.store_id=s.id) products,
      (select count(*) from public.orders o where o.store_id=s.id) orders
    from public.stores s join auth.users u on u.id=s.id$q$;
  when 'users' then v_sql := $q$
    select u.id, coalesce(nullif(p.full_name,''),split_part(u.email,'@',1),'Pengguna') name,
      coalesce(p.phone,'') secondary, u.email, u.created_at, u.last_sign_in_at,
      case when exists(select 1 from public.marketplace_admins a where a.user_id=u.id and a.active) then 'admin'
      when exists(select 1 from public.stores s where s.id=u.id) then 'seller'
      when exists(select 1 from public.delivery_drivers d where d.user_id=u.id) then 'driver' else 'customer' end status
    from auth.users u left join public.profiles p on p.id=u.id$q$;
  when 'products' then v_sql := $q$
    select p.id,p.name,s.name secondary,p.price amount,p.category,p.description,p.created_at,p.is_blocked,
      case when p.is_blocked then 'blocked' when s.is_suspended then 'suspended' when p.is_available then 'available' else 'unavailable' end status
    from public.products p join public.stores s on s.id=p.store_id$q$;
  when 'drivers' then v_sql := $q$
    select d.user_id id,d.name,d.vehicle secondary,d.phone,u.email,d.created_at,d.active,
      case when not d.active then 'pending' when exists(select 1 from public.orders o where o.driver_id=d.user_id and o.status not in ('completed','delivered','cancelled','payment_failed','rejected')) then 'busy' else 'active' end status
    from public.delivery_drivers d join auth.users u on u.id=d.user_id$q$;
  when 'orders','transactions' then v_sql := $q$
    select o.id,o.customer_name name,s.name secondary,o.created_at,o.total_amount amount,o.status,
      o.payment_method,o.payment_status,o.customer_phone phone,o.delivery_address address,
      o.driver_id,o.driver_name,o.subtotal,o.shipping_fee,o.service_fee,o.discount_amount,
      (select coalesce(jsonb_agg(jsonb_build_object('name',i.product_name,'variant',i.variant,'quantity',i.quantity,'price',i.unit_price)),'[]') from public.order_items i where i.order_id=o.id) items
    from public.orders o join public.stores s on s.id=o.store_id$q$;
    if p_kind = 'transactions' then v_sql := 'select x.*,x.payment_status filter_status from ('||v_sql||') x'; end if;
  when 'audit' then v_sql := $q$
    select a.id::text id, a.action name, coalesce(u.email,'Admin dihapus') secondary,
      a.action status,a.target_id,a.value,a.created_at
    from public.admin_audit_log a left join auth.users u on u.id=a.actor_id$q$;
  else raise exception 'Jenis data tidak valid.';
  end case;
  v_sql := 'with records as (select to_jsonb(x) r from ('||v_sql||') x), filtered as (
    select r from records where ($1 = '''' or concat_ws('' '',r->>''name'',r->>''secondary'',r->>''email'',r->>''id'') ilike ''%''||$1||''%'')
    and ($2 = '''' or coalesce(r->>''filter_status'',r->>''status'') = $2
      or ($2 = ''review'' and r ? ''payment_status'' and r->>''payment_method'' in (''bank'',''wallet'')
        and r->>''payment_status'' in (''pending'',''processing'') and r->>''status'' not in (''cancelled'',''rejected'',''payment_failed'',''completed'',''delivered'')))
    and ($5::date is null or (r->>''created_at'')::timestamptz >= ($5::date)::timestamp at time zone ''Asia/Jakarta'')
    and ($6::date is null or (r->>''created_at'')::timestamptz < ($6::date+1)::timestamp at time zone ''Asia/Jakarta''))
    select jsonb_build_object(''total'',(select count(*) from filtered),''rows'',coalesce((select jsonb_agg(r) from
    (select r from filtered order by r->>''created_at'' desc,r->>''id'' limit $3 offset $4) page),''[]''::jsonb))';
  execute v_sql into v_result using coalesce(p_search,''),coalesce(p_status,''),p_limit,p_offset,p_start,p_end;
  return v_result;
end;
$$;
revoke all on function public.admin_list_entities(text,text,text,integer,integer,date,date) from public, anon;
grant execute on function public.admin_list_entities(text,text,text,integer,integer,date,date) to authenticated;

create or replace function public.admin_perform_action(p_action text,p_id uuid,p_value text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype;
begin
  perform public.require_marketplace_admin();
  if p_action in ('driver_active','store_suspended','product_blocked') and (p_value is null or p_value not in ('true','false')) then raise exception 'Nilai status tidak valid.'; end if;
  case p_action
  when 'driver_active' then
    perform 1 from public.delivery_drivers where user_id=p_id for update;
    if not found then raise exception 'Driver tidak ditemukan.'; end if;
    if p_value = 'false' and exists(select 1 from public.orders where driver_id=p_id and status not in ('completed','delivered','cancelled','payment_failed','rejected')) then raise exception 'Driver masih memiliki tugas aktif.'; end if;
    update public.delivery_drivers set active=p_value::boolean where user_id=p_id;
  when 'store_suspended' then
    update public.stores set is_suspended=p_value::boolean where id=p_id;
    if not found then raise exception 'Toko tidak ditemukan.'; end if;
  when 'product_blocked' then
    update public.products set is_blocked=p_value::boolean where id=p_id;
    if not found then raise exception 'Produk tidak ditemukan.'; end if;
  when 'payment_confirm' then
    select * into v_order from public.orders where id=p_id for update;
    if not found then raise exception 'Pesanan tidak ditemukan.'; end if;
    if v_order.payment_method not in ('bank','wallet') or v_order.payment_status not in ('pending','processing')
      or v_order.status in ('cancelled','payment_failed','rejected','completed','delivered') then raise exception 'Pembayaran ini tidak dapat dikonfirmasi.'; end if;
    update public.orders set payment_status='success',updated_at=now() where id=p_id;
  when 'assign_driver' then
    perform public.dispatch_order_driver(p_id,p_value::uuid);
  else raise exception 'Tindakan admin tidak valid.';
  end case;
  insert into public.admin_audit_log(actor_id,action,target_id,value) values (auth.uid(),p_action,p_id,p_value);
end;
$$;
revoke all on function public.admin_perform_action(text,uuid,text) from public, anon;
grant execute on function public.admin_perform_action(text,uuid,text) to authenticated;

create index if not exists admin_audit_created_idx on public.admin_audit_log(created_at desc);
create index if not exists orders_admin_created_idx on public.orders(created_at desc);
create index if not exists driver_admin_active_idx on public.delivery_drivers(active,created_at desc);
commit;
