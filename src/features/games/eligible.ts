import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGameDefinition } from "@/features/games/registry";
import type { QuestionRow } from "@/features/games/types";

type Game = {
  game_type: string;
  unit_id: string;
  difficulty_min: number;
  difficulty_max: number;
};

/** 只取老師已確認並啟用的題目，同一局不重複。 */
export async function loadEligibleQuestions(admin: SupabaseClient, game: Game) {
  const definition = getGameDefinition(game.game_type);
  if (!definition) return [];
  const { data, error } = await admin
    .from("questions")
    .select("id, topic_id, content_type, content, answer_key, explanation_zh")
    .eq("unit_id", game.unit_id)
    .eq("is_active", true)
    .eq("review_status", "confirmed")
    .is("deleted_at", null)
    .gte("difficulty", game.difficulty_min)
    .lte("difficulty", game.difficulty_max)
    .in("content_type", definition.contentTypes);
  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  return (data as QuestionRow[]).filter((question) => {
    if (!definition.accepts(question)) return false;
    const identity = definition.identity(question);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}
