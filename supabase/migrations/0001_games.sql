-- OnePlay — game catalogue
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It creates public.games, enables RLS with public (anon) read access, and seeds
-- the eight titles that used to live in lib/games.ts.

create table if not exists public.games (
  id          text primary key,
  title       text not null,
  studio      text not null,
  glyph       text not null,
  genre       text not null,
  tags        text[] not null default '{}',
  year        integer not null,
  rating      real not null,
  players     text not null,
  size        text not null,
  difficulty  text not null,
  accent      text[] not null default '{}',
  tagline     text not null,
  description text not null,
  controls    jsonb not null default '[]'::jsonb,
  features    text[] not null default '{}',
  trophies    jsonb not null default '[]'::jsonb,
  -- position in the original GAMES array; drives the "Featured" sort order
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.games is 'Public game catalogue. Read-only for visitors; writes are service-role only.';

alter table public.games enable row level security;

-- The catalogue is public content: anyone (signed in or not) may read it.
-- No insert/update/delete policy exists, so writes are only possible with the
-- service_role key (or from the SQL editor).
drop policy if exists "Games are publicly readable" on public.games;
create policy "Games are publicly readable"
  on public.games for select
  to anon, authenticated
  using (true);

-- Defence in depth: Supabase grants anon/authenticated full table privileges on
-- everything in the public schema by default, and RLS is the only thing standing
-- in the way. Take the write privileges away too, so a missing policy can never
-- become a writable table. SELECT stays, which is what the site needs.
revoke insert, update, delete, truncate on public.games from anon, authenticated;

create index if not exists games_sort_order_idx on public.games (sort_order);
create index if not exists games_genre_idx on public.games (genre);

-- Seed / refresh the catalogue ------------------------------------------------

insert into public.games
  (id, title, studio, glyph, genre, tags, year, rating, players, size,
   difficulty, accent, tagline, description, controls, features, trophies, sort_order)
values
  (
    'astro-drift',
    'Astro Drift',
    'Nebula Forge',
    'AD',
    'Arcade Shooter',
    ARRAY['Arcade', 'Space', 'Single player']::text[],
    2025,
    4.8,
    '1 player',
    '184 KB',
    'Medium',
    ARRAY['#7C3AED', '#DB2777', '#F59E0B']::text[],
    'Rotate, thrust, survive the belt.',
    'Zero-gravity dogfighting against a collapsing asteroid belt. Every rock you break splits into faster debris, so clearing a wave is always a trade between safety and score. Momentum never stops — learn to fly with the drift instead of against it.',
    '[["← →","Rotate ship"],["↑","Thrust"],["Space","Fire"]]'::jsonb,
    ARRAY['Endless waves', 'Score multiplier', 'Local leaderboard']::text[],
    '[{"name":"First Contact","desc":"Destroy 10 asteroids","tier":"Bronze","target":500},{"name":"Belt Runner","desc":"Reach 3,000 points","tier":"Silver","target":3000},{"name":"Void Ace","desc":"Reach 8,000 points","tier":"Gold","target":8000}]'::jsonb,
    0
  ),
  (
    'neon-runner',
    'Neon Runner',
    'Halcyon Bit',
    'NR',
    'Endless Runner',
    ARRAY['Runner', 'Reflex', 'Single player']::text[],
    2026,
    4.6,
    '1 player',
    '132 KB',
    'Easy',
    ARRAY['#06B6D4', '#3B82F6', '#8B5CF6']::text[],
    'The city speeds up. You do not slow down.',
    'A one-track sprint through a skyline that keeps accelerating. Jump the barriers, slide under the beams, and read the road two obstacles ahead. Simple to start, brutal past the 60-second mark.',
    '[["↑ / Space","Jump"],["↓","Slide"],["Hold ↑","Higher jump"]]'::jsonb,
    ARRAY['Speed ramp', 'Distance scoring', 'One-button friendly']::text[],
    '[{"name":"Warm Up","desc":"Run 500 metres","tier":"Bronze","target":500},{"name":"City Blur","desc":"Run 2,000 metres","tier":"Silver","target":2000},{"name":"Light Speed","desc":"Run 5,000 metres","tier":"Gold","target":5000}]'::jsonb,
    1
  ),
  (
    'block-fall',
    'Block Fall',
    'Grid Theory',
    'BF',
    'Puzzle',
    ARRAY['Puzzle', 'Classic', 'Single player']::text[],
    2024,
    4.9,
    '1 player',
    '96 KB',
    'Medium',
    ARRAY['#10B981', '#84CC16', '#EAB308']::text[],
    'Stack it clean or drown in your own mistakes.',
    'The falling-block puzzle in its purest form: seven pieces, ten levels of gravity, and one well that punishes hesitation. Clear four rows at once for the big payout, or play it safe and keep the stack flat.',
    '[["← →","Move piece"],["↑","Rotate"],["↓","Soft drop"],["Space","Hard drop"]]'::jsonb,
    ARRAY['10 gravity levels', 'Next-piece preview', 'Quad-clear bonus']::text[],
    '[{"name":"Clean Line","desc":"Score 1,000 points","tier":"Bronze","target":1000},{"name":"Stack Master","desc":"Score 6,000 points","tier":"Silver","target":6000},{"name":"Perfect Well","desc":"Score 15,000 points","tier":"Gold","target":15000}]'::jsonb,
    2
  ),
  (
    'sky-breaker',
    'Sky Breaker',
    'Orbital Nine',
    'SB',
    'Arcade',
    ARRAY['Arcade', 'Classic', 'Single player']::text[],
    2025,
    4.4,
    '1 player',
    '88 KB',
    'Easy',
    ARRAY['#F43F5E', '#F97316', '#FACC15']::text[],
    'Six rows between you and the next level.',
    'Angle the paddle, bend the ball, bring the wall down. Hitting the edge of the paddle throws sharper angles — the fastest clears come from players who stop centring every bounce.',
    '[["← →","Move paddle"],["Mouse","Move paddle"],["Space","Launch ball"]]'::jsonb,
    ARRAY['Angle physics', 'Level progression', '3 lives']::text[],
    '[{"name":"Cracked It","desc":"Score 500 points","tier":"Bronze","target":500},{"name":"Wall Down","desc":"Score 2,500 points","tier":"Silver","target":2500},{"name":"Sky Clear","desc":"Score 6,000 points","tier":"Gold","target":6000}]'::jsonb,
    3
  ),
  (
    'snake-protocol',
    'Snake Protocol',
    'Grid Theory',
    'SP',
    'Arcade',
    ARRAY['Arcade', 'Classic', 'Single player']::text[],
    2024,
    4.3,
    '1 player',
    '64 KB',
    'Easy',
    ARRAY['#22C55E', '#14B8A6', '#0EA5E9']::text[],
    'Grow long. Stay alive. Same as always.',
    'A data-worm loose in a 30×20 grid. Each packet you collect makes you longer and slightly faster, and the walls are not decorative. The only real enemy is the tail you built yourself.',
    '[["Arrows","Turn"],["P","Pause"]]'::jsonb,
    ARRAY['Speed scaling', 'Wall collision', 'Compact grid']::text[],
    '[{"name":"First Packet","desc":"Score 50 points","tier":"Bronze","target":50},{"name":"Long Protocol","desc":"Score 300 points","tier":"Silver","target":300},{"name":"Full Loop","desc":"Score 800 points","tier":"Gold","target":800}]'::jsonb,
    4
  ),
  (
    'paddle-arena',
    'Paddle Arena',
    'Halcyon Bit',
    'PA',
    'Sports',
    ARRAY['Sports', 'Versus', 'Classic']::text[],
    2023,
    4.1,
    '1 player vs CPU',
    '58 KB',
    'Medium',
    ARRAY['#0EA5E9', '#6366F1', '#A855F7']::text[],
    'First to seven takes the arena.',
    'The original versus match, rebuilt with a CPU that actually reads the ball. Rally length feeds the ball speed, so long points get dangerous fast. Best of seven, no mercy rule.',
    '[["↑ ↓","Move paddle"],["Mouse","Move paddle"]]'::jsonb,
    ARRAY['Adaptive CPU', 'Rally acceleration', 'First to 7']::text[],
    '[{"name":"On the Board","desc":"Win 1 point","tier":"Bronze","target":1},{"name":"Match Point","desc":"Reach 5 points","tier":"Silver","target":5},{"name":"Arena Champion","desc":"Win the match","tier":"Gold","target":7}]'::jsonb,
    5
  ),
  (
    'memory-grid',
    'Memory Grid',
    'Nebula Forge',
    'MG',
    'Casual',
    ARRAY['Casual', 'Puzzle', 'Family']::text[],
    2026,
    4.5,
    '1 player',
    '72 KB',
    'Relaxed',
    ARRAY['#EC4899', '#8B5CF6', '#38BDF8']::text[],
    'Sixteen tiles. Eight pairs. One memory.',
    'A calm pattern-matching board with a running clock. Fewer moves and faster clears push your score higher, so the perfect run is a memory exercise, not a clicking race.',
    '[["Click / Tap","Flip tile"],["Arrows + Enter","Keyboard play"]]'::jsonb,
    ARRAY['Move counter', 'Time bonus', 'Mouse or keyboard']::text[],
    '[{"name":"Pair Up","desc":"Score 200 points","tier":"Bronze","target":200},{"name":"Sharp Recall","desc":"Score 700 points","tier":"Silver","target":700},{"name":"Total Recall","desc":"Score 1,200 points","tier":"Gold","target":1200}]'::jsonb,
    6
  ),
  (
    'reflex-ring',
    'Reflex Ring',
    'Orbital Nine',
    'RR',
    'Casual',
    ARRAY['Casual', 'Reflex', 'Party']::text[],
    2026,
    4.2,
    '1 player',
    '54 KB',
    'Hard',
    ARRAY['#FACC15', '#F97316', '#EF4444']::text[],
    'Thirty seconds. Hit every ring.',
    'Targets bloom and shrink across the arena on a thirty-second clock. Hitting a ring dead centre pays triple, a miss breaks your streak, and the rings get smaller the better you do.',
    '[["Click / Tap","Hit ring"],["—","30 second round"]]'::jsonb,
    ARRAY['Streak multiplier', 'Centre-hit bonus', '30s rounds']::text[],
    '[{"name":"Quick Hand","desc":"Score 400 points","tier":"Bronze","target":400},{"name":"Locked In","desc":"Score 1,500 points","tier":"Silver","target":1500},{"name":"Untouchable","desc":"Score 3,000 points","tier":"Gold","target":3000}]'::jsonb,
    7
  )
on conflict (id) do update set
  title       = excluded.title,
  studio      = excluded.studio,
  glyph       = excluded.glyph,
  genre       = excluded.genre,
  tags        = excluded.tags,
  year        = excluded.year,
  rating      = excluded.rating,
  players     = excluded.players,
  size        = excluded.size,
  difficulty  = excluded.difficulty,
  accent      = excluded.accent,
  tagline     = excluded.tagline,
  description = excluded.description,
  controls    = excluded.controls,
  features    = excluded.features,
  trophies    = excluded.trophies,
  sort_order  = excluded.sort_order;
