"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DEFAULT_THREE_STAR,
  DEFAULT_TWO_STAR,
  isZoneTheme,
  UNLOCK_RULES,
  ZONE_TEMPLATES,
} from "@/features/adventure/rules";
import { requireTeacher } from "@/features/auth/session";
import { getGameDefinition } from "@/features/games/registry";
import { countLevelQuestions } from "@/features/adventure/level-pool";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; saved?: boolean };

const field = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const num = (formData: FormData, key: string) => Number(field(formData, key));
const refresh = () => revalidatePath("/", "layout");

// ---------------------------------------------------------------------------
// 區域
// ---------------------------------------------------------------------------

async function nextZoneOrder(supabase: Awaited<ReturnType<typeof createClient>>, textbookId: string) {
  const { data } = await supabase
    .from("island_zones")
    .select("order_index")
    .eq("textbook_id", textbookId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.order_index ?? 0) + 1;
}

function readZone(formData: FormData) {
  const values = {
    name: field(formData, "name"),
    theme_key: field(formData, "theme"),
    description: field(formData, "description") || null,
  };
  if (values.name.length < 1 || values.name.length > 60) return { error: "區域名稱需為 1–60 字。" } as const;
  if (!isZoneTheme(values.theme_key)) return { error: "請選擇插畫主題。" } as const;
  if (values.description && values.description.length > 200) return { error: "說明不可超過 200 字。" } as const;
  return { values } as const;
}

export async function createZone(textbookId: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireTeacher();
  const parsed = readZone(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { data: book } = await supabase.from("textbooks").select("stage_id").eq("id", textbookId).maybeSingle();
  if (!book) return { error: "找不到這本教材。" };

  const { data, error } = await supabase
    .from("island_zones")
    .insert({
      ...parsed.values,
      textbook_id: textbookId,
      stage_id: book.stage_id,
      order_index: await nextZoneOrder(supabase, textbookId),
    })
    .select("id")
    .single();
  if (error) return { error: "建立失敗，請稍後再試。" };
  refresh();
  redirect(`/teacher/islands/zones/${data.id}`);
}

/** 依島嶼範本補上尚未建立的區域；已有同名區域時略過。 */
export async function createZonesFromTemplate(textbookId: string) {
  await requireTeacher();
  const supabase = await createClient();
  const { data: book } = await supabase
    .from("textbooks")
    .select("stage_id, learning_stages(slug)")
    .eq("id", textbookId)
    .maybeSingle();
  if (!book) redirect("/teacher/islands");
  const slug = (book.learning_stages as unknown as { slug: string }).slug;
  const template = ZONE_TEMPLATES[slug] ?? [];

  const { data: existing } = await supabase.from("island_zones").select("name").eq("textbook_id", textbookId);
  const names = new Set(existing?.map((zone) => zone.name.toLowerCase()));
  let order = await nextZoneOrder(supabase, textbookId);
  const rows = template
    .filter((zone) => !names.has(zone.name.toLowerCase()))
    .map((zone) => ({
      name: zone.name,
      theme_key: zone.theme,
      textbook_id: textbookId,
      stage_id: book.stage_id,
      order_index: order++,
    }));
  if (rows.length > 0) {
    const { error } = await supabase.from("island_zones").insert(rows);
    if (error) redirect(`/teacher/islands?book=${textbookId}&error=template`);
  }
  refresh();
  redirect(`/teacher/islands?book=${textbookId}`);
}

export async function updateZone(zoneId: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireTeacher();
  const parsed = readZone(formData);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const { error } = await supabase.from("island_zones").update(parsed.values).eq("id", zoneId);
  if (error) return { error: "更新失敗，請稍後再試。" };
  refresh();
  return { saved: true };
}

export async function setZoneOpen(zoneId: string, open: boolean) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase.from("island_zones").update({ is_open: open }).eq("id", zoneId);
  if (error) redirect(`/teacher/islands/zones/${zoneId}?error=status`);
  refresh();
}

export async function moveZone(textbookId: string, zoneId: string, direction: -1 | 1) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_zone", { p_zone_id: zoneId, p_direction: direction });
  if (error) redirect(`/teacher/islands?book=${textbookId}&error=move`);
  refresh();
}

export async function deleteZone(zoneId: string, textbookId: string) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase.from("island_zones").delete().eq("id", zoneId);
  if (error) redirect(`/teacher/islands/zones/${zoneId}?error=delete`);
  refresh();
  redirect(`/teacher/islands?book=${textbookId}`);
}

// ---------------------------------------------------------------------------
// 關卡
// ---------------------------------------------------------------------------

function readLevelRules(formData: FormData) {
  const rules = {
    two_star_percent: num(formData, "twoStar") || DEFAULT_TWO_STAR,
    three_star_percent: num(formData, "threeStar") || DEFAULT_THREE_STAR,
    unlock_rule: field(formData, "unlockRule") || "previous_complete",
    is_boss: formData.get("isBoss") === "on",
  };
  const { two_star_percent: two, three_star_percent: three } = rules;
  if (!Number.isInteger(two) || !Number.isInteger(three) || two < 1 || three > 100 || two >= three) {
    return { error: "星星門檻需為 1–100，且 2 星門檻要低於 3 星。" } as const;
  }
  if (!UNLOCK_RULES.some((rule) => rule.key === rules.unlock_rule)) return { error: "請選擇解鎖規則。" } as const;
  return { rules } as const;
}

function readGameSettings(formData: FormData) {
  const settings = {
    question_count: num(formData, "questionCount"),
    difficulty_min: num(formData, "difficultyMin") || 1,
    difficulty_max: num(formData, "difficultyMax") || 4,
  };
  if (!Number.isInteger(settings.question_count) || settings.question_count < 2 || settings.question_count > 30) {
    return { error: "每局題數需為 2–30。" } as const;
  }
  if (settings.difficulty_min > settings.difficulty_max) return { error: "最低難度不可高於最高難度。" } as const;
  return { settings } as const;
}

async function nextLevelOrder(supabase: Awaited<ReturnType<typeof createClient>>, zoneId: string) {
  const { data } = await supabase
    .from("game_levels")
    .select("order_index")
    .eq("zone_id", zoneId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.order_index ?? 0) + 1;
}

async function loadZone(supabase: Awaited<ReturnType<typeof createClient>>, zoneId: string) {
  const { data } = await supabase
    .from("island_zones")
    .select("id, textbook_id, stage_id")
    .eq("id", zoneId)
    .maybeSingle();
  return data;
}

/** 建立關卡時一併建立它的遊戲設定，兩者一對一。 */
async function insertLevel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  zone: { id: string; textbook_id: string; stage_id: string },
  values: {
    title: string;
    gameType: string;
    unitId: string;
    settings: { question_count: number; difficulty_min: number; difficulty_max: number };
    rules: { two_star_percent: number; three_star_percent: number; unlock_rule: string; is_boss: boolean };
    order: number;
  },
) {
  const { data: game, error } = await supabase
    .from("games")
    .insert({
      game_type: values.gameType,
      title: values.title,
      stage_id: zone.stage_id,
      textbook_id: zone.textbook_id,
      unit_id: values.unitId,
      ...values.settings,
    })
    .select("id")
    .single();
  if (error) return null;

  const { data: level, error: levelError } = await supabase
    .from("game_levels")
    .insert({ zone_id: zone.id, game_id: game.id, title: values.title, order_index: values.order, ...values.rules })
    .select("id")
    .single();
  if (levelError) {
    await supabase.from("games").delete().eq("id", game.id);
    return null;
  }
  return level.id as string;
}

export async function createLevel(zoneId: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireTeacher();
  const title = field(formData, "title");
  const gameType = field(formData, "gameType");
  const unitId = field(formData, "unitId");
  if (title.length < 1 || title.length > 120) return { error: "關卡名稱需為 1–120 字。" };
  if (!getGameDefinition(gameType)) return { error: "請選擇遊戲類型。" };
  if (!unitId) return { error: "請選擇單元。" };
  const game = readGameSettings(formData);
  if ("error" in game) return { error: game.error };
  const level = readLevelRules(formData);
  if ("error" in level) return { error: level.error };

  const supabase = await createClient();
  const zone = await loadZone(supabase, zoneId);
  if (!zone) return { error: "找不到這個區域。" };
  const { data: unit } = await supabase.from("units").select("textbook_id").eq("id", unitId).maybeSingle();
  if (unit?.textbook_id !== zone.textbook_id) return { error: "單元必須屬於這個區域的教材。" };

  const levelId = await insertLevel(supabase, zone, {
    title,
    gameType,
    unitId,
    settings: game.settings,
    rules: level.rules,
    order: await nextLevelOrder(supabase, zoneId),
  });
  if (!levelId) return { error: "建立失敗，請稍後再試。" };
  refresh();
  redirect(`/teacher/islands/levels/${levelId}`);
}

/** 為教材每個啟用中的單元各建一關，方便快速鋪好路線。 */
export async function createLevelsForUnits(zoneId: string, formData: FormData) {
  await requireTeacher();
  const definition = getGameDefinition(field(formData, "gameType"));
  if (!definition) redirect(`/teacher/islands/zones/${zoneId}?error=bulk`);

  const supabase = await createClient();
  const zone = await loadZone(supabase, zoneId);
  if (!zone) redirect("/teacher/islands");
  const { data: units } = await supabase
    .from("units")
    .select("id, title")
    .eq("textbook_id", zone.textbook_id)
    .eq("is_active", true)
    .order("order_index");

  let order = await nextLevelOrder(supabase, zoneId);
  for (const unit of units ?? []) {
    const created = await insertLevel(supabase, zone, {
      title: `${unit.title} ${definition.label}`,
      gameType: definition.key,
      unitId: unit.id,
      settings: { question_count: 8, difficulty_min: 1, difficulty_max: 4 },
      rules: {
        two_star_percent: DEFAULT_TWO_STAR,
        three_star_percent: DEFAULT_THREE_STAR,
        unlock_rule: "previous_complete",
        is_boss: false,
      },
      order: order++,
    });
    if (!created) redirect(`/teacher/islands/zones/${zoneId}?error=bulk`);
  }
  refresh();
  redirect(`/teacher/islands/zones/${zoneId}`);
}

export async function updateLevel(levelId: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireTeacher();
  const title = field(formData, "title");
  if (title.length < 1 || title.length > 120) return { error: "關卡名稱需為 1–120 字。" };
  const game = readGameSettings(formData);
  if ("error" in game) return { error: game.error };
  const level = readLevelRules(formData);
  if ("error" in level) return { error: level.error };

  const supabase = await createClient();
  const { data: current } = await supabase.from("game_levels").select("game_id").eq("id", levelId).maybeSingle();
  if (!current) return { error: "找不到這個關卡。" };

  const { error } = await supabase.from("game_levels").update({ title, ...level.rules }).eq("id", levelId);
  const { error: gameError } = await supabase
    .from("games")
    .update({ title, ...game.settings })
    .eq("id", current.game_id);
  if (error || gameError) return { error: "更新失敗，請稍後再試。" };
  refresh();
  return { saved: true };
}

export async function setLevelPublished(levelId: string, published: boolean) {
  await requireTeacher();
  if (published) {
    const supabase = await createClient();
    const { data: level } = await supabase.from("game_levels").select("games(game_type)").eq("id", levelId).maybeSingle();
    const type = (level?.games as unknown as { game_type: string } | undefined)?.game_type ?? "";
    const minimum = getGameDefinition(type)?.minQuestions ?? 2;
    if ((await countLevelQuestions(levelId)) < minimum) {
      redirect(`/teacher/islands/levels/${levelId}?error=not-enough`);
    }
  }
  const supabase = await createClient();
  const { error } = await supabase.from("game_levels").update({ is_published: published }).eq("id", levelId);
  if (error) redirect(`/teacher/islands/levels/${levelId}?error=publish`);
  refresh();
}

export async function moveLevel(zoneId: string, levelId: string, direction: -1 | 1) {
  await requireTeacher();
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_level", { p_level_id: levelId, p_direction: direction });
  if (error) redirect(`/teacher/islands/zones/${zoneId}?error=move`);
  refresh();
}

/** 只有沒有學生紀錄的關卡可以刪除；有紀錄的請改為取消發布。 */
export async function deleteLevel(levelId: string, zoneId: string) {
  await requireTeacher();
  const supabase = await createClient();
  const { count } = await supabase
    .from("game_sessions")
    .select("id", { count: "exact", head: true })
    .eq("level_id", levelId)
    .neq("mode", "preview");
  if (count) redirect(`/teacher/islands/levels/${levelId}?error=delete`);

  const { data: level } = await supabase.from("game_levels").select("game_id").eq("id", levelId).maybeSingle();
  const { error } = await supabase.from("game_levels").delete().eq("id", levelId);
  if (error || !level) redirect(`/teacher/islands/levels/${levelId}?error=delete`);
  await supabase.from("games").delete().eq("id", level.game_id);
  refresh();
  redirect(`/teacher/islands/zones/${zoneId}`);
}

export async function saveLevelQuestions(levelId: string, formData: FormData) {
  await requireTeacher();
  const ids = formData.getAll("questionId").map(String).filter(Boolean);
  const supabase = await createClient();
  const { error } = await supabase.from("level_questions").delete().eq("level_id", levelId);
  if (!error && ids.length > 0) {
    const { error: insertError } = await supabase
      .from("level_questions")
      .insert(ids.map((questionId, index) => ({ level_id: levelId, question_id: questionId, position: index + 1 })));
    if (insertError) redirect(`/teacher/islands/levels/${levelId}?error=questions`);
  }
  if (error) redirect(`/teacher/islands/levels/${levelId}?error=questions`);
  refresh();
  redirect(`/teacher/islands/levels/${levelId}?saved=questions`);
}
