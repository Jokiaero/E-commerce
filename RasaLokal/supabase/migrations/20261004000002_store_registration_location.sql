alter table public.stores
  add column if not exists store_type text not null default '',
  add column if not exists merchant_category text not null default '',
  add column if not exists contact_email text,
  add column if not exists has_qris boolean not null default false,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stores_coordinate_pair_check'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores add constraint stores_coordinate_pair_check
      check ((latitude is null and longitude is null) or
        (latitude between -90 and 90 and longitude between -180 and 180));
  end if;
end;
$$;