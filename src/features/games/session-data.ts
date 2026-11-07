import "server-only";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/features/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

/** 只回傳本人的遊戲；用 admin 讀取，所以必須先比對 student_id。 */
export async function loadOwnSession(sessionId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) notFound();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("game_sessions")
    .select(
      "id, game_id, level_id, status, mode, question_total, correct_count, score, time_spent, games(title), learning_stages(theme_key)",
    )
    .eq("id", sessionId)
    .eq("student_id", profile.id)
    .maybeSingle();
  if (!session) notFound();

  return {
    admin,
    profile,
    session,
    title: session.mode === "review" ? "錯題複習" : ((session.games as unknown as { title: string } | null)?.title ?? "遊戲"),
    theme: (session.learning_stages as unknown as { theme_key: string }).theme_key,
  };
}
