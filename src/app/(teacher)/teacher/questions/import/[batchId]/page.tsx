import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { SelectField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireTeacher } from "@/features/auth/session";
import { cancelImport, confirmImport } from "@/features/question-bank/actions";
import { contentTypeLabel, SOURCE_TYPES } from "@/features/question-bank/content-types";
import type { ImportError, ImportRow } from "@/features/question-bank/import";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "匯入預覽" };

const ERRORS: Record<string, string> = {
  source: "請選擇題目來源。",
  insert: "匯入失敗，沒有建立任何題目，請再試一次。",
};
const PREVIEW_LIMIT = 100;

type Props = {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function ImportPreviewPage({ params, searchParams }: Props) {
  await requireTeacher();
  const { batchId } = await params;
  const { error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) notFound();

  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("import_batches")
    .select("id, file_name, content_type, status, success_rows, error_rows, errors, rows, textbooks(title)")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) notFound();

  const rows = batch.rows as ImportRow[];
  const errors = batch.errors as ImportError[];
  const book = batch.textbooks as unknown as { title: string } | null;
  const pending = batch.status === "previewed";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/teacher/questions/import" className="text-sm text-navy underline underline-offset-4">
          批次匯入
        </Link>
        <h1 className="mt-1 text-3xl">匯入預覽</h1>
        <p className="mt-1 break-all text-muted">
          {batch.file_name}・{book?.title}・{contentTypeLabel(batch.content_type)}
        </p>
      </div>

      {error && ERRORS[error] ? <Notice>{ERRORS[error]}</Notice> : null}
      {!pending ? (
        <Notice tone="ok">
          {batch.status === "imported" ? "這批題目已匯入。" : "這次匯入已取消。"}
        </Notice>
      ) : null}

      <Card>
        <p className="font-medium text-navy">
          可匯入 {batch.success_rows} 題，有問題 {batch.error_rows} 列
        </p>
        {batch.error_rows > 0 ? (
          <p className="mt-1 text-sm text-muted">有問題的列不會匯入。可先取消、修正檔案後重新上傳。</p>
        ) : null}
      </Card>

      {errors.length > 0 ? (
        <section role="alert" className="rounded-card bg-danger-soft p-4 text-sm text-danger">
          <h2 className="mb-2 text-lg text-danger">需要修正的列</h2>
          <ul className="list-inside list-disc space-y-1">
            {errors.map((item, index) => (
              <li key={index}>
                第 {item.line} 列：{item.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rows.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xl">題目預覽</h2>
          <Card className="divide-y divide-line p-0">
            {rows.slice(0, PREVIEW_LIMIT).map((row) => (
              <p key={row.line} className="break-words px-5 py-2.5">
                <span className="mr-2 text-sm text-muted">第 {row.line} 列</span>
                {row.summary}
              </p>
            ))}
          </Card>
          {rows.length > PREVIEW_LIMIT ? (
            <p className="mt-2 text-sm text-muted">只顯示前 {PREVIEW_LIMIT} 題。</p>
          ) : null}
        </section>
      ) : null}

      {pending ? (
        <Card>
          <form action={confirmImport.bind(null, batchId)} className="space-y-4">
            {rows.length > 0 ? (
              <>
                <SelectField label="題目來源" name="sourceType" required defaultValue="">
                  <option value="" disabled>
                    請選擇
                  </option>
                  {SOURCE_TYPES.map((source) => (
                    <option key={source.key} value={source.key}>
                      {source.label}
                    </option>
                  ))}
                </SelectField>
                <label className="flex min-h-11 items-center gap-3 rounded-control bg-sky/50 px-3">
                  <input type="checkbox" name="confirmed" className="size-5 accent-[var(--navy)]" />
                  <span>我已確認這批題目與答案，匯入後直接開放使用</span>
                </label>
                <SubmitButton pendingText="匯入中…">確認匯入 {rows.length} 題</SubmitButton>
              </>
            ) : null}
          </form>
          <form action={cancelImport.bind(null, batchId)} className="mt-2">
            <SubmitButton variant="ghost" pendingText="取消中…">
              取消這次匯入
            </SubmitButton>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
