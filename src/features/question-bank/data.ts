import "server-only";
import { createClient } from "@/lib/supabase/server";

export type StageOption = { id: string; name: string; difficulty_labels: string[] };
export type UnitOption = {
  id: string;
  title: string;
  learning_topics: { id: string; title: string }[];
  passages: { id: string; title: string }[];
};
export type TextbookOption = {
  id: string;
  title: string;
  kind: string;
  stage_id: string;
  units: UnitOption[];
};

/** 題目表單與匯入共用的教材樹。 */
export async function loadContentTree() {
  const supabase = await createClient();
  const [{ data: stages }, { data: textbooks, error }] = await Promise.all([
    supabase.from("learning_stages").select("id, name, difficulty_labels").order("order_index"),
    supabase
      .from("textbooks")
      .select(
        "id, title, kind, stage_id, units(id, title, order_index, learning_topics(id, title), passages(id, title))",
      )
      .order("order_index")
      .order("title"),
  ]);
  if (error) throw new Error(error.message);

  const tree = ((textbooks ?? []) as unknown as (TextbookOption & {
    units: (UnitOption & { order_index: number })[];
  })[]).map((book) => ({
    ...book,
    units: [...book.units].sort((a, b) => a.order_index - b.order_index),
  }));

  return { stages: (stages ?? []) as StageOption[], textbooks: tree as TextbookOption[] };
}

export async function loadMediaNames() {
  const supabase = await createClient();
  const { data } = await supabase.from("media_assets").select("file_name").order("file_name");
  return data?.map((item) => item.file_name as string) ?? [];
}
