import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignInButton } from "@/components/SignInButton";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  const params = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-white px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="text-5xl">📅</div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Scheduler</h1>
          <p className="text-gray-500 text-base leading-relaxed">
            See when everyone in your group is free — in one glance.
          </p>
        </div>

        <div className="w-full flex flex-col gap-3">
          <SignInButton next={params.next} />
          {params.error && (
            <p className="text-center text-sm text-red-600">
              Sign-in failed. Please try again.
            </p>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">
          No passwords. Sign in with your Google account.
        </p>
      </div>
    </main>
  );
}
