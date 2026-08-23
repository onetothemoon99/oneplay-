-- OnePlay — one catalogue for both kinds of game
-- Run this in the Supabase SQL editor after 0001_games.sql. Re-running is safe.
--
-- Until now every row in public.games was a bundled canvas game. `platform`
-- splits the catalogue in two:
--
--   'hub' — the built-in canvas games. Code ships with the app, always playable.
--   'psx' — a PlayStation title. The row is metadata only (name, art, genre);
--           the disc image is never stored here and never served by us. A player
--           sees the card in the library and supplies their own dump on
--           /play/psx, which is kept in their browser (IndexedDB), not in this
--           table.
--
-- So a 'psx' row means "the hub knows about this title", not "the hub has it".

alter table public.games
  add column if not exists platform text not null default 'hub';

alter table public.games drop constraint if exists games_platform_check;
alter table public.games
  add constraint games_platform_check check (platform in ('hub', 'psx'));

comment on column public.games.platform is
  'hub = bundled canvas game; psx = PlayStation title, metadata only — the player brings the disc.';

-- Everything seeded by 0001 is a canvas game.
update public.games set platform = 'hub' where platform is null or platform = '';

create index if not exists games_platform_idx on public.games (platform);

-- Adding a PlayStation title later looks like this (nothing is seeded here,
-- because the catalogue ships no games):
--
--   insert into public.games
--     (id, title, studio, glyph, genre, tags, year, rating, players, size,
--      difficulty, accent, tagline, description, controls, features, trophies,
--      sort_order, platform)
--   values
--     ('some-title', 'Some Title', 'Some Studio', 'ST', 'Platformer',
--      ARRAY['PlayStation']::text[], 1998, 4.7, '1 player', 'CD-ROM', 'Medium',
--      ARRAY['#7C3AED', '#DB2777', '#F59E0B']::text[],
--      'One line of flavour.', 'A longer description.',
--      '[]'::jsonb, ARRAY[]::text[], '[]'::jsonb, 100, 'psx')
--   on conflict (id) do nothing;
--
-- The library then shows it with a "Disc needed" badge until the player adds a
-- matching disc, which is linked by id: a local disc whose slugified title
-- equals the row id counts as that title.
