-- Comprehensive fix: GRANT permissions, join-by-invite RPC,
-- magic-link-friendly profile trigger, and profile backfill.
-- Run this in your Supabase SQL editor.

-- ================================================================
-- 1. GRANT table privileges to authenticated role
-- ================================================================
-- Without these, "permission denied" fires before RLS even runs.

grant usage on schema public to authenticated;

grant select, insert, delete on public.groups to authenticated;
grant select, insert, delete on public.group_members to authenticated;
grant select, insert, delete on public.availability to authenticated;
grant select, insert, update on public.profiles to authenticated;

-- Default for any future tables we add
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;


-- ================================================================
-- 2. RPC: join_group_by_code
-- ================================================================
-- Lets a user discover a group by its invite_code WITHOUT first being
-- a member (which RLS would otherwise require). Runs as definer so it
-- bypasses RLS for the lookup, then inserts the membership row.

create or replace function public.join_group_by_code(_code text)
returns table (group_id uuid, invite_code text, name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  _gid uuid;
  _name text;
  _normalized text := upper(trim(_code));
begin
  if auth.uid() is null then
    raise exception 'Must be signed in';
  end if;

  select id, groups.name into _gid, _name
  from public.groups
  where groups.invite_code = _normalized;

  if _gid is null then
    return;
  end if;

  insert into public.group_members (group_id, user_id)
  values (_gid, auth.uid())
  on conflict (group_id, user_id) do nothing;

  return query select _gid, _normalized, _name;
end;
$$;

revoke all on function public.join_group_by_code(text) from public;
grant execute on function public.join_group_by_code(text) to authenticated;


-- ================================================================
-- 3. Improve handle_new_user — magic link users have no full_name
-- ================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Re-create the trigger (idempotent)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ================================================================
-- 4. Backfill profiles for users who already signed up
-- ================================================================

insert into public.profiles (user_id, name, avatar_url)
select
  u.id,
  coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  ),
  u.raw_user_meta_data->>'avatar_url'
from auth.users u
on conflict (user_id) do nothing;
