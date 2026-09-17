-- OnePlay — PS1 playtime, kept per account
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- The disc shelf already counts sessions/seconds per disc in IndexedDB (see
-- lib/psxDb.ts), but that lives in one browser and is gone the moment site
-- data is cleared or the player switches device. This mirrors it server-side
-- so a signed-in player's "what did I play, and for how long" survives that.
--
-- Keyed by the disc's *title* the same way psx-saves is (see
-- lib/psxCloudSync.ts): a local disc id is random per browser, but the
-- slugified title is the one thing that stays stable for the same game
-- added again elsewhere.

create table if not exists public.psx_playtime (
  user_id        uuid not null references auth.users (id) on delete cascade,
  game_key       text not null check (char_length(game_key) between 1 and 40),
  title          text not null check (char_length(title) between 1 and 200),
  plays          integer not null default 0,
  seconds        integer not null default 0,
  last_played_at timestamptz not null default now(),
  primary key (user_id, game_key)
);

comment on table public.psx_playtime is 'Per-player, per-game PS1 session totals — which disc, how many sessions, how many seconds. Written through record_psx_playtime(), not upserted directly.';

alter table public.psx_playtime enable row level security;

drop policy if exists "Players read their own PSX playtime" on public.psx_playtime;
create policy "Players read their own PSX playtime"
  on public.psx_playtime for select
  to authenticated
  using (user_id = auth.uid());

-- Writes go through record_psx_playtime() below, which runs as the calling
-- player (security invoker, the Postgres default) — these policies are what
-- actually let that function's insert/update through.
drop policy if exists "Players record their own PSX playtime" on public.psx_playtime;
create policy "Players record their own PSX playtime"
  on public.psx_playtime for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Players update their own PSX playtime" on public.psx_playtime;
create policy "Players update their own PSX playtime"
  on public.psx_playtime for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke delete, truncate on public.psx_playtime from anon, authenticated;

-- One round trip, race-safe: a session's seconds get added to whatever is
-- already there instead of the client having to read-modify-write.
create or replace function public.record_psx_playtime(p_game_key text, p_title text, p_seconds integer)
returns void
language plpgsql
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  insert into public.psx_playtime (user_id, game_key, title, plays, seconds, last_played_at)
  values (auth.uid(), p_game_key, p_title, 1, greatest(p_seconds, 0), now())
  on conflict (user_id, game_key) do update set
    plays          = public.psx_playtime.plays + 1,
    seconds        = public.psx_playtime.seconds + greatest(p_seconds, 0),
    title          = excluded.title,
    last_played_at = now();
end;
$$;
