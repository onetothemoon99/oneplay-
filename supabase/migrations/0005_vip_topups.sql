-- OnePlay — VIP top-up requests (manual bank transfer)
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- There is no payment gateway: a player transfers money by bank and submits
-- the reference here. An admin reviews pending rows in the Table Editor and
-- flips `status` to 'approved' or 'rejected' — approving one automatically
-- turns on VIP (see the trigger below), so there's nothing else to run by
-- hand. Rejecting just leaves is_vip untouched.

create extension if not exists pgcrypto;

do $$ begin
  create type public.vip_topup_status as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.vip_topups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  amount      numeric(10,2) not null check (amount > 0),
  -- whatever the player can point to their transfer with: last 4 digits of
  -- their account, a bank transaction id, a slip number — free text, verified
  -- by eye against the bank statement, not machine-matched.
  reference   text not null check (char_length(reference) between 1 and 120),
  note        text check (note is null or char_length(note) <= 500),
  status      public.vip_topup_status not null default 'pending',
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);

comment on table public.vip_topups is 'Player-submitted bank-transfer top-ups awaiting manual review. Approving one flips profiles.is_vip via trigger.';

alter table public.vip_topups enable row level security;

-- A player may create and read only their own requests, and only ever as
-- 'pending' — review (approve/reject) happens from the dashboard with the
-- service role, which bypasses RLS, so no update/delete policy exists here.
drop policy if exists "Players submit their own top-up" on public.vip_topups;
create policy "Players submit their own top-up"
  on public.vip_topups for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "Players read their own top-ups" on public.vip_topups;
create policy "Players read their own top-ups"
  on public.vip_topups for select
  to authenticated
  using (user_id = auth.uid());

revoke update, delete, truncate on public.vip_topups from anon, authenticated;

-- Approving a top-up (status -> 'approved') grants VIP. Runs as the function
-- owner so it can write public.profiles even though the caller (an admin
-- using the service role) already bypasses RLS anyway — kept consistent so
-- this still works if review is ever done through anon/authenticated instead.
create or replace function public.handle_vip_topup_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.profiles (user_id, is_vip)
    values (new.user_id, true)
    on conflict (user_id) do update set is_vip = true, updated_at = now();
    new.reviewed_at = now();
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    new.reviewed_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists vip_topup_approved on public.vip_topups;
create trigger vip_topup_approved
  before update on public.vip_topups
  for each row execute function public.handle_vip_topup_approved();

create index if not exists vip_topups_user_id_idx on public.vip_topups (user_id);
