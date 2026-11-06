import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { homePathFor } from "@/features/auth/session";
import { startGame } from "@/features/games/engine";
import { loadOwnSession } from "@/features/games/session-data";
import type { GradingKey, PublicRound } from "@/features/games/types";

export const metadata: Metadata = { title: "遊戲成績" };

const promptOf = (round: PublicRound) =>
  round.renderer === "match_pairs" ? round.left : round.prompt;

export default async function ResultPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { admin, profile, session, title, theme } = await loadOwnSession(sessionId);
  if (session.status !== "completed") redirect(`/play/${sessionId}`);

  const { data: wrong } = await admin
    .from("answers")
    .select("session_item_id, game_session_items(position, public_round, grading_key)")
    .eq("session_id", sessionId)
    .eq("is_correct", false);

  const mistakes = (wrong ?? [])
    .map((row) => row.game_session_items as unknown as {
      position: number;
      public_round: PublicRound;
      grading_key: GradingKey;
    })
    .sort((a, b) => a.position - b.position);

  const preview = session.mode === "preview";
  const replayMode = preview ? "preview" : "retry_all";

  return (
    <main data-stage={theme} className="mx-auto max-w-xl space-y-5 px-4 py-6">
      <h1 className="text-2xl">{title}</h1>
      <Card className="text-center">
        <p className="text-muted">本次成績</p>
        <p className="font-serif text-6xl font-semibold text-navy">{session.score}</p>
        <p className="mt-1 text-muted">
          答對 {session.correct_count} / {session.question_total} 題
        </p>
      </Card>

      {preview ? <p className="text-sm text-muted">這是老師試玩，不計入學習紀錄。</p> : null}

      {mistakes.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xl">答錯的題目</h2>
          <Card className="divide-y divide-line p-0">
            {mistakes.map((item) => (
              <p key={item.position} className="px-5 py-3">
                <span className="block text-sm text-muted">{promptOf(item.public_round)}</span>
                正確答案：{item.grading_key.display}
              </p>
            ))}
          </Card>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <form action={startGame.bind(null, session.game_id, replayMode, sessionId)}>
          <SubmitButton pendingText="準備中…">重新挑戰</SubmitButton>
        </form>
        {mistakes.length > 0 ? (
          <form action={startGame.bind(null, session.game_id, "retry_wrong", sessionId)}>
            <SubmitButton variant="secondary" pendingText="準備中…">
              只練錯題
            </SubmitButton>
          </form>
        ) : null}
        <Link href={homePathFor(profile.role)} className={buttonClass("ghost")}>
          回到首頁
        </Link>
      </div>
    </main>
  );
}
