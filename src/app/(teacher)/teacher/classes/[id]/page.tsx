import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireTeacher } from "@/features/auth/session";
import {
  addStudentsToClass,
  removeStudentFromClass,
  setClassArchived,
} from "@/features/classes/actions";
import { createClient } from "@/lib/supabase/server";
import { ClassEditor } from "./class-editor";

export const metadata: Metadata = { title: "班級資料" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function ClassDetailPage({ params, searchParams }: Props) {
  await requireTeacher();
  const { id } = await params;
  const { error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("classes")
    .select("id, name, description, is_archived, learning_stages(name)")
    .eq("id", id)
    .maybeSingle();
  if (!item) notFound();

  const [{ data: memberRows }, { data: students }] = await Promise.all([
    supabase
      .from("student_classes")
      .select("student_id, left_at, profiles(id, display_name, username, is_active)")
      .eq("class_id", id),
    supabase
      .from("profiles")
      .select("id, display_name, username")
      .eq("role", "student")
      .eq("is_active", true)
      .order("display_name"),
  ]);

  const rows = (memberRows ?? []) as unknown as {
    student_id: string;
    left_at: string | null;
    profiles: { id: string; display_name: string; username: string; is_active: boolean };
  }[];
  const members = rows
    .filter((row) => !row.left_at)
    .map((row) => row.profiles)
    .sort((a, b) => a.display_name.localeCompare(b.display_name, "zh-Hant"));
  const memberIds = new Set(members.map((member) => member.id));
  const available = (students ?? []).filter((student) => !memberIds.has(student.id));
  const stage = item.learning_stages as unknown as { name: string } | null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/teacher/classes" className="text-sm text-navy underline underline-offset-4">
          班級列表
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">{item.name}</h1>
          <Badge>{stage?.name}</Badge>
          {item.is_archived ? <Badge tone="muted">已封存</Badge> : null}
        </div>
      </div>

      {error ? <Notice>操作失敗，請稍後再試。</Notice> : null}

      <Card>
        <h2 className="mb-3 text-xl">班級成員（{members.length}）</h2>
        {members.length === 0 ? (
          <EmptyState title="這個班級還沒有學生" />
        ) : (
          <ul className="divide-y divide-line">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/teacher/students/${member.id}`} className="min-w-0">
                  <span className="font-medium">{member.display_name}</span>
                  <span className="ml-2 text-sm text-muted">{member.username}</span>
                  {!member.is_active ? (
                    <span className="ml-2">
                      <Badge tone="muted">已停用</Badge>
                    </span>
                  ) : null}
                </Link>
                <form action={removeStudentFromClass.bind(null, item.id, member.id)} className="shrink-0">
                  <SubmitButton variant="ghost" className="whitespace-nowrap" pendingText="移除中…" aria-label={`將 ${member.display_name} 移出班級`}>
                    移出
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!item.is_archived ? (
        <Card>
          <h2 className="mb-3 text-xl">加入學生</h2>
          {available.length === 0 ? (
            <p className="text-muted">
              沒有可加入的學生。
              <Link href="/teacher/students/new" className="ml-1 text-navy underline underline-offset-4">
                新增學生
              </Link>
            </p>
          ) : (
            <form action={addStudentsToClass.bind(null, item.id)} className="space-y-3">
              <fieldset className="max-h-72 space-y-1 overflow-y-auto">
                <legend className="sr-only">選擇要加入的學生</legend>
                {available.map((student) => (
                  <label
                    key={student.id}
                    className="flex min-h-11 items-center gap-3 rounded-control px-2 hover:bg-sky/40"
                  >
                    <input type="checkbox" name="studentId" value={student.id} className="size-5 accent-[var(--navy)]" />
                    <span className="font-medium">{student.display_name}</span>
                    <span className="text-sm text-muted">{student.username}</span>
                  </label>
                ))}
              </fieldset>
              <SubmitButton pendingText="加入中…">加入所選學生</SubmitButton>
            </form>
          )}
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-4 text-xl">班級資料</h2>
        <ClassEditor item={item} />
      </Card>

      <Card>
        <h2 className="mb-1 text-xl">{item.is_archived ? "恢復班級" : "封存班級"}</h2>
        <p className="mb-3 text-sm text-muted">
          {item.is_archived
            ? "恢復後，學生會重新看到這個班級。"
            : "封存後，學生不再看到這個班級，資料會保留。"}
        </p>
        <form action={setClassArchived.bind(null, item.id, !item.is_archived)}>
          <SubmitButton variant={item.is_archived ? "secondary" : "danger"}>
            {item.is_archived ? "恢復班級" : "封存班級"}
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
