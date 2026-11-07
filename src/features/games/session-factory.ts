import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadEligibleQuestions } from "@/features/games/eligible";
import { getGameDefinition } from "@/features/games/registry";
import { shuffle } from "@/features/games/shuffle";

export type SessionMode = "normal" | "retry_all" | "retry_wrong" | "preview";
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
