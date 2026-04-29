import { createClient } from "@/lib/supabase/client";

export type SlotKey = string; // ISO string

export interface MemberProfile {
  user_id: string;
  name: string;
  avatar_url: string | null;
}

export interface AvailabilityMap {
  // slot_start ISO → array of user_ids who are free
  [slot: SlotKey]: string[];
}

export async function fetchGroupAvailability(groupId: string): Promise<AvailabilityMap> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("availability")
    .select("user_id, slot_start")
    .eq("group_id", groupId);

  if (error) throw error;

  const map: AvailabilityMap = {};
  for (const row of data ?? []) {
    const key = row.slot_start as string;
    if (!map[key]) map[key] = [];
    map[key].push(row.user_id as string);
  }
  return map;
}

export async function fetchGroupMembers(groupId: string): Promise<MemberProfile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId);

  if (error) throw error;

  const userIds = (data ?? []).map((r) => r.user_id as string);
  if (userIds.length === 0) return [];

  // Fetch display names + avatars from auth.users via profiles view
  const { data: profiles, error: profileError } = await supabase
    .rpc("get_user_profiles", { user_ids: userIds });

  if (profileError) {
    // Fallback: return user_ids without profile info
    return userIds.map((id) => ({ user_id: id, name: id.slice(0, 6), avatar_url: null }));
  }

  return (profiles as Array<{ user_id: string; name: string; avatar_url: string | null }>) ?? [];
}

export async function toggleAvailability(
  groupId: string,
  slotStart: string,
  currentlyFree: boolean
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (currentlyFree) {
    await supabase
      .from("availability")
      .delete()
      .eq("user_id", user.id)
      .eq("group_id", groupId)
      .eq("slot_start", slotStart);
  } else {
    await supabase
      .from("availability")
      .upsert({ user_id: user.id, group_id: groupId, slot_start: slotStart });
  }
}

export async function setAvailabilityBulk(
  groupId: string,
  slots: string[],
  free: boolean
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (free) {
    const rows = slots.map((slot_start) => ({
      user_id: user.id,
      group_id: groupId,
      slot_start,
    }));
    await supabase.from("availability").upsert(rows);
  } else {
    await supabase
      .from("availability")
      .delete()
      .eq("user_id", user.id)
      .eq("group_id", groupId)
      .in("slot_start", slots);
  }
}
