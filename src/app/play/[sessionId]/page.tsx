import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GameShell, type PlayItem } from "@/features/games/renderers/game-shell";
import { loadOwnSession } from "@/features/games/session-data";
import type { PublicRound } from "@/features/games/types";
import { signImages } from "@/features/media/server";

export const metadata: Metadata = { title: "遊戲" };

export default async function PlayPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { admin, session, title, theme } = await loadOwnSession(sessionId);
  if (session.status === "completed") redirect(`/play/${sessionId}/result`);

  // 刻意不選取 grading_key 與 question_snapshot。
  const [{ data: rows }, { data: answers }] = await Promise.all([
    admin
      .from("game_session_items")
      .select("id, public_round")
      .eq("session_id", sessionId)
      .order("position"),
    admin.from("answers").select("session_item_id, is_correct").eq("session_id", sessionId),
  ]);

  const items: PlayItem[] = (rows ?? []).map((row) => {
    const answer = answers?.find((item) => item.session_item_id === row.id);
    return {
      id: row.id,
      round: row.public_round as PublicRound,
      answered: answer ? { isCorrect: answer.is_correct } : undefined,
    };
  });

  const names = items.flatMap(({ round }) => {
    if (round.renderer === "single_choice") return round.options.map((option) => option.image ?? "");
    if (round.renderer === "text_input") return [round.image ?? ""];
    return [];
  });
  const urls = await signImages(admin, names);

  return (
    <div data-stage={theme}>
      <GameShell sessionId={sessionId} title={title} items={items} images={Object.fromEntries(urls)} />
    </div>
  );
}
