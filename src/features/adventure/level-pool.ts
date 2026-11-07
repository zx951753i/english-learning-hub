import "server-only";
import { loadLevelPool, type GameConfig } from "@/features/games/session-factory";
import { createAdminClient } from "@/lib/supabase/admin";

/** 關卡目前可用的題目；只供已驗證為老師的伺服器流程使用。 */
export async function levelQuestionPool(levelId: string) {
  const admin = createAdminClient();
  const { data: level } = await admin
    .from("game_levels")
    .select("games(id, game_type, stage_id, textbook_id, unit_id, question_count, difficulty_min, difficulty_max)")
    .eq("id", levelId)
    .maybeSingle();
  if (!level) return [];
  return loadLevelPool(admin, level.games as unknown as GameConfig, levelId);
}

export async function countLevelQuestions(levelId: string) {
  return (await levelQuestionPool(levelId)).length;
}
