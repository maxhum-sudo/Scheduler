-- Fix infinite recursion in group_members RLS policy.
-- Run this in your Supabase SQL editor.
--
-- The "Members can view group membership" policy queried group_members itself
-- to check membership, which re-triggered the same policy → infinite recursion.
-- A SECURITY DEFINER function bypasses RLS during the membership lookup.

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

-- Restrict who can call it (only authenticated users)
revoke all on function public.is_group_member(uuid) from public;
grant execute on function public.is_group_member(uuid) to authenticated;

-- Rebuild the three recursive policies using the helper
drop policy if exists "Members can view group membership" on public.group_members;
create policy "Members can view group membership"
  on public.group_members for select
  using (public.is_group_member(group_id));

drop policy if exists "Members can view their groups" on public.groups;
create policy "Members can view their groups"
  on public.groups for select
  using (auth.uid() = created_by or public.is_group_member(id));

drop policy if exists "Group members can view availability" on public.availability;
create policy "Group members can view availability"
  on public.availability for select
  using (public.is_group_member(group_id));
