alter table public.stores
  add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-images',
  'store-images',
  true,
  5242880,
  array['image/avif', 'image/heic', 'image/heif', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Store photos are publicly readable" on storage.objects;
create policy "Store photos are publicly readable" on storage.objects
  for select using (bucket_id = 'store-images');

drop policy if exists "Sellers upload their store photos" on storage.objects;
create policy "Sellers upload their store photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'store-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Sellers update their store photos" on storage.objects;
create policy "Sellers update their store photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'store-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'store-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Sellers delete their store photos" on storage.objects;
create policy "Sellers delete their store photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'store-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );