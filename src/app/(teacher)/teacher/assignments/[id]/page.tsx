import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Stars } from "@/components/adventure/stars";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteAssignment, setAssignmentActive } from "@/features/assignments/actions";
import { loadAssignments, loadProgress } from "@/features/assignments/data";
import { requireTeacher } from "@/features/auth/session";
import { formatDue } from "@/features/missions/rules";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "../status-badge";
import { AssignmentEditor } from "./assignment-editor";

export const metadata: Metadata = { title: "任務完成情況" };

const ERRORS: Record<string, string> = {
  status: "狀態更新失敗，請稍後再試。",
  delete: "刪除失敗，請稍後再試。",
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> };

export default async function AssignmentPage({ params, searchParams }: Props) {
  await requireTeacher();
  const { id } = await params;
  const { error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [assignment] = await loadAssignments(supabase, { id });
  if (!assignment) notFound();
  const list = (await loadProgress(supabase, [assignment])).get(id) ?? [];
  const done = list.filter((item) => item.status === "done").length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/teacher/assignments" className="text-sm text-navy underline underline-offset-4">
          任務指派
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">{assignment.levelTitle}</h1>
          {!assignment.is_active ? <Badge tone="muted">已停用</Badge> : null}
        </div>
        <p className="text-muted">
          {assignment.textbookTitle}・{assignment.zoneName}・指派給 {assignment.targetName}
          {assignment.due_on ? `・期限 ${formatDue(assignment.due_on)}` : "・不限期限"}
        </p>
      </div>

      {error && ERRORS[error] ? <Notice>{ERRORS[error]}</Notice> : null}

      <Card>
        <h2 className="mb-3 text-xl">
          完成情況（{done} / {list.length}）
        </h2>
        {list.length === 0 ? (
          <EmptyState title="這個班級目前沒有學生" />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((student) => (
              <li key={student.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <Link href={`/teacher/students/${student.id}`} className="font-medium text-navy underline-offset-4 hover:underline">
                  {student.name}
                </Link>
                <span className="flex items-center gap-3">
                  {student.best !== null ? <Stars count={student.best} size={18} /> : <span className="text-sm text-muted">尚未作答</span>}
                  <StatusBadge status={student.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-muted">只計算指派之後的作答；拿到 2 顆星就算完成。</p>
      </Card>

      <Card>
        <h2 className="mb-4 text-xl">修改期限與說明</h2>
        <AssignmentEditor id={id} dueOn={assignment.due_on} note={assignment.note} />
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl">{assignment.is_active ? "停用任務" : "重新啟用"}</h2>
        <p className="text-sm text-muted">
          {assignment.is_active ? "停用後學生首頁不再顯示這個任務，紀錄會保留。" : "重新啟用後學生首頁會再次顯示。"}
        </p>
        <form action={setAssignmentActive.bind(null, id, !assignment.is_active)}>
          <SubmitButton variant="secondary" pendingText="處理中…">
            {assignment.is_active ? "停用任務" : "重新啟用"}
          </SubmitButton>
        </form>
        <div className="border-t border-line pt-3">
          <ConfirmDelete
            variant="button"
            action={deleteAssignment.bind(null, id)}
            label="刪除任務"
            warning="只刪除指派，學生的作答紀錄與星星不受影響。"
          />
        </div>
      </Card>
    </div>
  );
}
