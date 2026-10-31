begin;

alter table public.orders
  add column if not exists delivery_proof_path text,
  add column if not exists cod_collected_amount numeric(12, 2);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-delivery-proofs',
  'order-delivery-proofs',
  false,
  5242880,
  array['image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Assigned drivers upload delivery proof" on storage.objects;
create policy "Assigned drivers upload delivery proof" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'order-delivery-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.orders o
      join public.delivery_drivers d on d.user_id = o.driver_id and d.active
      where o.id::text = (storage.foldername(name))[2]
        and o.driver_id = (select auth.uid())
        and o.status = 'driver_arrived'
    )
  );

drop policy if exists "Order participants read delivery proof" on storage.objects;
create policy "Order participants read delivery proof" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'order-delivery-proofs'
    and exists (
      select 1 from public.orders o
      where o.delivery_proof_path = storage.objects.name
        and ((select auth.uid()) = o.buyer_id
          or (select auth.uid()) = o.store_id
          or (select auth.uid()) = o.driver_id)
    )
  );

create or replace function public.record_driver_delivery_proof(p_order_id uuid, p_storage_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_expected_path text;
  v_distance double precision;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or auth.uid() is null or v_order.driver_id is distinct from auth.uid()
    or not exists (select 1 from public.delivery_drivers d where d.user_id = auth.uid() and d.active) then
    raise exception 'Hanya driver aktif yang ditugaskan dapat mengunggah bukti pengantaran.';
  end if;
  if v_order.status <> 'driver_arrived' then
    raise exception 'Bukti pengantaran hanya dapat dicatat setelah driver tiba di alamat.';
  end if;
  if v_order.driver_location_at is null or v_order.driver_location_at < now() - interval '90 seconds'
    or v_order.driver_location_at > now() + interval '30 seconds' then
    raise exception 'Lokasi driver belum diperbarui. Aktifkan GPS sebelum mengunggah bukti.';
  end if;
  v_distance := public.delivery_distance_meters(
    v_order.driver_latitude, v_order.driver_longitude,
    v_order.delivery_latitude, v_order.delivery_longitude
  );
  if v_distance is null or v_order.driver_accuracy is null or v_distance + v_order.driver_accuracy > 100 then
    raise exception 'Driver harus berada di titik alamat pengiriman untuk mengunggah bukti.';
  end if;
  v_expected_path := auth.uid()::text || '/' || p_order_id::text || '/';
  if p_storage_path is null or left(p_storage_path, char_length(v_expected_path)) <> v_expected_path
    or p_storage_path !~ '\.jpg$'
    or not exists (
      select 1 from storage.objects so
      where so.bucket_id = 'order-delivery-proofs' and so.name = p_storage_path
    ) then
    raise exception 'Foto bukti tidak ditemukan atau tidak sesuai dengan tugas ini.';
  end if;
  update public.orders set delivery_proof_path = p_storage_path, updated_at = now()
    where id = p_order_id;
end;
$$;
revoke all on function public.record_driver_delivery_proof(uuid, text) from public, anon;
grant execute on function public.record_driver_delivery_proof(uuid, text) to authenticated;

create or replace function public.record_driver_cod_collection(p_order_id uuid, p_amount numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_distance double precision;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or auth.uid() is null or v_order.driver_id is distinct from auth.uid()
    or not exists (select 1 from public.delivery_drivers d where d.user_id = auth.uid() and d.active) then
    raise exception 'Hanya driver aktif yang ditugaskan dapat mencatat pembayaran COD.';
  end if;
  if v_order.payment_method <> 'cod' or v_order.status <> 'driver_arrived' then
    raise exception 'Pembayaran COD hanya dapat dicatat pada pesanan COD setelah tiba di alamat.';
  end if;
  if p_amount is null or p_amount < 0 or p_amount is distinct from v_order.total_amount then
    raise exception 'Nominal COD harus sama dengan total pesanan.';
  end if;
  if v_order.driver_location_at is null or v_order.driver_location_at < now() - interval '90 seconds'
    or v_order.driver_location_at > now() + interval '30 seconds' then
    raise exception 'Lokasi driver belum diperbarui. Aktifkan GPS sebelum mencatat COD.';
  end if;
  v_distance := public.delivery_distance_meters(
    v_order.driver_latitude, v_order.driver_longitude,
    v_order.delivery_latitude, v_order.delivery_longitude
  );
  if v_distance is null or v_order.driver_accuracy is null or v_distance + v_order.driver_accuracy > 100 then
    raise exception 'Driver harus berada di titik alamat pengiriman untuk mencatat COD.';
  end if;
  update public.orders set cod_collected_amount = p_amount, updated_at = now()
    where id = p_order_id;
end;
$$;
revoke all on function public.record_driver_cod_collection(uuid, numeric) from public, anon;
grant execute on function public.record_driver_cod_collection(uuid, numeric) to authenticated;

create or replace function public.record_driver_handover(p_order_id uuid, p_event text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_distance double precision;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or auth.uid() is null or v_order.driver_id is distinct from auth.uid()
    or not exists (select 1 from public.delivery_drivers d where d.user_id = auth.uid() and d.active) then
    raise exception 'Hanya driver yang ditugaskan dapat mencatat pengambilan atau penyerahan.';
  end if;
  if p_event is null or p_event not in ('picked_up', 'delivered') then
    raise exception 'Aktivitas driver tidak valid.';
  end if;
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
    if v_order.delivery_proof_path is null then raise exception 'Unggah foto bukti pengantaran sebelum menyelesaikan tugas.'; end if;
    if v_order.payment_method = 'cod' and v_order.cod_collected_amount is distinct from v_order.total_amount then
      raise exception 'Catat pembayaran COD sesuai total pesanan sebelum menyelesaikan tugas.';
    end if;
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

commit;
