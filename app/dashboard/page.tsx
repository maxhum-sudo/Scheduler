import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateGroupDialog } from "@/components/CreateGroupDialog";
import { JoinGroupDialog } from "@/components/JoinGroupDialog";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/SignOutButton";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id, groups(id, name, invite_code)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  type GroupRow = { id: string; name: string; invite_code: string };
  const groups: GroupRow[] = (memberships ?? []).flatMap((m) => {
    const g = m.groups;
    if (!g) return [];
    const row = Array.isArray(g) ? g[0] : g;
    if (!row) return [];
    return [row as GroupRow];
  });

  const displayName = user.user_metadata?.full_name ?? user.email ?? "there";

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-xl">📅</span>
          <span className="font-semibold text-gray-900">Scheduler</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 hidden sm:block">
            {displayName}
          </span>
          <SignOutButton />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Your groups</h1>
          <div className="flex items-center gap-2">
            <JoinGroupDialog />
            <CreateGroupDialog />
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="text-4xl">👋</div>
            <p className="text-gray-600 text-lg">
              Hey {displayName.split(" ")[0]}! Create a group or join one with an invite code.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.invite_code}`}
                className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-gray-900 leading-tight">{group.name}</h2>
                  <Badge variant="secondary" className="font-mono text-xs shrink-0">
                    {group.invite_code}
                  </Badge>
                </div>
                <p className="text-sm text-gray-400">View availability →</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
