"use server";

import { notFound, redirect } from "next/navigation";
import { getCurrentProfile, type Profile } from "@/features/auth/session";
import { loadEligibleQuestions } from "@/features/games/eligible";
import { getGameDefinition } from "@/features/games/registry";
import { emptyStats, nextStats, scoreFor } from "@/features/games/scoring";
import { shuffle } from "@/features/games/shuffle";
import type { GradingKey, QuestionRow } from "@/features/games/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MODES = ["normal", "retry_all", "retry_wrong", "preview"];
const MAX_ITEM_MS = 10 * 60 * 1000;

async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** 開始一局。權限由學生身分的查詢判斷，RLS 只回傳已授權且已發布的遊戲。 */
export async function startGame(
  gameId: string,
  mode: "normal" | "retry_all" | "retry_wrong" | "preview",
  retryOfSessionId?: string,
) {
  const profile = await requireProfile();
  if (!MODES.includes(mode)) redirect("/home");
  if (mode === "preview" && profile.role !== "teacher") redirect("/home");

  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select("id, game_type, stage_id, textbook_id, unit_id, question_count, difficulty_min, difficulty_max")
    .eq("id", gameId)
    .maybeSingle();
  if (!game) notFound();

  const definition = getGameDefinition(game.game_type);
  if (!definition) notFound();
  const home = profile.role === "teacher" ? `/teacher/games/${gameId}` : "/home";

  const admin = createAdminClient();
  const pool = await loadEligibleQuestions(admin, game);
  if (pool.length < definition.minQuestions) redirect(`${home}?error=not-enough`);

  let selected = shuffle(pool, Math.random).slice(0, game.question_count);

  if (mode === "retry_wrong") {
    const { data: previous } = await admin
      .from("answers")
      .select("question_id, game_sessions!inner(student_id, game_id)")
      .eq("session_id", retryOfSessionId ?? "")
      .eq("is_correct", false)
      .eq("student_id", profile.id);
    const wrongIds = new Set(previous?.map((row) => row.question_id));
    selected = pool.filter((question) => wrongIds.has(question.id));
    if (selected.length === 0) redirect(home);
  }

  const rounds = definition.buildRounds(selected, pool, Math.random);
  const { data: session, error } = await admin
    .from("game_sessions")
    .insert({
      student_id: profile.id,
      game_id: game.id,
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

  redirect(`/play/${session.id}`);
}

export type AnswerResult =
  | {
      ok: true;
      isCorrect: boolean;
      correctAnswer: string;
      explanation: string | null;
      finished: boolean;
    }
  | { ok: false; error: string };

export async function submitAnswer(
  sessionId: string,
  itemId: string,
  response: string,
  timeSpentMs: number,
): Promise<AnswerResult> {
  const profile = await requireProfile();
  const admin = createAdminClient();

  const { data: session } = await admin
    .from("game_sessions")
    .select("id, student_id, status, mode, game_type, textbook_id, unit_id, question_total, time_spent")
    .eq("id", sessionId)
    .eq("student_id", profile.id)
    .maybeSingle();
  if (!session) return { ok: false, error: "找不到這局遊戲。" };

  const definition = getGameDefinition(session.game_type);
  const { data: item } = await admin
    .from("game_session_items")
    .select("id, question_id, grading_key, question_snapshot")
    .eq("id", itemId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!definition || !item) return { ok: false, error: "找不到這一題。" };

  const key = item.grading_key as GradingKey;
  const snapshot = item.question_snapshot as QuestionRow;
  const explanation = snapshot.explanation_zh;

  // 重送同一題時回傳第一次的結果，不重複計分。
  const { data: existing } = await admin
    .from("answers")
    .select("is_correct")
    .eq("session_item_id", itemId)
    .maybeSingle();
  if (existing || session.status === "completed") {
    return {
      ok: true,
      isCorrect: existing?.is_correct ?? false,
      correctAnswer: key.display,
      explanation,
      finished: session.status === "completed",
    };
  }

  const value = response.slice(0, 200);
  const isCorrect = definition.grade(value, key);
  const timeSpent = Math.min(Math.max(0, Math.round(timeSpentMs) || 0), MAX_ITEM_MS);

  const { error } = await admin.from("answers").insert({
    session_id: sessionId,
    session_item_id: itemId,
    student_id: profile.id,
    textbook_id: session.textbook_id,
    unit_id: session.unit_id,
    topic_id: snapshot.topic_id,
    game_type: session.game_type,
    question_id: item.question_id,
    selected_answer: value,
    is_correct: isCorrect,
    time_spent: timeSpent,
  });
  if (error && error.code !== "23505") return { ok: false, error: "儲存失敗，請再試一次。" };

  if (session.mode !== "preview" && !error) {
    const { data: stats } = await admin
      .from("student_question_stats")
      .select("attempt_count, correct_count, wrong_count, consecutive_correct, is_open_mistake")
      .eq("student_id", profile.id)
      .eq("question_id", item.question_id)
      .maybeSingle();
    await admin.from("student_question_stats").upsert({
      student_id: profile.id,
      question_id: item.question_id,
      ...nextStats(stats ?? emptyStats, isCorrect, new Date()),
    });
  }

  const { data: answers } = await admin
    .from("answers")
    .select("is_correct, time_spent")
    .eq("session_id", sessionId);
  const answered = answers?.length ?? 0;
  const finished = answered >= session.question_total;

  if (finished) {
    const correct = answers?.filter((answer) => answer.is_correct).length ?? 0;
    await admin
      .from("game_sessions")
      .update({
        status: "completed",
        correct_count: correct,
        score: scoreFor(correct, session.question_total),
        time_spent: Math.round(
          (answers?.reduce((sum, answer) => sum + answer.time_spent, 0) ?? 0) / 1000,
        ),
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
  }

  return { ok: true, isCorrect, correctAnswer: key.display, explanation, finished };
}
