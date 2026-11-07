import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireTeacher } from "@/features/auth/session";
import { deleteGame } from "@/features/games/admin-actions";
import { loadEligibleQuestions } from "@/features/games/eligible";
import { startGame } from "@/features/games/engine";
import { getGameDefinition } from "@/features/games/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { GameEditor } from "./game-editor";

export const metadata: Metadata = { title: "遊戲設定" };

const ERRORS: Record<string, string> = {
  "not-enough": "可用題目不足，至少需要 2 題已確認並啟用的題目。",
  publish: "更新失敗，請稍後再試。",
  delete: "這個遊戲已有學生紀錄或無法刪除，請改為取消發布。",
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> };

export default async function GameDetailPage({ params, searchParams }: Props) {
  await requireTeacher();
  const { id } = await params;
  const { error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select(
      "id, title, game_type, stage_id, textbook_id, unit_id, question_count, difficulty_min, difficulty_max, units(title), textbooks(title), learning_stages(difficulty_labels), game_levels(id, is_published)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!game) notFound();

  const definition = getGameDefinition(game.game_type);
  const eligible = await loadEligibleQuestions(createAdminClient(), game);
  const { count: sessions } = await supabase
    .from("game_sessions")
    .select("id", { count: "exact", head: true })
    .eq("game_id", id)
    .neq("mode", "preview");
  const labels =
    (game.learning_stages as unknown as { difficulty_labels: string[] } | null)?.difficulty_labels ??
    ["1", "2", "3", "4"];
  const level = firstLevel(game.game_levels);
  const ready = eligible.length >= (definition?.minQuestions ?? 2);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/teacher/games" className="text-sm text-navy underline underline-offset-4">
          遊戲列表
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">{game.title}</h1>
          <Badge tone={level?.is_published ? "ok" : "muted"}>{level ? (level.is_published ? "關卡已發布" : "關卡未發布") : "未放上地圖"}</Badge>
        </div>
        <p className="text-muted">
          {definition?.label}・{(game.textbooks as unknown as { title: string }).title}・
          {(game.units as unknown as { title: string }).title}
        </p>
      </div>

      {error && ERRORS[error] ? <Notice>{ERRORS[error]}</Notice> : null}

      <Card className="space-y-3">
        <p>
          <span className="font-medium text-navy">可用題目 {eligible.length} 題</span>
          <span className="block text-sm text-muted">
            只計算已確認並啟用的{definition?.contentTypes.includes("phonics_item") ? "單一字母自然發音題" : "單字題"}；每局 {game.question_count} 題，題目不足時用現有題數。
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <form action={startGame.bind(null, id)}>
            <SubmitButton variant="secondary" disabled={!ready} pendingText="準備中…">
              試玩
            </SubmitButton>
          </form>
          {level ? (
            <Link href={`/teacher/islands/levels/${level.id}`} className="inline-flex min-h-[var(--control-height)] items-center rounded-control px-4 font-medium text-navy underline underline-offset-4">
              前往關卡設定
            </Link>
          ) : null}
        </div>
        <p className="text-sm text-muted">學生從地圖上的關卡進入遊戲；發布與星星門檻在關卡設定。</p>
      </Card>

      <Card>
        <h2 className="mb-4 text-xl">遊戲設定</h2>
        <GameEditor game={game} labels={labels} />
      </Card>

      {!sessions ? (
        <Card>
          <h2 className="mb-3 text-xl">刪除遊戲</h2>
          <form action={deleteGame.bind(null, id)}>
            <SubmitButton variant="danger" pendingText="刪除中…">
              刪除遊戲
            </SubmitButton>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

type LevelLink = { id: string; is_published: boolean };

/** game_levels.game_id 是 unique，PostgREST 會回傳單一物件或 null，而不是陣列。 */
function firstLevel(value: unknown): LevelLink | undefined {
  if (Array.isArray(value)) return value[0];
  return (value as LevelLink | null) ?? undefined;
}
