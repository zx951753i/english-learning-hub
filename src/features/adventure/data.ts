import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeLevelStates, type LevelState, type UnlockRule } from "@/features/adventure/rules";

export type ZoneLevel = {
  id: string;
  title: string;
  order_index: number;
  unlock_rule: UnlockRule;
  is_boss: boolean;
  two_star_percent: number;
  three_star_percent: number;
  game_type: string;
  question_count: number;
  state: LevelState;
};

/**
 * 某區域內學生看得到的關卡與狀態。client 用學生身分時，RLS 只回傳已發布且已授權的關卡；
 * 用 admin 時呼叫端必須先確認學生有權限。
 */
export async function loadZoneLevels(client: SupabaseClient, zoneId: string, studentId: string) {
  const { data: levels, error } = await client
    .from("game_levels")
    .select(
      "id, title, order_index, unlock_rule, is_boss, two_star_percent, three_star_percent, games(game_type, question_count)",
    )
    .eq("zone_id", zoneId)
    .eq("is_published", true)
    .order("order_index");
  if (error) throw new Error(error.message);

  const ids = (levels ?? []).map((level) => level.id);
  const [{ data: progress }, assigned] = await Promise.all([
    ids.length
      ? client.from("student_progress").select("level_id, stars").eq("student_id", studentId).in("level_id", ids)
      : Promise.resolve({ data: [] as { level_id: string; stars: number }[] }),
    assignedLevelIds(client, studentId, ids),
  ]);
  const stars = new Map((progress ?? []).map((row) => [row.level_id as string, row.stars as number]));
  const states = computeLevelStates(levels ?? [], stars, assigned);

  return (levels ?? []).map((level): ZoneLevel => {
    const game = level.games as unknown as { game_type: string; question_count: number };
    return {
      id: level.id,
      title: level.title,
      order_index: level.order_index,
      unlock_rule: level.unlock_rule as UnlockRule,
      is_boss: level.is_boss,
      two_star_percent: level.two_star_percent,
      three_star_percent: level.three_star_percent,
      game_type: game.game_type,
      question_count: game.question_count,
      state: states.find((state) => state.id === level.id)!,
    };
  });
}

/**
 * 指派給這位學生（個人或所屬班級）且仍有效的關卡。
 * 用學生身分查詢時 RLS 已限制只回傳自己的任務；用 admin 時以 studentId 與班級另外篩選。
 */
export async function assignedLevelIds(client: SupabaseClient, studentId: string, levelIds: string[]) {
  if (levelIds.length === 0) return new Set<string>();
  const [{ data: memberships }, { data: rows }] = await Promise.all([
    client
      .from("student_classes")
      .select("class_id, classes!inner(is_archived)")
      .eq("student_id", studentId)
      .is("left_at", null)
      .eq("classes.is_archived", false),
    client.from("assignments").select("level_id, class_id, student_id").eq("is_active", true).in("level_id", levelIds),
  ]);
  const classes = new Set((memberships ?? []).map((row) => row.class_id as string));
  return new Set(
    (rows ?? [])
      .filter((row) => row.student_id === studentId || (row.class_id && classes.has(row.class_id as string)))
      .map((row) => row.level_id as string),
  );
}
