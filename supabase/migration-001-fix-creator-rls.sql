-- Run this in your Supabase SQL editor to fix the "create group" silent failure.
-- The original SELECT policy required the user to already be in group_members,
-- which blocked the .select() that runs immediately after .insert(). Now the
-- creator can also see the row, so the insert→select→add-member chain works.

drop policy if exists "Members can view their groups" on public.groups;

create policy "Members can view their groups"
  on public.groups for select
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.group_members
      where group_members.group_id = groups.id
        and group_members.user_id = auth.uid()
    )
  );
