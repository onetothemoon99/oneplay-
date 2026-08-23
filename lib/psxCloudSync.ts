'use client';

/* ---------------------------------------------------------
   ONEPLAY — cloud backup for PS1 saves

   The memory card (SRAM) and save states stay in IndexedDB as the source
   of truth (see lib/psxDb.ts). This only backs the current copies up to
   Supabase Storage for signed-in players, so they can be restored the
   first time a disc is booted (SRAM) or a slot is loaded (save states) on
   a browser that has no local copy yet — see components/PsxStage.tsx.

   Keyed by the disc's *title*, not its local `disc.id` — every "add to
   library" mints a fresh random id (see the `discId()` helper in
   PsxLibraryClient.tsx), so an id never matches across two browsers/devices
   even for the same game. The slugified title is the one thing that stays
   stable when the same disc is added again somewhere else. The trade-off:
   renaming a disc (or two different discs sharing a title) changes/shares
   its cloud slot — acceptable for a single-slot backup, not for anything
   that needs to tell discs apart precisely.

   One SRAM object and up to three state objects per (player, title).
   Every call is best-effort: callers treat a failure the same as "no
   cloud backup exists".
--------------------------------------------------------- */

import { createClient } from '@/utils/supabase/client';
import { slugify } from '@/lib/psx';

const BUCKET = 'psx-saves';

const sramPath = (userId: string, title: string) => `${userId}/${slugify(title)}.bin`;
const statePath = (userId: string, title: string, slot: number) => `${userId}/${slugify(title)}-state-${slot}.bin`;

export async function pushSram(userId: string, title: string, blob: Blob): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(BUCKET).upload(sramPath(userId, title), blob, {
    upsert: true,
    contentType: 'application/octet-stream'
  });
}

export async function pullSram(userId: string, title: string): Promise<Blob | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(sramPath(userId, title));
  if (error || !data) return null;
  return data;
}

export async function pushState(userId: string, title: string, slot: number, blob: Blob): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(BUCKET).upload(statePath(userId, title, slot), blob, {
    upsert: true,
    contentType: 'application/octet-stream'
  });
}

export async function pullState(userId: string, title: string, slot: number): Promise<Blob | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(statePath(userId, title, slot));
  if (error || !data) return null;
  return data;
}
