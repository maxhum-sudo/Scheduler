import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/?next=/join/${code}`);
  }

  const { data, error } = await supabase.rpc("join_group_by_code", {
    _code: code,
  });

  if (error) {
    console.error("join_group_by_code failed:", error);
    redirect("/dashboard?error=join-failed");
  }

  // RPC returns 0 rows if invite_code wasn't found, otherwise 1 row
  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (!row) {
    redirect("/dashboard?error=invalid-code");
  }

  redirect(`/groups/${row.invite_code}`);
}
