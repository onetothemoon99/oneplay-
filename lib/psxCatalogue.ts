/* ---------------------------------------------------------
   ONEPLAY — PS1 discs as catalogue entries

   The library shows one shelf for everything. Canvas games come from
   Supabase (`platform: 'hub'`); PlayStation titles arrive from two
   places and have to meet in the middle:

     - Supabase rows with `platform: 'psx'` — a title the hub knows
       about. Metadata only: we never hold the disc.
     - Discs in this browser's IndexedDB — the files the player
       actually has.

   A local disc counts as a catalogue title when its slugified name
   matches the row id. Anything left over still gets a card, built
   here out of what a disc image can tell us.
--------------------------------------------------------- */

import type { Game } from './games';
import { extOf, formatBytes, slugify } from './psx';
import type { DiscRecord } from './psxDb';

/* Cover art needs three colours; discs do not have any, so pick a
   triplet from the title — same disc, same cover, every time. */
const PALETTES: string[][] = [
  ['#7C3AED', '#DB2777', '#F59E0B'],
  ['#06B6D4', '#3B82F6', '#8B5CF6'],
  ['#10B981', '#84CC16', '#EAB308'],
  ['#F43F5E', '#F97316', '#FACC15'],
  ['#22C55E', '#14B8A6', '#0EA5E9'],
  ['#0EA5E9', '#6366F1', '#A855F7'],
  ['#EC4899', '#8B5CF6', '#38BDF8'],
  ['#FACC15', '#F97316', '#EF4444']
];

function hash(text: string): number {
  let value = 0;
  for (let i = 0; i < text.length; i++) value = (value * 31 + text.charCodeAt(i)) >>> 0;
  return value;
}

export function accentFor(seed: string | number): string[] {
  return PALETTES[hash(String(seed)) % PALETTES.length];
}

/** "Ape Escape" -> "AE", "Tekken" -> "TE" */
export function glyphFor(title: string): string {
  const words = String(title).trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1
    ? words[0][0] + words[1][0]
    : (words[0] || '?').slice(0, 2);
  return letters.toUpperCase();
}

/** Discs written by older builds carry no gameId; fall back to the title. */
type DiscLike = DiscRecord & { gameId?: string };

export const discSlug = (disc: DiscLike): string => disc.gameId || slugify(disc.title);

/** A disc record -> the shape GameCard / CoverArt already render. */
export function discToGame(disc: DiscRecord): Game {
  const format = extOf(disc.mainFile).replace('.', '').toUpperCase() || 'DISC';
  const added = new Date(disc.addedAt || Date.now());

  return {
    id: disc.id,
    title: disc.title,
    studio: `${format} · ${formatBytes(disc.size)}`,
    glyph: glyphFor(disc.title),
    genre: 'PlayStation',
    tags: ['PlayStation', 'Disc', format],
    // there is no release year in a disc image; sort "Newest" by when the
    // player added it, which is the only date we honestly have
    year: added.getFullYear(),
    rating: 0,
    players: '1 player',
    size: formatBytes(disc.size),
    difficulty: '—',
    accent: accentFor(disc.id),
    tagline: 'A disc in this browser.',
    description: '',
    controls: [],
    features: [],
    trophies: [],
    platform: 'psx',
    href: `/play/psx/${disc.id}`,
    state: 'ready'
  };
}

/**
 * Merge the Supabase catalogue with the discs in this browser.
 *
 * - hub rows pass through untouched
 * - psx rows gain a disc (and a play link) when a local one matches, or a
 *   "Disc needed" badge when none does
 * - local discs with no row of their own become cards in their own right
 *
 * @param games  catalogue rows from Supabase
 * @param discs  records from lib/psxDb.listDiscs()
 */
export function mergeLibrary(games: Game[] = [], discs: DiscRecord[] = []): Game[] {
  const bySlug = new Map(discs.map((disc) => [discSlug(disc), disc]));
  const claimed = new Set<string>();

  const catalogue = games.map((game): Game => {
    if (game.platform !== 'psx') return { ...game, state: 'ready' };

    const disc = bySlug.get(game.id);
    if (disc) claimed.add(disc.id);

    // No label here: this runs outside React, and the wording is the
    // library page's job to translate.
    return {
      ...game,
      state: disc ? 'ready' : 'needs-disc',
      href: disc ? `/play/psx/${disc.id}` : '/play/psx'
    };
  });

  const loose = discs.filter((disc) => !claimed.has(disc.id)).map(discToGame);

  return [...catalogue, ...loose];
}
