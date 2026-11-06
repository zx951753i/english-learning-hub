"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/features/auth/session";
import { getGameDefinition } from "@/features/games/registry";
import { createClient } from "@/lib/supabase/server";

export type GameFormState = { error?: string; saved?: boolean };

const field = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function readGame(formData: FormData) {
  return {
    title: field(formData, "title"),
    question_count: Number(field(formData, "questionCount")),
    difficulty_min: Number(field(formData, "difficultyMin")),
    difficulty_max: Number(field(formData, "difficultyMax")),
    unit_id: field(formData, "unitId"),
  };
}

function validate(game: ReturnType<typeof readGame>) {
  if (game.title.length < 1 || game.title.length > 120) return "遊戲名稱需為 1–120 字。";
  if (!Number.isInteger(game.question_count) || game.question_count < 2 || game.question_count > 30) {
    return "題數需為 2–30。";
  }
  if (!game.unit_id) return "請選擇單元。";
  if (game.difficulty_min > game.difficulty_max) return "最低難度不可高於最高難度。";
  return null;
}

export async function createGame(_: GameFormState, formData: FormData): Promise<GameFormState> {
  await requireTeacher();
  const game = readGame(formData);
  const gameType = field(formData, "gameType");
  const invalid = validate(game);
  if (invalid) return { error: invalid };
  if (!getGameDefinition(gameType)) return { error: "請選擇遊戲類型。" };

  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("units")
    .select("textbook_id, stage_id")
    .eq("id", game.unit_id)
    .maybeSingle();
  if (!unit) return { error: "找不到這個單元。" };

  const { data, error } = await supabase
    .from("games")
    .insert({ ...game, game_type: gameType, textbook_id: unit.textbook_id, stage_id: unit.stage_id })
    .select("id")
    .single();
  if (error) return { error: "建立失敗，請稍後再試。" };

  revalidatePath("/teacher", "layout");
  redirect(`/teacher/games/${data.id}`);
}

export async function updateGame(id: string, _: GameFormState, formData: FormData): Promise<GameFormState> {
  await requireTeacher();
  const { title, question_count, difficulty_min, difficulty_max } = readGame(formData);
  const invalid = validate({ title, question_count, difficulty_min, difficulty_max, unit_id: id });
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from("games")
    .update({ title, question_count, difficulty_min, difficulty_max })
    .eq("id", id);
  if (error) return { error: "更新失敗，請稍後再試。" };
  revalidatePath("/teacher", "layout");
  return { saved: true };
}

export async function setGamePublished(id: string, published: boolean) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase.from("games").update({ is_published: published }).eq("id", id);
  if (error) redirect(`/teacher/games/${id}?error=publish`);
  revalidatePath("/", "layout");
}

export async function deleteGame(id: string) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase.from("games").delete().eq("id", id);
  if (error) redirect(`/teacher/games/${id}?error=delete`);
  revalidatePath("/teacher", "layout");
  redirect("/teacher/games");
}

export async function authorizeTextbook(classId: string, formData: FormData) {
  await requireTeacher();
  const textbookId = field(formData, "textbookId");
  if (!textbookId) return;
  const supabase = await createClient();
  const { data: book } = await supabase
    .from("textbooks")
    .select("stage_id")
    .eq("id", textbookId)
    .maybeSingle();
  const { error } = await supabase
    .from("class_textbooks")
    .insert({ class_id: classId, textbook_id: textbookId, stage_id: book?.stage_id });
  if (error) redirect(`/teacher/classes/${classId}?error=textbook`);
  revalidatePath("/", "layout");
}

export async function revokeTextbook(classId: string, textbookId: string) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase
    .from("class_textbooks")
    .delete()
    .eq("class_id", classId)
    .eq("textbook_id", textbookId);
  if (error) redirect(`/teacher/classes/${classId}?error=textbook`);
  revalidatePath("/", "layout");
}
