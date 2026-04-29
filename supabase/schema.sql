-- Run this in your Supabase SQL editor to set up the database from scratch.
-- For an existing install, run the migration-*.sql files in order instead.

-- Schema usage and default privileges for the authenticated role
grant usage on schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- Public user profiles (readable by any authenticated user)
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users on delete cascade,
  name       text,
  avatar_url text,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Authenticated users can read all profiles"
  on public.profiles for select
  using (auth.uid() is not null);

create policy "Users can upsert their own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = user_id);

-- Auto-create profile on new user signup (magic-link friendly: falls back to email username)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Groups table
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text unique not null,
  created_by  uuid references auth.users on delete set null,
  created_at  timestamptz default now()
);

-- Group members
create table if not exists public.group_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  joined_at  timestamptz default now(),
  unique (group_id, user_id)
);

-- Availability slots
create table if not exists public.availability (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  group_id    uuid not null references public.groups on delete cascade,
  slot_start  timestamptz not null,
  unique (user_id, group_id, slot_start)
);

-- Indexes for common queries
create index if not exists availability_group_id_idx on public.availability (group_id);
create index if not exists availability_user_id_idx on public.availability (user_id);
create index if not exists group_members_group_id_idx on public.group_members (group_id);
create index if not exists group_members_user_id_idx on public.group_members (user_id);

-- Enable Row Level Security
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.availability enable row level security;

-- Helper that bypasses RLS to check membership without recursion
create or replace function public.is_group_member(_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_group_member(uuid) from public;
grant execute on function public.is_group_member(uuid) to authenticated;

-- RLS: groups
create policy "Members can view their groups"
  on public.groups for select
  using (auth.uid() = created_by or public.is_group_member(id));

create policy "Authenticated users can create groups"
  on public.groups for insert
  with check (auth.uid() = created_by);

-- RLS: group_members
create policy "Members can view group membership"
  on public.group_members for select
  using (public.is_group_member(group_id));

create policy "Authenticated users can join groups"
  on public.group_members for insert
  with check (auth.uid() = user_id);

create policy "Members can leave groups"
  on public.group_members for delete
  using (auth.uid() = user_id);

-- RLS: availability
create policy "Group members can view availability"
  on public.availability for select
  using (public.is_group_member(group_id));

create policy "Users can manage their own availability"
  on public.availability for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own availability"
  on public.availability for delete
  using (auth.uid() = user_id);

-- Explicit table grants (in addition to default privileges above)
grant select, insert, delete on public.groups to authenticated;
grant select, insert, delete on public.group_members to authenticated;
grant select, insert, delete on public.availability to authenticated;
grant select, insert, update on public.profiles to authenticated;

-- RPC: discover and join a group by invite code (bypasses RLS for the lookup)
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

-- Enable realtime for availability table
alter publication supabase_realtime add table public.availability;
