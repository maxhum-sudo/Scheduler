-- Run this in your Supabase SQL editor to set up the database

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

-- Auto-create profile on new user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
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

-- RLS: groups
create policy "Members can view their groups"
  on public.groups for select
  using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = groups.id
        and group_members.user_id = auth.uid()
    )
  );

create policy "Authenticated users can create groups"
  on public.groups for insert
  with check (auth.uid() = created_by);

-- RLS: group_members
create policy "Members can view group membership"
  on public.group_members for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id
        and gm.user_id = auth.uid()
    )
  );

create policy "Authenticated users can join groups"
  on public.group_members for insert
  with check (auth.uid() = user_id);

create policy "Members can leave groups"
  on public.group_members for delete
  using (auth.uid() = user_id);

-- RLS: availability
create policy "Group members can view availability"
  on public.availability for select
  using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = availability.group_id
        and group_members.user_id = auth.uid()
    )
  );

create policy "Users can manage their own availability"
  on public.availability for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own availability"
  on public.availability for delete
  using (auth.uid() = user_id);

-- Enable realtime for availability table
alter publication supabase_realtime add table public.availability;
