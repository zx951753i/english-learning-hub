import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState } from "@/components/ui/card";
import { requireTeacher } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

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

  const placed = new Set(memberships?.map((item) => item.student_id));
  const unplaced = students?.filter((student) => !placed.has(student.id)) ?? [];

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
