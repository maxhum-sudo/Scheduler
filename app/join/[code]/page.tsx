import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/?next=/join/${code}`);
  }

  const { data: group } = await supabase
    .from("groups")
    .select("id, invite_code")
    .eq("invite_code", code.toUpperCase())
    .single();

  if (!group) {
    redirect("/dashboard?error=invalid-code");
  }

  // Upsert membership (no-op if already a member)
  await supabase
    .from("group_members")
    .upsert({ group_id: group.id, user_id: user.id }, { onConflict: "group_id,user_id" });

  redirect(`/groups/${group.invite_code}`);
}
