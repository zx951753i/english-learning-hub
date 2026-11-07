"use server";

import { notFound, redirect } from "next/navigation";
import { loadZoneLevels } from "@/features/adventure/data";
import { getCurrentProfile, requireTeacher, type Profile } from "@/features/auth/session";
import { getGameDefinition } from "@/features/games/registry";
import { emptyStats, nextStats, scoreFor } from "@/features/games/scoring";
import { createReviewSession, createSession, SESSION_MODES, type SessionMode } from "@/features/games/session-factory";
import { awardMissionBadges, loadMistakeGroups } from "@/features/missions/data";
import { parseGroupKey, REVIEW_SIZE } from "@/features/missions/rules";
import type { GradingKey, QuestionRow } from "@/features/games/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const GAME_FIELDS = "id, game_type, stage_id, textbook_id, unit_id, question_count, difficulty_min, difficulty_max";
const MAX_ITEM_MS = 10 * 60 * 1000;

async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** 老師試玩遊戲設定，不計入任何紀錄。 */
export async function startGame(gameId: string) {
  await requireTeacher();
  const admin = createAdminClient();
  const { data: game } = await admin.from("games").select(GAME_FIELDS).eq("id", gameId).maybeSingle();
  if (!game) notFound();
  const profile = (await getCurrentProfile())!;
  const result = await createSession(admin, { studentId: profile.id, game, mode: "preview" });
  if (!result.ok) redirect(`/teacher/games/${gameId}?error=not-enough`);
  redirect(`/play/${result.sessionId}`);
}

/**
 * 開始一個關卡。學生必須看得到這關（RLS：已發布、區域開放、教材已授權），
 * 且依闖關進度已解鎖；老師一律以試玩模式進行。
 */
export async function startLevel(levelId: string, requestedMode: SessionMode, retryOfSessionId?: string) {
  const profile = await requireProfile();
  if (!SESSION_MODES.includes(requestedMode)) redirect("/home");
  const isTeacher = profile.role === "teacher";
  if (!isTeacher && requestedMode === "preview") redirect("/home");
  const mode: SessionMode = isTeacher ? "preview" : requestedMode;

  const supabase = await createClient();
  const { data: level } = await supabase
    .from("game_levels")
    .select("id, zone_id, game_id")
    .eq("id", levelId)
    .maybeSingle();
  if (!level) notFound();

  if (!isTeacher) {
    const levels = await loadZoneLevels(supabase, level.zone_id, profile.id);
    const target = levels.find((item) => item.id === levelId);
    if (!target || target.state.status === "locked") redirect(`/zone/${level.zone_id}?locked=1`);
  }

  const admin = createAdminClient();
  const { data: game } = await admin.from("games").select(GAME_FIELDS).eq("id", level.game_id).maybeSingle();
  if (!game) notFound();
  const result = await createSession(admin, {
    studentId: profile.id,
    game,
    mode,
    levelId,
    retryOfSessionId,
  });
  if (!result.ok) {
    redirect(isTeacher ? `/teacher/islands/levels/${levelId}?error=${result.reason}` : `/zone/${level.zone_id}?error=${result.reason}`);
  }
  redirect(`/play/${result.sessionId}`);
}

/** 學生從錯題本開始一局複習。題目只取自本人目前的錯題。 */
export async function startReview(groupKey: string) {
  const profile = await requireProfile();
  if (profile.role !== "student") redirect("/teacher");
  const parsed = parseGroupKey(groupKey);
  if (!parsed) redirect("/mistakes");

  const admin = createAdminClient();
  const group = (await loadMistakeGroups(admin, profile.id)).find((item) => item.key === groupKey);
  if (!group) redirect("/mistakes?error=empty");

  const result = await createReviewSession(admin, {
    studentId: profile.id,
    gameType: group.game_type,
    textbookId: group.textbook_id,
    questionIds: group.questionIds,
    size: REVIEW_SIZE,
  });
  if (!result.ok) redirect(`/mistakes?error=${result.reason}`);
  redirect(`/play/${result.sessionId}`);
}

export type AnswerResult =
  | {
      ok: true;
      isCorrect: boolean;
      correctAnswer: string;
      explanation: string | null;
      finished: boolean;
      /** 作答後要唸出的英文。 */
      speakAfter?: string;
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
    .select("id, student_id, status, mode, level_id, game_type, textbook_id, unit_id, question_total, time_spent")
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
      speakAfter: key.speakAfter,
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
    unit_id: session.unit_id ?? snapshot.unit_id,
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
    const score = scoreFor(correct, session.question_total);
    await admin
      .from("game_sessions")
      .update({
        status: "completed",
        correct_count: correct,
        score,
        time_spent: Math.round(
          (answers?.reduce((sum, answer) => sum + answer.time_spent, 0) ?? 0) / 1000,
        ),
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
    if (session.level_id) await admin.rpc("record_level_result", { p_session_id: sessionId });
    await awardMissionBadges(admin, { id: sessionId, student_id: profile.id, mode: session.mode, score });
  }

  return { ok: true, isCorrect, correctAnswer: key.display, explanation, finished, speakAfter: key.speakAfter };
}
