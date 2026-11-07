import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteLevel, saveLevelQuestions, setLevelPublished } from "@/features/adventure/admin-actions";
import { levelQuestionPool } from "@/features/adventure/level-pool";
import { requireTeacher } from "@/features/auth/session";
import { loadEligibleQuestions } from "@/features/games/eligible";
import { startLevel } from "@/features/games/engine";
import { getGameDefinition } from "@/features/games/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { LevelEditor } from "./level-editor";

export const metadata: Metadata = { title: "關卡設定" };

const ERRORS: Record<string, string> = {
  "not-enough": "可用題目不足，至少需要 2 題已確認並啟用的題目。",
  publish: "更新失敗，請稍後再試。",
  delete: "這個關卡已有學生紀錄，無法刪除；可以改為取消發布。",
  questions: "指定題目儲存失敗，請稍後再試。",
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> };

export default async function LevelPage({ params, searchParams }: Props) {
  await requireTeacher();
  const { id } = await params;
  const { error, saved } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: level } = await supabase
    .from("game_levels")
    .select(
      "id, title, zone_id, is_published, is_boss, two_star_percent, three_star_percent, unlock_rule, island_zones(name), games(id, game_type, stage_id, textbook_id, unit_id, question_count, difficulty_min, difficulty_max, units(title), learning_stages(difficulty_labels))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!level) notFound();

  const game = level.games as unknown as {
    id: string; game_type: string; stage_id: string; textbook_id: string; unit_id: string;
    question_count: number; difficulty_min: number; difficulty_max: number;
    units: { title: string }; learning_stages: { difficulty_labels: string[] };
  };
  const zone = level.island_zones as unknown as { name: string };
  const definition = getGameDefinition(game.game_type);

  const [candidates, pool, { data: fixed }, { count: sessions }] = await Promise.all([
    loadEligibleQuestions(createAdminClient(), game),
    levelQuestionPool(id),
    supabase.from("level_questions").select("question_id").eq("level_id", id),
    supabase.from("game_sessions").select("id", { count: "exact", head: true }).eq("level_id", id).neq("mode", "preview"),
  ]);
  const fixedIds = new Set(fixed?.map((row) => row.question_id));
  const ready = pool.length >= (definition?.minQuestions ?? 2);
  const summary = (content: Record<string, unknown>) =>
    String(content.word ?? content.letter ?? content.stem ?? "") +
    (content.meaning_zh ? `｜${content.meaning_zh}` : content.sound ? ` ${content.sound}` : "");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={`/teacher/islands/zones/${level.zone_id}`} className="text-sm text-navy underline underline-offset-4">
          {zone.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">{level.title}</h1>
          <Badge tone={level.is_published ? "ok" : "muted"}>{level.is_published ? "已發布" : "未發布"}</Badge>
        </div>
        <p className="text-muted">
          {definition?.label}・{game.units.title}
        </p>
      </div>

      {error && ERRORS[error] ? <Notice>{ERRORS[error]}</Notice> : null}
      {saved ? <Notice tone="ok">指定題目已儲存。</Notice> : null}

      <Card className="space-y-3">
        <p>
          <span className="font-medium text-navy">可用題目 {pool.length} 題</span>
          <span className="block text-sm text-muted">
            {fixedIds.size > 0 ? `已指定 ${fixedIds.size} 題；` : "未指定題目時，從單元內符合條件的題目隨機出題；"}
            每局 {game.question_count} 題。
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <form action={startLevel.bind(null, id, "preview", undefined)}>
            <SubmitButton variant="secondary" disabled={!ready} pendingText="準備中…">
              試玩
            </SubmitButton>
          </form>
          <form action={setLevelPublished.bind(null, id, !level.is_published)}>
            <SubmitButton variant={level.is_published ? "danger" : "primary"} disabled={!level.is_published && !ready}>
              {level.is_published ? "取消發布" : "發布到地圖"}
            </SubmitButton>
          </form>
        </div>
        <p className="text-sm text-muted">學生要在已授權這本教材的班級內，且區域開放，才看得到這一關。</p>
      </Card>

      <Card>
        <h2 className="mb-4 text-xl">關卡設定</h2>
        <LevelEditor
          levelId={id}
          labels={game.learning_stages.difficulty_labels}
          values={{ ...level, question_count: game.question_count, difficulty_min: game.difficulty_min, difficulty_max: game.difficulty_max }}
        />
      </Card>

      <Card>
        <h2 className="mb-1 text-xl">指定題目（選填）</h2>
        <p className="mb-3 text-sm text-muted">
          勾選後只會從這些題目出題；全部不勾則使用單元內所有可用題目。只列出已確認、啟用且符合難度的題目。
        </p>
        {candidates.length === 0 ? (
          <p className="text-muted">這個單元目前沒有可用題目。</p>
        ) : (
          <form action={saveLevelQuestions.bind(null, id)} className="space-y-3">
            <fieldset className="max-h-80 space-y-1 overflow-y-auto">
              <legend className="sr-only">選擇題目</legend>
              {candidates.map((question) => (
                <label key={question.id} className="flex min-h-11 items-center gap-3 rounded-control px-2 hover:bg-sky/40">
                  <input type="checkbox" name="questionId" value={question.id} defaultChecked={fixedIds.has(question.id)} className="size-5 accent-[var(--navy)]" />
                  <span className="break-words">{summary(question.content)}</span>
                </label>
              ))}
            </fieldset>
            <SubmitButton variant="secondary" pendingText="儲存中…">
              儲存指定題目
            </SubmitButton>
          </form>
        )}
      </Card>

      {!sessions ? (
        <Card>
          <h2 className="mb-3 text-xl">刪除關卡</h2>
          <form action={deleteLevel.bind(null, id, level.zone_id, "level")}>
            <SubmitButton variant="danger" pendingText="刪除中…">
              刪除關卡
            </SubmitButton>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
