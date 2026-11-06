import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireTeacher } from "@/features/auth/session";
import { skillLabel } from "@/features/question-bank/content-types";
import {
  deletePassage,
  deleteTopic,
  deleteUnit,
  setUnitActive,
} from "@/features/textbooks/actions";
import { createClient } from "@/lib/supabase/server";
import { PassageForm, TopicForm, UnitTitleForm } from "./unit-editors";

export const metadata: Metadata = { title: "單元資料" };

const ERRORS: Record<string, string> = {
  delete: "這個單元還有主題、文章或題目，無法刪除；可以改為停用。",
  topic: "這個主題還有題目，無法刪除。",
  passage: "這篇文章還有題目連結，無法刪除。",
  status: "狀態更新失敗，請稍後再試。",
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> };

export default async function UnitDetailPage({ params, searchParams }: Props) {
  await requireTeacher();
  const { id } = await params;
  const { error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("units")
    .select("id, title, is_active, textbook_id, textbooks(title)")
    .eq("id", id)
    .maybeSingle();
  if (!unit) notFound();

  const [{ data: topics }, { data: passages }, { count: questionCount }] = await Promise.all([
    supabase
      .from("learning_topics")
      .select("id, title, skill, concept_tags")
      .eq("unit_id", id)
      .order("order_index")
      .order("created_at"),
    supabase
      .from("passages")
      .select("id, title, body, source_type, source_note")
      .eq("unit_id", id)
      .order("created_at"),
    supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("unit_id", id)
      .is("deleted_at", null),
  ]);

  const book = unit.textbooks as unknown as { title: string } | null;
  const empty = !topics?.length && !passages?.length && !questionCount;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/teacher/textbooks/${unit.textbook_id}`}
          className="text-sm text-navy underline underline-offset-4"
        >
          {book?.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">{unit.title}</h1>
          {!unit.is_active ? <Badge tone="muted">已停用</Badge> : null}
        </div>
        <Link
          href={`/teacher/questions?textbook=${unit.textbook_id}&unit=${id}`}
          className="mt-1 inline-block text-sm text-navy underline underline-offset-4"
        >
          查看此單元的 {questionCount ?? 0} 題
        </Link>
      </div>

      {error && ERRORS[error] ? <Notice>{ERRORS[error]}</Notice> : null}

      <Card>
        <h2 className="mb-3 text-xl">主題（{topics?.length ?? 0}）</h2>
        {!topics || topics.length === 0 ? (
          <EmptyState title="還沒有主題">主題可用來分類題目，例如 Past Simple。</EmptyState>
        ) : (
          <div className="space-y-2">
            {topics.map((topic) => (
              <details key={topic.id} className="rounded-control border border-line px-3 py-2">
                <summary className="cursor-pointer font-medium">
                  {topic.title}
                  <span className="ml-2 text-sm font-normal text-muted">
                    {skillLabel(topic.skill)}
                  </span>
                </summary>
                <div className="space-y-3 pt-3">
                  <TopicForm unitId={id} topic={topic} />
                  <form action={deleteTopic.bind(null, id, topic.id)}>
                    <SubmitButton variant="ghost" pendingText="刪除中…">
                      刪除主題
                    </SubmitButton>
                  </form>
                </div>
              </details>
            ))}
          </div>
        )}
        <div className="mt-4 border-t border-line pt-4">
          <TopicForm unitId={id} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-xl">閱讀文章（{passages?.length ?? 0}）</h2>
        {passages && passages.length > 0 ? (
          <div className="mb-4 space-y-2">
            {passages.map((passage) => (
              <details key={passage.id} className="rounded-control border border-line px-3 py-2">
                <summary className="cursor-pointer font-medium">{passage.title}</summary>
                <div className="space-y-3 pt-3">
                  <PassageForm unitId={id} passage={passage} />
                  <form action={deletePassage.bind(null, id, passage.id)}>
                    <SubmitButton variant="ghost" pendingText="刪除中…">
                      刪除文章
                    </SubmitButton>
                  </form>
                </div>
              </details>
            ))}
          </div>
        ) : null}
        <PassageForm unitId={id} />
      </Card>

      <Card>
        <h2 className="mb-4 text-xl">單元資料</h2>
        <UnitTitleForm id={id} title={unit.title} />
      </Card>

      <Card className="space-y-3">
        <div>
          <h2 className="mb-1 text-xl">{unit.is_active ? "停用單元" : "恢復單元"}</h2>
          <p className="text-sm text-muted">停用後學生看不到這個單元，資料會保留。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={setUnitActive.bind(null, id, !unit.is_active)}>
            <SubmitButton variant={unit.is_active ? "danger" : "secondary"}>
              {unit.is_active ? "停用單元" : "恢復單元"}
            </SubmitButton>
          </form>
          {empty ? (
            <form action={deleteUnit.bind(null, id, unit.textbook_id)}>
              <SubmitButton variant="danger" pendingText="刪除中…">
                刪除單元
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
