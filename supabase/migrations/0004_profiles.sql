-- OnePlay — player profiles (VIP membership)
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- VIP is a flag on the player, not something the app can infer from anything
-- else in the schema. There is no billing integration yet — until there is
-- one, flip a player to VIP by hand:
--   insert into public.profiles (user_id, is_vip) values ('<uuid>', true)
--   on conflict (user_id) do update set is_vip = excluded.is_vip;
-- A missing row means "not VIP" (see lib/auth.ts), so profiles only need to
-- be created for players actually granted VIP.

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  is_vip     boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Per-player flags (VIP membership, …). A missing row means the defaults apply.';

alter table public.profiles enable row level security;

-- A player may read only their own row. Writes are service-role only (there is
-- no self-serve upgrade flow yet), so no insert/update/delete policy exists.
drop policy if exists "Players read their own profile" on public.profiles;
create policy "Players read their own profile"
  on public.profiles for select
  to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
