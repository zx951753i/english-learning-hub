import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assignmentStatus, bestStarsSince, type AssignmentStatus, type AttemptRow } from "@/features/missions/rules";

export type AssignmentRow = {
  id: string;
  level_id: string;
  class_id: string | null;
  student_id: string | null;
  note: string | null;
  due_on: string | null;
  is_active: boolean;
  created_at: string;
  levelTitle: string;
  zoneName: string;
  textbookTitle: string;
  targetName: string;
};

export type StudentProgress = {
  id: string;
  name: string;
  status: AssignmentStatus;
  best: number | null;
  lastPlayed: string | null;
};

/** 老師身分讀取任務（RLS：老師可讀全部）。 */
export async function loadAssignments(supabase: SupabaseClient, filter?: { id?: string; studentId?: string }) {
  let query = supabase
    .from("assignments")
    .select(
      "id, level_id, class_id, student_id, note, due_on, is_active, created_at, game_levels!inner(title, island_zones!inner(name, textbooks(title))), classes(name), profiles(display_name)",
    )
    .order("created_at", { ascending: false });
  if (filter?.id) query = query.eq("id", filter.id);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row): AssignmentRow => {
    const level = row.game_levels as unknown as {
      title: string;
      island_zones: { name: string; textbooks: { title: string } };
    };
    return {
      id: row.id,
      level_id: row.level_id,
      class_id: row.class_id,
      student_id: row.student_id,
      note: row.note,
      due_on: row.due_on,
      is_active: row.is_active,
      created_at: row.created_at,
      levelTitle: level.title,
      zoneName: level.island_zones.name,
      textbookTitle: level.island_zones.textbooks.title,
      targetName: row.class_id
        ? ((row.classes as unknown as { name: string } | null)?.name ?? "班級")
        : ((row.profiles as unknown as { display_name: string } | null)?.display_name ?? "學生"),
    };
  });
}

/** 每個任務的對象學生：班級取目前成員（啟用中的學生），個人就是那位學生。 */
async function targetStudents(supabase: SupabaseClient, assignments: AssignmentRow[]) {
  const classIds = [...new Set(assignments.flatMap((row) => (row.class_id ? [row.class_id] : [])))];
  const studentIds = [...new Set(assignments.flatMap((row) => (row.student_id ? [row.student_id] : [])))];
  const [{ data: members }, { data: people }] = await Promise.all([
    classIds.length
      ? supabase
          .from("student_classes")
          .select("class_id, student_id, profiles!inner(display_name, is_active)")
          .in("class_id", classIds)
          .is("left_at", null)
          .eq("profiles.is_active", true)
      : Promise.resolve({ data: [] as never[] }),
    studentIds.length
      ? supabase.from("profiles").select("id, display_name").in("id", studentIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
  ]);
  const byClass = new Map<string, { id: string; name: string }[]>();
  for (const row of (members ?? []) as { class_id: string; student_id: string; profiles: unknown }[]) {
    const list = byClass.get(row.class_id) ?? [];
    list.push({ id: row.student_id, name: (row.profiles as { display_name: string }).display_name });
    byClass.set(row.class_id, list);
  }
  const names = new Map((people ?? []).map((row) => [row.id, row.display_name]));
  return (assignment: AssignmentRow) =>
    assignment.class_id
      ? (byClass.get(assignment.class_id) ?? [])
      : [{ id: assignment.student_id!, name: names.get(assignment.student_id!) ?? "學生" }];
}

/** 每個任務每位學生的完成情況。 */
export async function loadProgress(supabase: SupabaseClient, assignments: AssignmentRow[], now = new Date()) {
  if (assignments.length === 0) return new Map<string, StudentProgress[]>();
  const targetsOf = await targetStudents(supabase, assignments);
  const levelIds = [...new Set(assignments.map((row) => row.level_id))];
  const { data: sessions } = await supabase
    .from("game_sessions")
    .select("student_id, level_id, completed_at, stars_earned")
    .in("level_id", levelIds)
    .in("mode", ["normal", "retry_all"])
    .eq("status", "completed");

  const attempts = new Map<string, AttemptRow[]>();
  for (const row of sessions ?? []) {
    const key = `${row.student_id}:${row.level_id}`;
    const list = attempts.get(key) ?? [];
    list.push(row);
    attempts.set(key, list);
  }

  return new Map(
    assignments.map((assignment) => {
      const list = targetsOf(assignment).map((student): StudentProgress => {
        const tries = attempts.get(`${student.id}:${assignment.level_id}`) ?? [];
        const start = new Date(assignment.created_at).getTime();
        const since = tries.filter((row) => row.completed_at && new Date(row.completed_at).getTime() >= start);
        return {
          id: student.id,
          name: student.name,
          status: assignmentStatus(assignment, tries, now),
          best: bestStarsSince(assignment.created_at, tries),
          lastPlayed: since.map((row) => row.completed_at!).sort().at(-1) ?? null,
        };
      });
      return [assignment.id, list.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"))];
    }),
  );
}
