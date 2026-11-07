import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadEligibleQuestions } from "@/features/games/eligible";
import { getGameDefinition } from "@/features/games/registry";
import { shuffle } from "@/features/games/shuffle";
import type { QuestionRow } from "@/features/games/types";

export type SessionMode = "normal" | "retry_all" | "retry_wrong" | "preview" | "review";
/** 可由關卡開始的模式；review 只能由錯題本開始。 */
export const SESSION_MODES: SessionMode[] = ["normal", "retry_all", "retry_wrong", "preview"];

export type GameConfig = {
  id: string;
  game_type: string;
  stage_id: string;
  textbook_id: string;
  unit_id: string;
  question_count: number;
  difficulty_min: number;
  difficulty_max: number;
};

/** 可用題目：已確認、啟用、符合難度；關卡有指定題目時只用指定的。 */
export async function loadLevelPool(admin: SupabaseClient, game: GameConfig, levelId?: string) {
  const pool = await loadEligibleQuestions(admin, game);
  if (!levelId) return pool;
  const { data: fixed } = await admin.from("level_questions").select("question_id").eq("level_id", levelId);
  if (!fixed?.length) return pool;
  const ids = new Set(fixed.map((row) => row.question_id));
  return pool.filter((question) => ids.has(question.id));
}

type Options = {
  studentId: string;
  game: GameConfig;
  mode: SessionMode;
  levelId?: string;
  retryOfSessionId?: string;
};

export type CreateResult = { ok: true; sessionId: string } | { ok: false; reason: "not-enough" | "no-mistakes" };

export async function createSession(admin: SupabaseClient, options: Options): Promise<CreateResult> {
  const { game, mode, studentId, levelId, retryOfSessionId } = options;
  const definition = getGameDefinition(game.game_type);
  if (!definition) return { ok: false, reason: "not-enough" };

  const pool = await loadLevelPool(admin, game, levelId);
  if (pool.length < definition.minQuestions) return { ok: false, reason: "not-enough" };

  let selected = shuffle(pool, Math.random).slice(0, game.question_count);
  if (mode === "retry_wrong") {
    const { data: previous } = await admin
      .from("answers")
      .select("question_id")
      .eq("session_id", retryOfSessionId ?? "")
      .eq("student_id", studentId)
      .eq("is_correct", false);
    const wrongIds = new Set(previous?.map((row) => row.question_id));
    selected = pool.filter((question) => wrongIds.has(question.id));
    if (selected.length === 0) return { ok: false, reason: "no-mistakes" };
  }

  const rounds = definition.buildRounds(selected, pool, Math.random);
  const { data: session, error } = await admin
    .from("game_sessions")
    .insert({
      student_id: studentId,
      game_id: game.id,
      level_id: levelId ?? null,
      game_type: game.game_type,
      stage_id: game.stage_id,
      textbook_id: game.textbook_id,
      unit_id: game.unit_id,
      mode,
      retry_of_session_id: retryOfSessionId ?? null,
      question_total: rounds.length,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: itemError } = await admin.from("game_session_items").insert(
    rounds.map((round, index) => ({
      session_id: session.id,
      question_id: selected[index].id,
      position: index + 1,
      question_snapshot: selected[index],
      public_round: round.publicRound,
      grading_key: round.gradingKey,
    })),
  );
  if (itemError) {
    await admin.from("game_sessions").delete().eq("id", session.id);
    throw new Error(itemError.message);
  }
  return { ok: true, sessionId: session.id };
}

const QUESTION_FIELDS = "id, unit_id, topic_id, content_type, content, answer_key, explanation_zh";

/**
 * 錯題複習：同一種遊戲、同一本教材的錯題，最多 REVIEW_SIZE 題。
 * 錯題不足遊戲最少題數時，從同教材的題目補足；干擾選項也從同教材取。
 * 呼叫端必須先確認這些題目確實是這位學生的錯題。
 */
export async function createReviewSession(
  admin: SupabaseClient,
  options: { studentId: string; gameType: string; textbookId: string; questionIds: string[]; size: number },
): Promise<CreateResult> {
  const definition = getGameDefinition(options.gameType);
  if (!definition || options.questionIds.length === 0) return { ok: false, reason: "no-mistakes" };

  const [{ data: book }, { data: poolRows, error }] = await Promise.all([
    admin.from("textbooks").select("stage_id").eq("id", options.textbookId).maybeSingle(),
    admin
      .from("questions")
      .select(QUESTION_FIELDS)
      .eq("textbook_id", options.textbookId)
      .eq("is_active", true)
      .eq("review_status", "confirmed")
      .is("deleted_at", null)
      .in("content_type", definition.contentTypes),
  ]);
  if (error) throw new Error(error.message);
  if (!book) return { ok: false, reason: "no-mistakes" };

  const seen = new Set<string>();
  const pool = ((poolRows ?? []) as QuestionRow[]).filter((question) => {
    if (!definition.accepts(question)) return false;
    const identity = definition.identity(question);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });

  const wanted = new Set(options.questionIds);
  const mistakes = shuffle(pool.filter((question) => wanted.has(question.id)), Math.random).slice(0, options.size);
  if (mistakes.length === 0) return { ok: false, reason: "no-mistakes" };
  const filler = shuffle(pool.filter((question) => !wanted.has(question.id)), Math.random).slice(
    0,
    Math.max(0, definition.minQuestions - mistakes.length),
  );
  const selected = [...mistakes, ...filler];
  if (selected.length < definition.minQuestions) return { ok: false, reason: "not-enough" };

  const rounds = definition.buildRounds(selected, pool, Math.random);
  const { data: session, error: sessionError } = await admin
    .from("game_sessions")
    .insert({
      student_id: options.studentId,
      game_id: null,
      level_id: null,
      unit_id: null,
      game_type: options.gameType,
      stage_id: book.stage_id,
      textbook_id: options.textbookId,
      mode: "review",
      question_total: rounds.length,
    })
    .select("id")
    .single();
  if (sessionError) throw new Error(sessionError.message);

  const { error: itemError } = await admin.from("game_session_items").insert(
    rounds.map((round, index) => ({
      session_id: session.id,
      question_id: selected[index].id,
      position: index + 1,
      source_bucket: index < mistakes.length ? "mistake" : "review",
      question_snapshot: selected[index],
      public_round: round.publicRound,
      grading_key: round.gradingKey,
    })),
  );
  if (itemError) {
    await admin.from("game_sessions").delete().eq("id", session.id);
    throw new Error(itemError.message);
  }
  return { ok: true, sessionId: session.id };
}
