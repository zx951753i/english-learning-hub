import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAssignments, loadProgress } from "@/features/assignments/data";
import { getGameDefinition } from "@/features/games/registry";
import { loadOpenMistakes } from "@/features/missions/data";
import { questionLabel } from "@/features/records/labels";

const MODE_LABELS: Record<string, string> = {
  normal: "闖關",
  retry_all: "再挑戰",
  retry_wrong: "只練錯題",
  review: "錯題複習",
};

export type SessionSummary = {
  id: string;
  title: string;
  game: string;
  mode: string;
  score: number;
  stars: number | null;
  correct: number;
  total: number;
  seconds: number;
  completedAt: string;
};

/**
 * 老師查看單一學生的學習紀錄。supabase 為老師身分（RLS 可讀全部紀錄）；
 * admin 只用來計算錯題本，呼叫端必須先 requireTeacher。
 */
export async function loadStudentRecord(supabase: SupabaseClient, admin: SupabaseClient, studentId: string) {
  const [sessionsResult, allSessions, answered, correct, progress, badges, mistakes, memberships] = await Promise.all([
    supabase
      .from("game_sessions")
      .select("id, mode, game_type, score, stars_earned, correct_count, question_total, time_spent, completed_at, game_levels(title), games(title)")
      .eq("student_id", studentId)
      .eq("status", "completed")
      .neq("mode", "preview")
      .order("completed_at", { ascending: false })
      .limit(20),
    supabase
      .from("game_sessions")
      .select("time_spent, completed_at")
      .eq("student_id", studentId)
      .eq("status", "completed")
      .neq("mode", "preview")
      .limit(5000),
    supabase.from("answers").select("id", { count: "exact", head: true }).eq("student_id", studentId),
    supabase.from("answers").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("is_correct", true),
    supabase.from("student_progress").select("stars").eq("student_id", studentId),
    supabase.from("student_badges").select("earned_at, badges(name)").eq("student_id", studentId).order("earned_at"),
    loadOpenMistakes(admin, studentId),
    supabase
      .from("student_classes")
      .select("class_id")
      .eq("student_id", studentId)
      .is("left_at", null),
  ]);

  const sessions: SessionSummary[] = (sessionsResult.data ?? []).map((row) => {
    const level = row.game_levels as unknown as { title: string } | null;
    const game = row.games as unknown as { title: string } | null;
    return {
      id: row.id,
      title: row.mode === "review" ? "錯題本" : (level?.title ?? game?.title ?? "（關卡已刪除）"),
      game: getGameDefinition(row.game_type)?.label ?? row.game_type,
      mode: MODE_LABELS[row.mode] ?? row.mode,
      score: row.score ?? 0,
      stars: row.mode === "normal" || row.mode === "retry_all" ? row.stars_earned : null,
      correct: row.correct_count,
      total: row.question_total,
      seconds: row.time_spent,
      completedAt: row.completed_at,
    };
  });

  const playedAll = allSessions.data ?? [];
  const totalAnswers = answered.count ?? 0;

  // 錯題本：題目內容與答錯次數
  const ids = mistakes.map((row) => row.question_id);
  const [{ data: questions }, { data: stats }] = ids.length
    ? await Promise.all([
        supabase.from("questions").select("id, content_type, content, units(title)").in("id", ids),
        supabase.from("student_question_stats").select("question_id, wrong_count").eq("student_id", studentId).in("question_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const wrongCount = new Map((stats ?? []).map((row) => [row.question_id as string, row.wrong_count as number]));
  const mistakeList = (questions ?? [])
    .map((row) => ({
      id: row.id as string,
      label: questionLabel(row.content_type as string, row.content as Record<string, unknown>),
      unit: (row.units as unknown as { title: string } | null)?.title ?? "",
      wrong: wrongCount.get(row.id as string) ?? 0,
    }))
    .sort((a, b) => b.wrong - a.wrong || a.label.localeCompare(b.label));

  // 任務：指派給個人或所屬班級
  const classIds = new Set((memberships.data ?? []).map((row) => row.class_id as string));
  const assignments = (await loadAssignments(supabase)).filter(
    (row) => row.is_active && (row.student_id === studentId || (row.class_id !== null && classIds.has(row.class_id))),
  );
  const progressMap = await loadProgress(supabase, assignments);
  const tasks = assignments.map((row) => ({
    ...row,
    progress: (progressMap.get(row.id) ?? []).find((item) => item.id === studentId) ?? null,
  }));

  return {
    sessions,
    summary: {
      sessions: playedAll.length,
      minutes: Math.round(playedAll.reduce((sum, row) => sum + (row.time_spent ?? 0), 0) / 60),
      accuracy: totalAnswers ? Math.round(((correct.count ?? 0) / totalAnswers) * 100) : null,
      answers: totalAnswers,
      levels: (progress.data ?? []).length,
      stars: (progress.data ?? []).reduce((sum, row) => sum + (row.stars as number), 0),
      lastActive: playedAll.map((row) => row.completed_at as string).sort().at(-1) ?? null,
    },
    badges: (badges.data ?? []).map((row) => (row.badges as unknown as { name: string }).name),
    mistakes: mistakeList,
    tasks,
  };
}

/** 台灣時間的日期與時間，例如「11/7 下午 3:05」。 */
export function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分`;
}
