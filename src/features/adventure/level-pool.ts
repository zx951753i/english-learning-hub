import "server-only";
import { getGameDefinition } from "@/features/games/registry";
import { loadLevelPool, type GameConfig } from "@/features/games/session-factory";
import type { QuestionRow } from "@/features/games/types";
import { contentTypeLabel } from "@/features/question-bank/content-types";
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

type GameScope = {
  game_type: string;
  textbook_id: string;
  unit_id: string;
  difficulty_min: number;
  difficulty_max: number;
};

/**
 * 說明單元裡的題目為什麼沒有被這一關使用，方便老師找原因。
 * 只供已驗證為老師的伺服器流程使用。
 */
export async function explainLevelPool(game: GameScope) {
  const definition = getGameDefinition(game.game_type);
  if (!definition) return [];
  const admin = createAdminClient();
  const types = definition.contentTypes;
  const [{ data: inUnit }, { count: otherUnits }] = await Promise.all([
    admin
      .from("questions")
      .select("id, content_type, content, answer_key, review_status, is_active, difficulty")
      .eq("unit_id", game.unit_id)
      .in("content_type", types)
      .is("deleted_at", null),
    admin
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("textbook_id", game.textbook_id)
      .neq("unit_id", game.unit_id)
      .in("content_type", types)
      .is("deleted_at", null),
  ]);
  const rows = inUnit ?? [];
  const draft = rows.filter((row) => row.review_status !== "confirmed").length;
  const inactive = rows.filter((row) => row.review_status === "confirmed" && !row.is_active).length;
  const usable = rows.filter((row) => row.review_status === "confirmed" && row.is_active);
  const outOfRange = usable.filter((row) => row.difficulty < game.difficulty_min || row.difficulty > game.difficulty_max).length;
  const notSuitable = usable.filter(
    (row) =>
      row.difficulty >= game.difficulty_min &&
      row.difficulty <= game.difficulty_max &&
      !definition.accepts({ ...row, topic_id: null, explanation_zh: null } as QuestionRow),
  ).length;

  const typeNames = types.map(contentTypeLabel).join("、");
  const reasons: string[] = [];
  if (rows.length === 0) {
    reasons.push(
      otherUnits
        ? `這個單元沒有「${typeNames}」題目；同一本教材的其他單元有 ${otherUnits} 題，請確認關卡選的單元是否正確。`
        : `這個單元沒有「${typeNames}」題目。`,
    );
  }
  if (draft) reasons.push(`${draft} 題尚未確認，請到「題庫」確認後才會出題。`);
  if (inactive) reasons.push(`${inactive} 題已停用。`);
  if (outOfRange) reasons.push(`${outOfRange} 題不在這關設定的難度範圍內。`);
  if (notSuitable) reasons.push(`${notSuitable} 題不適用 ${definition.label}${SUITABILITY[definition.key] ?? "。"}`);
  return reasons;
}

/** 各遊戲出題條件的補充說明。 */
const SUITABILITY: Record<string, string> = {
  alphabet_matching: "（只用單一字母，例如 a 或 Aa；sh、ch 這類字母組合請改用 Phonics Sound Match）。",
  picture_vocabulary: "（單字題要有圖片）。",
  sentence_builder: "（句子要能切成 2 個以上詞塊）。",
  phonics_sound_match: "（需要例字）。",
};
