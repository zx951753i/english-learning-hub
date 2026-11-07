import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState } from "@/components/ui/card";
import { requireTeacher } from "@/features/auth/session";
import { loadAssignments, loadProgress } from "@/features/assignments/data";
import { formatWhen } from "@/features/records/data";
import { createClient } from "@/lib/supabase/server";

const DAY = 24 * 60 * 60 * 1000;
const INACTIVE_DAYS = 7;
const MISTAKE_ALERT = 10;

export const metadata: Metadata = { title: "總覽" };

export default async function TeacherOverviewPage() {
  const profile = await requireTeacher();
  const supabase = await createClient();

  const [{ data: students }, { data: classes }, { data: memberships }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, username")
      .eq("role", "student")
      .eq("is_active", true)
      .order("display_name"),
    supabase.from("classes").select("id").eq("is_archived", false),
    supabase.from("student_classes").select("student_id, classes!inner(is_archived)").is("left_at", null).eq("classes.is_archived", false),
  ]);

  const since = sinceDays(INACTIVE_DAYS);
  const [{ data: recent }, { data: active }, { data: openStats }, assignments] = await Promise.all([
    supabase
      .from("game_sessions")
      .select("id, student_id, mode, score, completed_at, profiles(display_name), game_levels(title)")
      .eq("status", "completed")
      .neq("mode", "preview")
      .order("completed_at", { ascending: false })
      .limit(8),
    supabase.from("game_sessions").select("student_id").eq("status", "completed").neq("mode", "preview").gte("completed_at", since),
    supabase.from("student_question_stats").select("student_id").eq("is_open_mistake", true),
    loadAssignments(supabase),
  ]);
  const progress = await loadProgress(
    supabase,
    assignments.filter((row) => row.is_active),
  );

  const placed = new Set(memberships?.map((item) => item.student_id));
  const unplaced = students?.filter((student) => !placed.has(student.id)) ?? [];

  // 需要關注：在班上但 7 天沒有練習、錯題累積較多、或有逾期任務。
  const activeIds = new Set(active?.map((row) => row.student_id));
  const mistakeCount = new Map<string, number>();
  for (const row of openStats ?? []) mistakeCount.set(row.student_id, (mistakeCount.get(row.student_id) ?? 0) + 1);
  const overdue = new Map<string, number>();
  for (const list of progress.values()) {
    for (const item of list) if (item.status === "overdue") overdue.set(item.id, (overdue.get(item.id) ?? 0) + 1);
  }
  const attention = (students ?? [])
    .filter((student) => placed.has(student.id))
    .map((student) => {
      const reasons: string[] = [];
      if (!activeIds.has(student.id)) reasons.push(`${INACTIVE_DAYS} 天沒有練習`);
      if ((overdue.get(student.id) ?? 0) > 0) reasons.push(`${overdue.get(student.id)} 個任務逾期`);
      if ((mistakeCount.get(student.id) ?? 0) >= MISTAKE_ALERT) reasons.push(`錯題本 ${mistakeCount.get(student.id)} 題`);
      return { ...student, reasons };
    })
    .filter((student) => student.reasons.length > 0);
  const ATTENTION_LIMIT = 12;
  const attentionShown = attention.slice(0, ATTENTION_LIMIT);

  const stats = [
    { label: "使用中的學生", value: students?.length ?? 0, href: "/teacher/students" },
    { label: "進行中的班級", value: classes?.length ?? 0, href: "/teacher/classes" },
    { label: "尚未分班", value: unplaced.length, href: "/teacher/students" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl">您好，{profile.display_name}</h1>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="統計">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="transition-colors hover:border-navy/40">
              <p className="text-sm text-muted">{stat.label}</p>
              <p className="font-serif text-4xl font-semibold text-navy">{stat.value}</p>
            </Card>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xl">最近的練習</h2>
          {!recent?.length ? (
            <EmptyState title="還沒有學生的作答紀錄" />
          ) : (
            <Card className="divide-y divide-line p-0">
              {recent.map((row) => (
                <Link
                  key={row.id}
                  href={`/teacher/students/${row.student_id}/sessions/${row.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-sky/40"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {(row.profiles as unknown as { display_name: string } | null)?.display_name}
                    </span>
                    <span className="block truncate text-sm text-muted">
                      {row.mode === "review"
                        ? "錯題複習"
                        : ((row.game_levels as unknown as { title: string } | null)?.title ?? "（關卡已刪除）")}
                      ・{formatWhen(row.completed_at)}
                    </span>
                  </span>
                  <span className="shrink-0 font-serif text-lg font-semibold text-navy">{row.score} 分</span>
                </Link>
              ))}
            </Card>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xl">需要關注的學生</h2>
          {attention.length === 0 ? (
            <EmptyState title="目前沒有需要特別關注的學生" />
          ) : (
            <Card className="divide-y divide-line p-0">
              {attentionShown.map((student) => (
                <Link
                  key={student.id}
                  href={`/teacher/students/${student.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 py-3 hover:bg-sky/40"
                >
                  <span className="font-medium">{student.display_name}</span>
                  <span className="text-sm text-danger">{student.reasons.join("・")}</span>
                </Link>
              ))}
              {attention.length > ATTENTION_LIMIT ? (
                <Link href="/teacher/students" className="block px-5 py-3 text-sm text-navy underline underline-offset-4">
                  還有 {attention.length - ATTENTION_LIMIT} 位，到學生列表查看
                </Link>
              ) : null}
            </Card>
          )}
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-xl">尚未分班的學生</h2>
        {unplaced.length === 0 ? (
          <EmptyState title="目前沒有需要分班的學生" />
        ) : (
          <Card className="divide-y divide-line p-0">
            {unplaced.map((student) => (
              <Link
                key={student.id}
                href={`/teacher/students/${student.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-sky/40"
              >
                <span className="font-medium">{student.display_name}</span>
                <span className="text-sm text-muted">{student.username}</span>
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

/** N 天前的時間（伺服器端計算）。 */
function sinceDays(days: number) {
  return new Date(new Date().getTime() - days * DAY).toISOString();
}
