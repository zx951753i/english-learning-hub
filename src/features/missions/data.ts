import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGameDefinition } from "@/features/games/registry";
import {
  groupMistakes,
  taipeiDay,
  todayMission,
  type Mission,
  type MistakeGroup,
  type MistakeRow,
} from "@/features/missions/rules";

/**
 * 學生目前可使用的教材：所屬班級（未封存、未離開）被授權的教材。
 * 用 admin 查詢，所以只能在已確認 studentId 為本人或老師的情況下呼叫。
 */
export async function accessibleTextbookIds(admin: SupabaseClient, studentId: string) {
  const { data: memberships } = await admin
    .from("student_classes")
    .select("class_id, classes!inner(is_archived)")
    .eq("student_id", studentId)
    .is("left_at", null)
    .eq("classes.is_archived", false);
  const classIds = (memberships ?? []).map((row) => row.class_id as string);
  if (classIds.length === 0) return [];
  const { data: grants } = await admin.from("class_textbooks").select("textbook_id").in("class_id", classIds);
  return [...new Set((grants ?? []).map((row) => row.textbook_id as string))];
}

/**
 * 錯題本：仍未學會、題目仍啟用、教材仍授權的題目，附上次答錯時的遊戲。
 * 只保留目前系統裡仍存在的遊戲類型。
 */
export async function loadOpenMistakes(admin: SupabaseClient, studentId: string): Promise<MistakeRow[]> {
  const books = await accessibleTextbookIds(admin, studentId);
  if (books.length === 0) return [];
  const { data: stats } = await admin
    .from("student_question_stats")
    .select("question_id")
    .eq("student_id", studentId)
    .eq("is_open_mistake", true);
  const ids = (stats ?? []).map((row) => row.question_id as string);
  if (ids.length === 0) return [];

  const [{ data: questions }, { data: wrong }] = await Promise.all([
    admin
      .from("questions")
      .select("id, textbook_id")
      .in("id", ids)
      .in("textbook_id", books)
      .eq("is_active", true)
      .eq("review_status", "confirmed")
      .is("deleted_at", null),
    admin
      .from("answers")
      .select("question_id, game_type, completed_at")
      .eq("student_id", studentId)
      .eq("is_correct", false)
      .in("question_id", ids)
      .order("completed_at", { ascending: false }),
  ]);

  const lastGame = new Map<string, string>();
  for (const row of wrong ?? []) {
    if (!lastGame.has(row.question_id as string)) lastGame.set(row.question_id as string, row.game_type as string);
  }
  return (questions ?? []).flatMap((question) => {
    const gameType = lastGame.get(question.id as string);
    if (!gameType || !getGameDefinition(gameType)) return [];
    return [{ question_id: question.id as string, game_type: gameType, textbook_id: question.textbook_id as string }];
  });
}

export async function loadMistakeGroups(admin: SupabaseClient, studentId: string): Promise<MistakeGroup[]> {
  return groupMistakes(await loadOpenMistakes(admin, studentId));
}

/** 今天（台灣時間）完成了哪些事。 */
export async function loadTodayActivity(admin: SupabaseClient, studentId: string, now = new Date()) {
  const { start, end } = taipeiDay(now);
  const { data } = await admin
    .from("game_sessions")
    .select("mode, level_id")
    .eq("student_id", studentId)
    .eq("status", "completed")
    .gte("completed_at", start.toISOString())
    .lt("completed_at", end.toISOString());
  const sessions = data ?? [];
  return {
    levelDoneToday: sessions.some((row) => row.level_id && (row.mode === "normal" || row.mode === "retry_all")),
    reviewDoneToday: sessions.some((row) => row.mode === "review"),
  };
}

export async function loadTodayMission(
  admin: SupabaseClient,
  studentId: string,
  options: { hasLevels: boolean; openMistakes: number },
): Promise<Mission | null> {
  const activity = await loadTodayActivity(admin, studentId);
  return todayMission({ ...activity, ...options });
}

async function award(admin: SupabaseClient, studentId: string, sessionId: string, code: string) {
  const { data: badge } = await admin.from("badges").select("id").eq("code", code).eq("is_active", true).maybeSingle();
  if (!badge) return false;
  const { data, error } = await admin
    .from("student_badges")
    .upsert({ student_id: studentId, badge_id: badge.id, session_id: sessionId }, { onConflict: "student_id,badge_id", ignoreDuplicates: true })
    .select("badge_id");
  return !error && (data?.length ?? 0) > 0;
}

/**
 * 一局結束後發放 Daily Explorer（完成今日任務）與 Review Master（錯題複習全對）。
 * 已經有的徽章不會重複發放。回傳這局新得到的徽章代碼。
 */
export async function awardMissionBadges(
  admin: SupabaseClient,
  session: { id: string; student_id: string; mode: string; score: number | null },
) {
  if (session.mode === "preview") return [];
  const earned: string[] = [];
  if (session.mode === "review" && session.score === 100) {
    if (await award(admin, session.student_id, session.id, "review_master")) earned.push("review_master");
  }
  const openMistakes = (await loadOpenMistakes(admin, session.student_id)).length;
  const mission = await loadTodayMission(admin, session.student_id, { hasLevels: true, openMistakes });
  if (mission?.complete) {
    if (await award(admin, session.student_id, session.id, "daily_explorer")) earned.push("daily_explorer");
  }
  return earned;
}
