import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { loadAssignments, loadProgress } from "@/features/assignments/data";
import { requireTeacher } from "@/features/auth/session";
import { formatDue } from "@/features/missions/rules";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "任務指派" };

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  await requireTeacher();
  const { created } = await searchParams;
  const supabase = await createClient();
  const assignments = await loadAssignments(supabase);
  const progress = await loadProgress(supabase, assignments);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl">任務指派</h1>
          <p className="text-muted">把關卡指派給班級或學生；學生拿到 2 顆星就算完成。</p>
        </div>
        <Link href="/teacher/assignments/new" className={buttonClass()}>
          <Plus size={18} aria-hidden />
          新增任務
        </Link>
      </div>

      {created ? <Notice tone="ok">任務已建立，學生首頁會出現「老師指派的任務」。</Notice> : null}

      {assignments.length === 0 ? (
        <EmptyState title="還沒有任務">按「新增任務」選擇關卡與對象。</EmptyState>
      ) : (
        <Card className="divide-y divide-line p-0">
          {assignments.map((assignment) => {
            const list = progress.get(assignment.id) ?? [];
            const done = list.filter((item) => item.status === "done").length;
            const overdue = list.filter((item) => item.status === "overdue").length;
            return (
              <Link
                key={assignment.id}
                href={`/teacher/assignments/${assignment.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-sky/40"
              >
                <span className="min-w-0">
                  <span className="block font-medium">
                    {assignment.levelTitle}
                    <span className="text-muted">・{assignment.targetName}</span>
                  </span>
                  <span className="block text-sm text-muted">
                    {assignment.textbookTitle}・{assignment.zoneName}
                    {assignment.due_on ? `・期限 ${formatDue(assignment.due_on)}` : "・不限期限"}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {!assignment.is_active ? <Badge tone="muted">已停用</Badge> : null}
                  {overdue > 0 ? (
                    <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-sm text-danger">逾期 {overdue}</span>
                  ) : null}
                  <Badge tone={list.length > 0 && done === list.length ? "ok" : "navy"}>
                    完成 {done} / {list.length}
                  </Badge>
                </span>
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
