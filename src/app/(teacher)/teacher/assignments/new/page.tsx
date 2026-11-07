import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { requireTeacher } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AssignmentForm } from "./assignment-form";

export const metadata: Metadata = { title: "新增任務" };

export default async function NewAssignmentPage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  await requireTeacher();
  const { level } = await searchParams;
  const supabase = await createClient();
  const [{ data: levels }, { data: classes }, { data: students }] = await Promise.all([
    supabase
      .from("game_levels")
      .select("id, title, order_index, island_zones!inner(name, order_index, is_open, textbooks(title))")
      .eq("is_published", true)
      .eq("island_zones.is_open", true),
    supabase.from("classes").select("id, name").eq("is_archived", false).order("name"),
    supabase.from("profiles").select("id, display_name, username").eq("role", "student").eq("is_active", true).order("display_name"),
  ]);

  type Row = { id: string; title: string; order_index: number; island_zones: { name: string; order_index: number; textbooks: { title: string } } };
  const rows = ((levels ?? []) as unknown as Row[]).sort(
    (a, b) =>
      a.island_zones.textbooks.title.localeCompare(b.island_zones.textbooks.title, "zh-Hant") ||
      a.island_zones.order_index - b.island_zones.order_index ||
      a.order_index - b.order_index,
  );
  const groups: { label: string; levels: { id: string; title: string }[] }[] = [];
  for (const row of rows) {
    const label = `${row.island_zones.textbooks.title}・${row.island_zones.name}`;
    const group = groups.at(-1)?.label === label ? groups.at(-1)! : (groups.push({ label, levels: [] }), groups.at(-1)!);
    group.levels.push({ id: row.id, title: row.title });
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/teacher/assignments" className="text-sm text-navy underline underline-offset-4">
          任務指派
        </Link>
        <h1 className="mt-1 text-3xl">新增任務</h1>
      </div>
      <Card>
        {groups.length === 0 ? (
          <p className="text-muted">
            還沒有已發布的關卡。請先到{" "}
            <Link href="/teacher/islands" className="text-navy underline">
              闖關島
            </Link>{" "}
            建立並發布關卡。
          </p>
        ) : (
          <AssignmentForm
            groups={groups}
            classes={classes ?? []}
            students={(students ?? []).map((item) => ({ id: item.id, name: item.display_name, username: item.username }))}
            defaultLevel={level && rows.some((row) => row.id === level) ? level : undefined}
          />
        )}
      </Card>
    </div>
  );
}
