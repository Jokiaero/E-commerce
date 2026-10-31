create extension if not exists pgcrypto;

create table if not exists public.stores (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  owner_name text not null default '',
  address text not null default '',
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  payment_method text not null default 'bank' check (payment_method in ('bank', 'wallet', 'cod')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  recipient text not null,
  phone text not null,
  details text not null,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  description text not null default '',
  price bigint not null check (price >= 0),
  category text not null check (category in ('Makanan', 'Minuman', 'Camilan', 'Oleh-oleh')),
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant text not null default '',
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id, variant)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'processing', 'shipped', 'completed', 'rejected')),
  customer_name text not null,
  customer_phone text not null,
  delivery_address text not null,
  payment_method text not null check (payment_method in ('bank', 'wallet', 'cod')),
  subtotal bigint not null check (subtotal >= 0),
  shipping_fee bigint not null check (shipping_fee >= 0),
  total_amount bigint not null check (total_amount = subtotal + shipping_fee),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  variant text not null default '',
  quantity integer not null check (quantity > 0),
  unit_price bigint not null check (unit_price >= 0),
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists products_store_id_created_at_idx on public.products (store_id, created_at desc);
create index if not exists cart_items_user_id_idx on public.cart_items (user_id);
create index if not exists orders_buyer_id_created_at_idx on public.orders (buyer_id, created_at desc);
create index if not exists orders_store_id_created_at_idx on public.orders (store_id, created_at desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.products enable row level security;
alter table public.favorites enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Stores are publicly readable" on public.stores;
create policy "Stores are publicly readable" on public.stores for select using (true);
drop policy if exists "Users manage their own store" on public.stores;
create policy "Users manage their own store" on public.stores
  for all using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "Users manage their own profile" on public.profiles;
create policy "Users manage their own profile" on public.profiles
  for all using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists "Users manage their own addresses" on public.addresses;
create policy "Users manage their own addresses" on public.addresses
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Available products are publicly readable" on public.products;
create policy "Available products are publicly readable" on public.products
  for select using (is_available or store_id = (select auth.uid()));
drop policy if exists "Sellers manage their own products" on public.products;
create policy "Sellers manage their own products" on public.products
  for all using (store_id = (select auth.uid())) with check (store_id = (select auth.uid()));

drop policy if exists "Users manage their own favorites" on public.favorites;
create policy "Users manage their own favorites" on public.favorites
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Users manage their own cart" on public.cart_items;
create policy "Users manage their own cart" on public.cart_items
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Buyers and owning sellers read orders" on public.orders;
create policy "Buyers and owning sellers read orders" on public.orders
  for select using (buyer_id = (select auth.uid()) or store_id = (select auth.uid()));
drop policy if exists "Sellers update their own orders" on public.orders;
create policy "Sellers update their own orders" on public.orders
  for update using (store_id = (select auth.uid())) with check (store_id = (select auth.uid()));

drop policy if exists "Buyers and owning sellers read order items" on public.order_items;
create policy "Buyers and owning sellers read order items" on public.order_items
  for select using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and (orders.buyer_id = (select auth.uid()) or orders.store_id = (select auth.uid()))
    )
  );

grant select on public.stores, public.products to anon, authenticated;
grant insert, update, delete on public.stores, public.products to authenticated;
grant select, insert, update, delete on public.profiles, public.addresses, public.favorites to authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;
grant select on public.orders, public.order_items to authenticated;
grant update (status) on public.orders to authenticated;

create or replace function public.checkout_cart(
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_payment_method text,
  p_shipping_fee bigint
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
  if p_payment_method not in ('bank', 'wallet', 'cod') or p_shipping_fee < 0 then
    raise exception 'Metode pembayaran atau ongkos kirim tidak valid.';
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
      buyer_id, store_id, customer_name, customer_phone, delivery_address,
      payment_method, subtotal, shipping_fee, total_amount
    ) values (
      v_user_id, v_group.store_id, trim(p_customer_name), trim(p_customer_phone), trim(p_delivery_address),
      p_payment_method, v_group.subtotal, p_shipping_fee, v_group.subtotal + p_shipping_fee
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

revoke all on function public.checkout_cart(text, text, text, text, bigint) from public, anon;
grant execute on function public.checkout_cart(text, text, text, text, bigint) to authenticated;