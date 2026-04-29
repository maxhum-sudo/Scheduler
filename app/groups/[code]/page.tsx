import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CalendarClient } from "./CalendarClient";
import { SignOutButton } from "@/components/SignOutButton";
import { Badge } from "@/components/ui/badge";

export default async function GroupPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, invite_code")
    .eq("invite_code", code.toUpperCase())
    .maybeSingle();

  // RLS hides the row when the user isn't a member. Defer to the join flow,
  // which uses an RPC that can look up the group regardless of membership.
  if (!group) redirect(`/join/${code}`);

  // Load initial availability
  const { data: availRows } = await supabase
    .from("availability")
    .select("user_id, slot_start")
    .eq("group_id", group.id);

  // Load member profiles
  const { data: members } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", group.id);

  const memberIds = (members ?? []).map((m) => m.user_id as string);

  // Build initial availability map
  const initialAvail: Record<string, string[]> = {};
  for (const row of availRows ?? []) {
    const key = row.slot_start as string;
    if (!initialAvail[key]) initialAvail[key] = [];
    initialAvail[key].push(row.user_id as string);
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/join/${group.invite_code}`;
  const displayName = user.user_metadata?.full_name ?? user.email ?? "";

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">
              ← Groups
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="font-semibold text-gray-900">{group.name}</h1>
            <Badge variant="secondary" className="font-mono text-xs hidden sm:flex">
              {group.invite_code}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 hidden sm:block">{displayName}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6">
        <CalendarClient
          groupId={group.id}
          inviteCode={group.invite_code}
          currentUserId={user.id}
          currentUserName={user.user_metadata?.full_name ?? user.email ?? "You"}
          currentUserAvatar={user.user_metadata?.avatar_url ?? null}
          memberIds={memberIds}
          initialAvail={initialAvail}
          shareUrl={shareUrl}
        />
      </div>
    </main>
  );
}
