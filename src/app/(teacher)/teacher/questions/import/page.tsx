import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { requireTeacher } from "@/features/auth/session";
import { loadContentTree } from "@/features/question-bank/data";
import { contentTypeLabel } from "@/features/question-bank/content-types";
import { createClient } from "@/lib/supabase/server";
import { QuestionImportForm } from "./import-form";

export const metadata: Metadata = { title: "批次匯入題目" };

const STATUS: Record<string, string> = { previewed: "待確認", imported: "已匯入", cancelled: "已取消" };

export default async function QuestionImportPage() {
  await requireTeacher();
  const { stages, textbooks } = await loadContentTree();
  const supabase = await createClient();
  const { data: batches } = await supabase
    .from("import_batches")
    .select("id, file_name, content_type, status, success_rows, error_rows, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/teacher/questions" className="text-sm text-navy underline underline-offset-4">
          題庫
        </Link>
        <h1 className="mt-1 text-3xl">批次匯入題目</h1>
      </div>
      <Card>
        <QuestionImportForm stages={stages} textbooks={textbooks} />
      </Card>
      {batches && batches.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xl">最近匯入</h2>
          <Card className="divide-y divide-line p-0">
            {batches.map((batch) => (
              <Link
                key={batch.id}
                href={`/teacher/questions/import/${batch.id}`}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-sky/40"
              >
                <span className="min-w-0 break-all font-medium">{batch.file_name}</span>
                <span className="text-sm text-muted">
                  {contentTypeLabel(batch.content_type)}・{batch.success_rows} 題・
                  {STATUS[batch.status]}
                </span>
              </Link>
            ))}
          </Card>
        </section>
      ) : null}
    </div>
  );
}
