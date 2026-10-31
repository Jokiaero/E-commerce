alter table public.profiles
  add column if not exists avatar_path text;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'rejected')),
  requested_at timestamptz not null default now()
);

create unique index if not exists account_deletion_requests_one_active_per_user_idx
  on public.account_deletion_requests (user_id)
  where status in ('pending', 'processing');

alter table public.account_deletion_requests enable row level security;

drop policy if exists "Users read their account deletion requests" on public.account_deletion_requests;
create policy "Users read their account deletion requests" on public.account_deletion_requests
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users submit their account deletion requests" on public.account_deletion_requests;
create policy "Users submit their account deletion requests" on public.account_deletion_requests
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

grant select, insert on public.account_deletion_requests to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  false,
  5242880,
  array['image/avif', 'image/heic', 'image/heif', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users read their profile photos" on storage.objects;
create policy "Users read their profile photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users upload their profile photos" on storage.objects;
create policy "Users upload their profile photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users update their profile photos" on storage.objects;
create policy "Users update their profile photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users delete their profile photos" on storage.objects;
create policy "Users delete their profile photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );