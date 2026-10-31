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
