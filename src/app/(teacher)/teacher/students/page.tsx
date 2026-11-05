import { Plus, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { requireTeacher } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "學生管理" };

export default async function StudentsPage() {
  await requireTeacher();
  const supabase = await createClient();
  const { data: students } = await supabase
    .from("profiles")
    .select("id, display_name, username, is_active, student_classes(left_at, classes(name, is_archived))")
    .eq("role", "student")
    .order("is_active", { ascending: false })
    .order("display_name");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">學生管理</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/teacher/students/import" className={buttonClass("secondary")}>
            <Upload size={18} aria-hidden />
            批次建立
          </Link>
          <Link href="/teacher/students/new" className={buttonClass()}>
            <Plus size={18} aria-hidden />
            新增學生
          </Link>
        </div>
      </div>

      {!students || students.length === 0 ? (
        <EmptyState title="還沒有學生">新增第一位學生，或用 CSV 批次建立。</EmptyState>
      ) : (
        <Card className="divide-y divide-line p-0">
          {students.map((student) => {
            const memberships = student.student_classes as unknown as {
              left_at: string | null;
              classes: { name: string; is_archived: boolean } | null;
            }[];
            const classNames = memberships
              .filter((item) => !item.left_at && item.classes && !item.classes.is_archived)
              .map((item) => item.classes!.name);
            return (
              <Link
                key={student.id}
                href={`/teacher/students/${student.id}`}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 hover:bg-sky/40"
              >
                <span>
                  <span className="font-medium">{student.display_name}</span>
                  <span className="ml-2 text-sm text-muted">{student.username}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {classNames.map((name) => (
                    <Badge key={name}>{name}</Badge>
                  ))}
                  {!student.is_active ? <Badge tone="muted">已停用</Badge> : null}
                </span>
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
