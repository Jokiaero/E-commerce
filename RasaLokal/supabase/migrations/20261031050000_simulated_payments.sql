begin;

alter table public.orders
  add column if not exists payment_provider text,
  add column if not exists payment_reference text,
  add column if not exists payment_channel text;

create or replace function public.complete_simulated_payment(p_order_ids uuid[], p_channel text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_buyer_id uuid := auth.uid();
  v_expected_count integer;
  v_order_count integer;
  v_payment_method text;
begin
  if v_buyer_id is null then raise exception 'Masuk terlebih dahulu untuk melanjutkan pembayaran.'; end if;
  if p_order_ids is null or cardinality(p_order_ids) < 1 or cardinality(p_order_ids) > 20
    or array_position(p_order_ids, null) is not null then
    raise exception 'Daftar pesanan pembayaran tidak valid.';
  end if;
  select count(distinct order_id)::integer into v_expected_count
    from unnest(p_order_ids) as requested(order_id);
  if v_expected_count <> cardinality(p_order_ids) then
    raise exception 'Daftar pesanan pembayaran tidak boleh berisi duplikat.';
  end if;

  perform 1 from public.orders where id = any(p_order_ids) order by id for update;
  select count(*)::integer, min(o.payment_method)
    into v_order_count, v_payment_method
  from public.orders o
  where o.id = any(p_order_ids)
    and o.buyer_id = v_buyer_id
    and o.payment_method in ('bank', 'wallet')
    and o.payment_status in ('pending', 'processing', 'failed')
    and o.status not in ('cancelled', 'payment_failed', 'rejected', 'completed', 'delivered');

  if v_order_count <> cardinality(p_order_ids) then
    raise exception 'Pesanan tidak ditemukan, bukan milik akun ini, atau tidak dapat dibayar.';
  end if;
  if exists (
    select 1 from public.orders o
    where o.id = any(p_order_ids) and o.payment_method <> v_payment_method
  ) then raise exception 'Metode pembayaran pesanan tidak konsisten.'; end if;
  if (v_payment_method = 'bank' and p_channel not in ('bca', 'bni', 'bri'))
    or (v_payment_method = 'wallet' and p_channel not in ('gopay', 'dana', 'ovo')) then
    raise exception 'Kanal pembayaran demo tidak sesuai dengan metode pesanan.';
  end if;

  update public.orders set payment_status = 'success',
    payment_provider = 'simulation',
    payment_channel = p_channel,
    payment_reference = 'DEMO-' || upper(left(replace(gen_random_uuid()::text, '-', ''), 12)),
    updated_at = now()
  where id = any(p_order_ids) and buyer_id = v_buyer_id;
end;
$$;
revoke all on function public.complete_simulated_payment(uuid[], text) from public, anon;
grant execute on function public.complete_simulated_payment(uuid[], text) to authenticated;

comment on function public.complete_simulated_payment(uuid[], text) is
  'DEMO ONLY: completes a clearly labelled simulated payment. Never use as proof of funds or in production.';
comment on column public.orders.payment_provider is
  'Payment provider identifier; simulation means no real funds were moved.';

commit;
