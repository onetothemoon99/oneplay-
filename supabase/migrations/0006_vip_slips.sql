-- OnePlay — transfer-slip uploads for VIP top-ups
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- Lets a player attach a photo of their bank transfer slip to a VIP top-up
-- request, so admin review (see 0005_vip_topups.sql) has something to check
-- against, not just a typed-in reference number.

alter table public.vip_topups add column if not exists slip_path text;
comment on column public.vip_topups.slip_path is 'Path in the vip-slips storage bucket to the uploaded transfer-slip image.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vip-slips', 'vip-slips', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  file_size_limit     = excluded.file_size_limit,
  allowed_mime_types  = excluded.allowed_mime_types;

-- Same per-user-folder pattern as the psx-saves bucket: the first path
-- segment is the uploader's id, so a player can only reach their own slips.
drop policy if exists "Players manage their own VIP slips" on storage.objects;
create policy "Players manage their own VIP slips"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'vip-slips' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'vip-slips' and (storage.foldername(name))[1] = auth.uid()::text);
