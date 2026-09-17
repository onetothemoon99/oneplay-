'use client';

/* ---------------------------------------------------------
   ONEPLAY — PS1 playtime, kept per account

   lib/psxDb.ts already counts sessions/seconds per disc in IndexedDB —
   this backs that up to Supabase for a signed-in player, keyed by the
   disc's *title* the same way lib/psxCloudSync.ts keys save data, so the
   same game read on another browser adds to the same row instead of
   starting a new one.

   Best-effort like the rest of the cloud sync: a failure here just means
   this session's minutes are not counted server-side, same as if the
   player were signed out.
--------------------------------------------------------- */

import { createClient } from '@/utils/supabase/client';
import { slugify } from '@/lib/psx';

/** One game's totals across every device a player has used. */
export interface PlaytimeRecord {
  gameKey: string;
  title: string;
  plays: number;
  seconds: number;
  lastPlayedAt: number;
}

export async function recordPlaytime(title: string, seconds: number): Promise<void> {
  const supabase = createClient();
  await supabase.rpc('record_psx_playtime', {
    p_game_key: slugify(title),
    p_title: title,
    p_seconds: Math.round(seconds || 0)
  });
}

export async function listPlaytime(): Promise<PlaytimeRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('psx_playtime')
    .select('game_key, title, plays, seconds, last_played_at')
    .order('last_played_at', { ascending: false });
  if (error || !data) return [];

  return data.map((row) => ({
    gameKey: row.game_key,
    title: row.title,
    plays: row.plays,
    seconds: row.seconds,
    lastPlayedAt: row.last_played_at ? new Date(row.last_played_at).getTime() : 0
  }));
}
