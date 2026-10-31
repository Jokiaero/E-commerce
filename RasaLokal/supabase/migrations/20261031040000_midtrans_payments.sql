begin;

create table if not exists public.midtrans_payments (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete restrict,
  order_ids uuid[] not null,
  midtrans_order_id text not null unique,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('bank', 'wallet')),
  status text not null default 'creating'
    check (status in ('creating', 'pending', 'processing', 'success', 'failed', 'cancelled', 'expired')),
  snap_token text,
  redirect_url text,
  provider_transaction_id text,
  provider_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(order_ids) > 0)
);

alter table public.midtrans_payments enable row level security;
revoke all on public.midtrans_payments from public, anon, authenticated;
grant select on public.midtrans_payments to authenticated;
grant all on public.midtrans_payments to service_role;
drop policy if exists "Buyers read their Midtrans payments" on public.midtrans_payments;
create policy "Buyers read their Midtrans payments" on public.midtrans_payments
  for select to authenticated using (buyer_id = (select auth.uid()));

alter table public.orders
  add column if not exists payment_attempt_id uuid
    references public.midtrans_payments(id) on delete set null;

create index if not exists midtrans_payments_buyer_created_idx
  on public.midtrans_payments(buyer_id, created_at desc);
create index if not exists orders_payment_attempt_idx
  on public.orders(payment_attempt_id) where payment_attempt_id is not null;

create or replace function public.start_midtrans_payment(p_order_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_buyer_id uuid := auth.uid();
  v_order_count integer;
  v_expected_count integer;
  v_amount numeric(12, 2);
  v_name text;
  v_phone text;
  v_payment_method text;
  v_attempt_id uuid;
  v_existing_id uuid;
  v_attempt public.midtrans_payments%rowtype;
begin
  if v_buyer_id is null then raise exception 'Masuk terlebih dahulu untuk membayar pesanan.'; end if;
  if p_order_ids is null or cardinality(p_order_ids) < 1 or cardinality(p_order_ids) > 20
    or array_position(p_order_ids, null) is not null then
    raise exception 'Daftar pesanan untuk pembayaran tidak valid.';
  end if;
  select count(distinct x)::integer into v_expected_count from unnest(p_order_ids) x;
  if v_expected_count <> cardinality(p_order_ids) then
    raise exception 'Daftar pesanan pembayaran tidak boleh berisi duplikat.';
  end if;

  perform 1 from public.orders where id = any(p_order_ids) order by id for update;
  select count(*)::integer, coalesce(sum(o.total_amount), 0)::numeric(12, 2),
    (array_agg(o.customer_name order by o.id))[1],
    (array_agg(o.customer_phone order by o.id))[1],
    (array_agg(o.payment_method order by o.id))[1],
    (array_agg(o.payment_attempt_id order by o.id))[1]
  into v_order_count, v_amount, v_name, v_phone, v_payment_method, v_existing_id
  from public.orders o
  where o.id = any(p_order_ids)
    and o.buyer_id = v_buyer_id
    and o.payment_method in ('bank', 'wallet')
    and o.payment_status in ('pending', 'processing', 'failed')
    and o.status not in ('cancelled', 'payment_failed', 'rejected', 'completed', 'delivered');

  if v_order_count <> cardinality(p_order_ids) or v_amount <= 0 then
    raise exception 'Pesanan tidak ditemukan, tidak dapat dibayar, atau bukan milik akun ini.';
  end if;
  if exists (
    select 1 from public.orders o
    where o.id = any(p_order_ids)
      and (o.payment_method <> v_payment_method or o.buyer_id <> v_buyer_id)
  ) then raise exception 'Metode pembayaran pada pesanan tidak konsisten.'; end if;

  if v_existing_id is not null then
    if exists (select 1 from public.orders where id = any(p_order_ids) and payment_attempt_id is distinct from v_existing_id) then
      raise exception 'Pesanan sudah terhubung ke percobaan pembayaran lain.';
    end if;
    select * into v_attempt from public.midtrans_payments where id = v_existing_id for update;
    if found and v_attempt.status in ('creating', 'pending', 'processing') then
      return jsonb_build_object(
        'id', v_attempt.id, 'midtrans_order_id', v_attempt.midtrans_order_id,
        'amount', v_attempt.amount, 'payment_method', v_attempt.payment_method,
        'status', v_attempt.status, 'snap_token', v_attempt.snap_token,
        'redirect_url', v_attempt.redirect_url, 'order_ids', v_attempt.order_ids,
        'customer_name', v_name, 'customer_phone', v_phone
      );
    end if;
    if found and v_attempt.status not in ('failed', 'cancelled', 'expired') then
      raise exception 'Percobaan pembayaran sebelumnya belum dapat diulang.';
    end if;
  elsif exists (select 1 from public.orders where id = any(p_order_ids) and payment_attempt_id is not null) then
    raise exception 'Pesanan sudah terhubung ke percobaan pembayaran lain.';
  end if;

  v_attempt_id := gen_random_uuid();
  insert into public.midtrans_payments(
    id, buyer_id, order_ids, midtrans_order_id, amount, payment_method
  ) values (
    v_attempt_id, v_buyer_id, p_order_ids, 'RasaLokal-' || v_attempt_id::text, v_amount, v_payment_method
  ) returning * into v_attempt;
  update public.orders set payment_attempt_id = v_attempt_id
    where id = any(p_order_ids);
  update public.orders set payment_status = 'pending', updated_at = now()
    where id = any(p_order_ids) and payment_status = 'failed';
  return jsonb_build_object(
    'id', v_attempt.id, 'midtrans_order_id', v_attempt.midtrans_order_id,
    'amount', v_attempt.amount, 'payment_method', v_attempt.payment_method,
    'status', v_attempt.status, 'snap_token', v_attempt.snap_token,
    'redirect_url', v_attempt.redirect_url, 'order_ids', v_attempt.order_ids,
    'customer_name', v_name, 'customer_phone', v_phone
  );
end;
$$;
revoke all on function public.start_midtrans_payment(uuid[]) from public, anon;
grant execute on function public.start_midtrans_payment(uuid[]) to authenticated;

create or replace function public.save_midtrans_snap_details(
  p_attempt_id uuid, p_snap_token text, p_redirect_url text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_snap_token is null or p_snap_token = '' or p_redirect_url is null
    or p_redirect_url !~ '^https://(app|app\.sandbox)\.midtrans\.com/snap/v[0-9]+/(redirection|vtweb)/[A-Za-z0-9_-]+$' then
    raise exception 'Respons pembayaran Midtrans tidak valid.';
  end if;
  update public.midtrans_payments set snap_token = p_snap_token, redirect_url = p_redirect_url,
    status = 'pending', updated_at = now()
  where id = p_attempt_id and status = 'creating';
  if not found then
    if exists (select 1 from public.midtrans_payments where id = p_attempt_id and status in ('pending','processing')) then return; end if;
    raise exception 'Percobaan pembayaran tidak ditemukan atau sudah berakhir.';
  end if;
end;
$$;
revoke all on function public.save_midtrans_snap_details(uuid, text, text) from public, anon, authenticated;
grant execute on function public.save_midtrans_snap_details(uuid, text, text) to service_role;

create or replace function public.process_midtrans_notification(
  p_midtrans_order_id text,
  p_transaction_id text,
  p_transaction_status text,
  p_fraud_status text,
  p_gross_amount numeric
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_attempt public.midtrans_payments%rowtype;
  v_payment_status text;
  v_attempt_status text;
begin
  select * into v_attempt from public.midtrans_payments
    where midtrans_order_id = p_midtrans_order_id for update;
  if not found then raise exception 'Percobaan pembayaran Midtrans tidak ditemukan.'; end if;
  if p_gross_amount is null or p_gross_amount is distinct from v_attempt.amount then
    raise exception 'Nominal notifikasi Midtrans tidak cocok.';
  end if;

  if p_transaction_status in ('refund', 'partial_refund', 'chargeback') then
    update public.midtrans_payments set
      provider_transaction_id = coalesce(p_transaction_id, provider_transaction_id),
      provider_status = p_transaction_status, updated_at = now()
    where id = v_attempt.id;
    return;
  end if;

  if p_transaction_status = 'settlement'
    or (p_transaction_status = 'capture' and p_fraud_status = 'accept') then
    v_payment_status := 'success'; v_attempt_status := 'success';
  elsif p_transaction_status in ('authorize', 'capture', 'pending') then
    v_payment_status := 'processing'; v_attempt_status := 'processing';
  elsif p_transaction_status in ('deny', 'cancel', 'expire', 'failure') then
    v_payment_status := 'failed';
    v_attempt_status := case p_transaction_status when 'cancel' then 'cancelled' when 'expire' then 'expired' else 'failed' end;
  else
    raise exception 'Status transaksi Midtrans tidak dikenali.';
  end if;

  if v_attempt.status = 'success' and v_payment_status <> 'success' then return; end if;
  update public.midtrans_payments set status = v_attempt_status,
    provider_transaction_id = coalesce(p_transaction_id, provider_transaction_id),
    provider_status = p_transaction_status, updated_at = now()
  where id = v_attempt.id;
  update public.orders set payment_status = v_payment_status, updated_at = now()
    where payment_attempt_id = v_attempt.id
      and payment_status is distinct from v_payment_status;
end;
$$;
revoke all on function public.process_midtrans_notification(text, text, text, text, numeric) from public, anon, authenticated;
grant execute on function public.process_midtrans_notification(text, text, text, text, numeric) to service_role;

commit;
