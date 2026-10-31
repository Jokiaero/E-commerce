alter table public.products
  add column if not exists product_details jsonb not null default '{}'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/avif', 'image/heic', 'image/heif', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Product photos are publicly readable" on storage.objects;
create policy "Product photos are publicly readable" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "Sellers upload their product photos" on storage.objects;
create policy "Sellers upload their product photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Sellers update their product photos" on storage.objects;
create policy "Sellers update their product photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Sellers delete their product photos" on storage.objects;
create policy "Sellers delete their product photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );