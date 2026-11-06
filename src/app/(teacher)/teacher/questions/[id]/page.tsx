import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireTeacher } from "@/features/auth/session";
import { archiveQuestion } from "@/features/question-bank/actions";
import { getContentType, type ContentTypeKey } from "@/features/question-bank/content-types";
import { loadContentTree } from "@/features/question-bank/data";
import { createClient } from "@/lib/supabase/server";
import { QuestionForm } from "../question-form";

export const metadata: Metadata = { title: "編輯題目" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> };

export default async function EditQuestionPage({ params, searchParams }: Props) {
  await requireTeacher();
  const { id } = await params;
  const { error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: question } = await supabase
    .from("questions")
    .select(
      "id, textbook_id, unit_id, topic_id, passage_id, content_type, difficulty, exam_band, content, answer_key, explanation_zh, source_type, source_note, review_status",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!question) notFound();

  const type = getContentType(question.content_type);
  if (!type) notFound();
  const { stages, textbooks } = await loadContentTree();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/teacher/questions" className="text-sm text-navy underline underline-offset-4">
          題庫
        </Link>
        <h1 className="mt-1 text-3xl">編輯題目</h1>
      </div>
      {error ? <Notice>操作失敗，請稍後再試。</Notice> : null}
      <Card>
        <QuestionForm
          stages={stages}
          textbooks={textbooks}
          initial={{
            id,
            textbookId: question.textbook_id,
            unitId: question.unit_id,
            topicId: question.topic_id,
            passageId: question.passage_id,
            contentType: question.content_type as ContentTypeKey,
            difficulty: question.difficulty,
            examBand: question.exam_band,
            explanation: question.explanation_zh,
            sourceType: question.source_type,
            sourceNote: question.source_note,
            confirmed: question.review_status === "confirmed",
            fields: type.flatten(question.content, question.answer_key),
          }}
        />
      </Card>
      <Card>
        <h2 className="mb-1 text-xl">刪除題目</h2>
        <p className="mb-3 text-sm text-muted">題目會從題庫移除；已有的學生作答紀錄仍會保留。</p>
        <form action={archiveQuestion.bind(null, id)}>
          <SubmitButton variant="danger" pendingText="刪除中…">
            刪除題目
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
