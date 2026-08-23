-- OnePlay — cloud backup for PS1 saves (memory card + save states)
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- The memory card (SRAM) and save states for each PS1 disc live in the
-- player's browser (IndexedDB, see lib/psxDb.ts) and stay there. This
-- bucket is only a backup: when a signed-in player's browser has no local
-- copy yet, the app restores it from here (see lib/psxCloudSync.ts).
-- Objects per (player, disc title):
--   `<user id>/<slugified title>.bin`             — memory card
--   `<user id>/<slugified title>-state-<slot>.bin` — save state, slot 1-3
-- Keyed by title, not the local disc id, so it still matches when the
-- same game is added again on a different browser/device.

insert into storage.buckets (id, name, public)
values ('psx-saves', 'psx-saves', false)
on conflict (id) do nothing;

-- A player may read/write only inside their own folder. The first path
-- segment is the user id, so `storage.foldername(name)[1]` has to match
-- `auth.uid()` — the standard per-user-bucket pattern.
drop policy if exists "Players manage their own PSX saves" on storage.objects;
create policy "Players manage their own PSX saves"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'psx-saves' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'psx-saves' and (storage.foldername(name))[1] = auth.uid()::text);
