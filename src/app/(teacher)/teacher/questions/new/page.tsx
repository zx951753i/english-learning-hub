import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { requireTeacher } from "@/features/auth/session";
import { getContentType, type ContentTypeKey } from "@/features/question-bank/content-types";
import { loadContentTree, loadMediaNames } from "@/features/question-bank/data";
import { QuestionForm } from "../question-form";

export const metadata: Metadata = { title: "新增題目" };

type Props = {
  searchParams: Promise<{
    textbook?: string;
    unit?: string;
    type?: string;
    difficulty?: string;
    source?: string;
    saved?: string;
  }>;
};

export default async function NewQuestionPage({ searchParams }: Props) {
  await requireTeacher();
  const params = await searchParams;
  const { stages, textbooks } = await loadContentTree();
  const mediaNames = await loadMediaNames();

  const book = textbooks.find((item) => item.id === params.textbook);
  const unit = book?.units.find((item) => item.id === params.unit);
  const type = getContentType(params.type ?? "") ?? getContentType("vocab_item")!;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl">新增題目</h1>
      {params.saved ? <Notice tone="ok">已儲存，可繼續新增下一題。</Notice> : null}
      <Card>
        <QuestionForm
          key={params.saved ?? "new"}
          stages={stages}
          textbooks={textbooks}
          mediaNames={mediaNames}
          initial={{
            textbookId: book?.id ?? "",
            unitId: unit?.id ?? "",
            contentType: type.key as ContentTypeKey,
            difficulty: Number(params.difficulty) || undefined,
            sourceType: params.source,
          }}
        />
      </Card>
    </div>
  );
}
