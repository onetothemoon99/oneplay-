/* ---------------------------------------------------------
   ONEPLAY — game catalogue data access (server only)

   Reads the catalogue from the `public.games` table in Supabase
   (see supabase/migrations/0001_games.sql). If the table has not been
   created/seeded yet — or Supabase is unreachable — this falls back to the
   bundled GAMES array so the site keeps rendering.

   Only import this from Server Components / Server Actions: it touches
   cookies() and the Supabase server client.
--------------------------------------------------------- */

import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { GAMES, type ControlRow, type Game, type Platform, type Trophy } from './games';

const COLUMNS =
  'id, title, studio, glyph, genre, tags, year, rating, players, size, ' +
  'difficulty, accent, tagline, description, controls, features, trophies';

// Added by supabase/migrations/0002_platform.sql. Selected separately so a
// database still on 0001 keeps working — see the retry in getGames().
const PLATFORM_COLUMN = 'platform';

/** A row as it comes back from PostgREST: every column nullable until proven otherwise. */
interface GameRow {
  id: string;
  title: string;
  studio: string;
  glyph: string;
  genre: string;
  tags: string[] | null;
  year: number;
  rating: number | string;
  players: string;
  size: string;
  difficulty: string;
  accent: string[] | null;
  tagline: string;
  description: string;
  controls: ControlRow[] | null;
  features: string[] | null;
  trophies: Trophy[] | null;
  platform?: Platform | null;
}

/** Where the catalogue actually came from. */
export type CatalogueSource = 'supabase' | 'local';

/* DB row -> the plain game object the UI components already expect. */
function toGame(row: GameRow | Game): Game {
  return {
    id: row.id,
    title: row.title,
    studio: row.studio,
    glyph: row.glyph,
    genre: row.genre,
    tags: row.tags || [],
    year: row.year,
    rating: Number(row.rating),
    players: row.players,
    size: row.size,
    difficulty: row.difficulty,
    accent: row.accent || [],
    tagline: row.tagline,
    description: row.description,
    controls: row.controls || [],
    features: row.features || [],
    trophies: row.trophies || [],
    // 'hub' = bundled canvas game, 'psx' = PlayStation title (disc supplied by
    // the player). Rows written before migration 0002 have no column at all.
    platform: row.platform || 'hub'
  };
}

/**
 * The full catalogue, in "Featured" order (the original GAMES order, kept in
 * the `sort_order` column).
 */
export async function getGames(): Promise<{ games: Game[]; source: CatalogueSource }> {
  // Awaited outside the try: cookies() throws Next's own DynamicServerError
  // during static generation, and that has to reach the framework instead of
  // being mistaken for "Supabase is down".
  const cookieStore = await cookies();

  try {
    const supabase = createClient(cookieStore);

    const read = (columns: string) => supabase
      .from('games')
      .select(columns)
      .order('sort_order', { ascending: true })
      .overrideTypes<GameRow[]>();

    let { data, error } = await read(`${COLUMNS}, ${PLATFORM_COLUMN}`);

    // 42703 = undefined_column: the database has not had 0002_platform.sql run
    // against it yet. Losing the whole catalogue over one missing column would
    // be a bad trade, so read it without and let toGame() default to 'hub'.
    if (error?.code === '42703') {
      console.warn('[games] no platform column — run supabase/migrations/0002_platform.sql');
      ({ data, error } = await read(COLUMNS));
    }

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('games table is empty');

    return { games: data.map(toGame), source: 'supabase' };
  } catch (e) {
    console.warn(
      '[games] falling back to lib/games.ts — could not read the Supabase catalogue:',
      (e as Error)?.message || e
    );
    return { games: GAMES.map(toGame), source: 'local' };
  }
}

/** A single game by id, or null. Same fallback behaviour as getGames(). */
export async function getGameById(id: string): Promise<{ game: Game | null; source: CatalogueSource }> {
  const { games, source } = await getGames();
  return { game: games.find((g) => g.id === id) || null, source };
}
