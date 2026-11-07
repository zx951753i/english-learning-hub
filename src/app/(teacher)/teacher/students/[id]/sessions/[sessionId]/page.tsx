import { Check, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Stars } from "@/components/adventure/stars";
import { Card } from "@/components/ui/card";
import { requireTeacher } from "@/features/auth/session";
import { getGameDefinition } from "@/features/games/registry";
import type { GradingKey, PublicRound } from "@/features/games/types";
import { formatDuration, formatWhen } from "@/features/records/data";
import { answerLabel } from "@/features/records/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "作答明細" };

const MODE_LABELS: Record<string, string> = {
  normal: "闖關",
  retry_all: "再挑戰",
  retry_wrong: "只練錯題",
  review: "錯題複習",
};

type Props = { params: Promise<{ id: string; sessionId: string }> };

export default async function SessionDetailPage({ params }: Props) {
  await requireTeacher();
  const { id, sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(sessionId)) notFound();

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("game_sessions")
    .select(
      "id, mode, game_type, status, score, stars_earned, correct_count, question_total, time_spent, completed_at, started_at, profiles(display_name), game_levels(title), games(title)",
    )
    .eq("id", sessionId)
    .eq("student_id", id)
    .maybeSingle();
  if (!session) notFound();

  const [{ data: items }, { data: answers }] = await Promise.all([
    supabase.from("game_session_items").select("id, position, public_round, grading_key").eq("session_id", sessionId).order("position"),
    supabase.from("answers").select("session_item_id, selected_answer, is_correct, time_spent").eq("session_id", sessionId),
  ]);
  const answerOf = new Map((answers ?? []).map((row) => [row.session_item_id as string, row]));

  const student = (session.profiles as unknown as { display_name: string } | null)?.display_name ?? "";
  const title =
    session.mode === "review"
      ? "錯題複習"
      : ((session.game_levels as unknown as { title: string } | null)?.title ??
        (session.games as unknown as { title: string } | null)?.title ??
        "（關卡已刪除）");
  const showStars = session.mode === "normal" || session.mode === "retry_all";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={`/teacher/students/${id}`} className="text-sm text-navy underline underline-offset-4">
          {student} 的學習紀錄
        </Link>
        <h1 className="mt-1 text-3xl">{title}</h1>
        <p className="text-muted">
          {getGameDefinition(session.game_type)?.label}・{MODE_LABELS[session.mode] ?? session.mode}・
          {formatWhen(session.completed_at ?? session.started_at)}
        </p>
      </div>

      <Card className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <p>
          <span className="font-serif text-4xl font-semibold text-navy">{session.score ?? 0}</span>
          <span className="text-muted"> 分</span>
        </p>
        <p className="text-muted">
          答對 {session.correct_count} / {session.question_total} 題・{formatDuration(session.time_spent)}
        </p>
        {showStars && session.stars_earned !== null ? <Stars count={session.stars_earned} size={22} /> : null}
        {session.status !== "completed" ? <p className="text-sm text-muted">這局還沒有完成。</p> : null}
      </Card>

      <Card className="p-0">
        <table className="w-full text-left">
          <caption className="sr-only">每一題的作答</caption>
          <thead className="border-b border-line text-sm text-muted">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">
                題目
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                學生的答案
              </th>
              <th scope="col" className="w-16 px-4 py-2.5 text-center font-medium">
                結果
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(items ?? []).map((item) => {
              const answer = answerOf.get(item.id as string);
              const key = item.grading_key as GradingKey;
              return (
                <tr key={item.id as string}>
                  <td className="px-4 py-2.5">
                    <span className="mr-2 text-sm text-muted">{item.position as number}.</span>
                    {key.display}
                  </td>
                  <td className="px-4 py-2.5">
                    {answer ? answerLabel(item.public_round as PublicRound, answer.selected_answer) : <span className="text-muted">未作答</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {answer ? (
                      answer.is_correct ? (
                        <Check size={20} className="inline text-ok" aria-label="答對" />
                      ) : (
                        <X size={20} className="inline text-danger" aria-label="答錯" />
                      )
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
