import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { toggleStudentActive } from "@/features/accounts/actions";
import { requireTeacher } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ResetPassword, StudentEditor } from "./student-editor";

export const metadata: Metadata = { title: "學生資料" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function StudentDetailPage({ params, searchParams }: Props) {
  await requireTeacher();
  const { id } = await params;
  const { error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("profiles")
    .select("id, display_name, username, is_active, created_at")
    .eq("id", id)
    .eq("role", "student")
    .maybeSingle();
  if (!student) notFound();

  const { data: memberships } = await supabase
    .from("student_classes")
    .select("class_id, classes(name, is_archived)")
    .eq("student_id", id)
    .is("left_at", null);

  const classes = (memberships ?? []) as unknown as {
    class_id: string;
    classes: { name: string; is_archived: boolean };
  }[];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/teacher/students" className="text-sm text-navy underline underline-offset-4">
          學生列表
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">{student.display_name}</h1>
          {!student.is_active ? <Badge tone="muted">已停用</Badge> : null}
        </div>
      </div>

      {error === "status" ? <Notice>狀態更新失敗，請稍後再試。</Notice> : null}

      <Card>
        <h2 className="mb-4 text-xl">基本資料</h2>
        <StudentEditor student={student} />
      </Card>

      <Card>
        <h2 className="mb-3 text-xl">所屬班級</h2>
        {classes.length === 0 ? (
          <EmptyState title="尚未加入班級">到班級頁面即可把學生加入。</EmptyState>
        ) : (
          <div className="flex flex-wrap gap-2">
            {classes.map((item) => (
              <Link key={item.class_id} href={`/teacher/classes/${item.class_id}`}>
                <Badge tone={item.classes.is_archived ? "muted" : "navy"}>{item.classes.name}</Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-xl">重設密碼</h2>
        <p className="mb-3 text-sm text-muted">舊密碼會立即失效，新密碼只顯示一次。</p>
        <ResetPassword student={student} />
      </Card>

      <Card>
        <h2 className="mb-1 text-xl">{student.is_active ? "停用帳號" : "恢復帳號"}</h2>
        <p className="mb-3 text-sm text-muted">
          {student.is_active
            ? "停用後學生無法登入，學習紀錄會保留。"
            : "恢復後學生可用原本的帳號密碼登入。"}
        </p>
        <form action={toggleStudentActive.bind(null, student.id, !student.is_active)}>
          <SubmitButton variant={student.is_active ? "danger" : "secondary"} pendingText="處理中…">
            {student.is_active ? "停用帳號" : "恢復帳號"}
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
