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
  const { data: progress } = ids.length
    ? await client.from("student_progress").select("level_id, stars").eq("student_id", studentId).in("level_id", ids)
    : { data: [] };
  const stars = new Map((progress ?? []).map((row) => [row.level_id as string, row.stars as number]));
  const states = computeLevelStates(levels ?? [], stars);

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
