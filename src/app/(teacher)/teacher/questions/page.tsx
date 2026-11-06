import { Plus, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { SelectField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { requireTeacher } from "@/features/auth/session";
import { applyBulkAction } from "@/features/question-bank/actions";
import { CONTENT_TYPES, contentTypeLabel } from "@/features/question-bank/content-types";
import { loadContentTree } from "@/features/question-bank/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "題庫管理" };

const PAGE_SIZE = 50;

type Params = {
  textbook?: string;
  unit?: string;
  type?: string;
  difficulty?: string;
  status?: string;
  q?: string;
  page?: string;
  saved?: string;
  imported?: string;
  error?: string;
};

const uuid = (value?: string) => (value && /^[0-9a-f-]{36}$/i.test(value) ? value : "");

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireTeacher();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const textbookId = uuid(params.textbook);
  const unitId = uuid(params.unit);
  const q = (params.q ?? "").trim().slice(0, 100);

  const { stages, textbooks } = await loadContentTree();
  const supabase = await createClient();

  let query = supabase
    .from("questions")
    .select(
      "id, content_type, difficulty, search_text, review_status, is_active, stage_id, textbooks(title), units(title)",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (textbookId) query = query.eq("textbook_id", textbookId);
  if (unitId) query = query.eq("unit_id", unitId);
  if (CONTENT_TYPES.some((type) => type.key === params.type)) query = query.eq("content_type", params.type!);
  if (["1", "2", "3", "4"].includes(params.difficulty ?? "")) query = query.eq("difficulty", Number(params.difficulty));
  if (params.status === "draft") query = query.eq("review_status", "draft");
  if (params.status === "active") query = query.eq("is_active", true);
  if (params.status === "disabled") query = query.eq("review_status", "confirmed").eq("is_active", false);
  if (q) query = query.ilike("search_text", `%${q.replace(/[\\%_]/g, "\\$&")}%`);

  const { data: questions, count, error } = await query;
  if (error) throw new Error(error.message);

  const book = textbooks.find((item) => item.id === textbookId);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filters = new URLSearchParams();
  for (const key of ["textbook", "unit", "type", "difficulty", "status", "q"] as const) {
    if (params[key]) filters.set(key, params[key]!);
  }
  const pageHref = (target: number) => {
    const next = new URLSearchParams(filters);
    next.set("page", String(target));
    return `/teacher/questions?${next}`;
  };
  const back = `/teacher/questions?${new URLSearchParams({ ...Object.fromEntries(filters), page: String(page) })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">題庫管理</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/teacher/questions/import" className={buttonClass("secondary")}>
            <Upload size={18} aria-hidden />
            批次匯入
          </Link>
          <Link href="/teacher/questions/new" className={buttonClass()}>
            <Plus size={18} aria-hidden />
            新增題目
          </Link>
        </div>
      </div>

      {params.saved ? <Notice tone="ok">題目已儲存。</Notice> : null}
      {params.imported ? <Notice tone="ok">已匯入 {params.imported} 題。</Notice> : null}
      {params.error ? <Notice>批次操作失敗，請稍後再試。</Notice> : null}

      <Card>
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField label="教材" name="textbook" defaultValue={textbookId}>
            <option value="">全部教材</option>
            {stages.map((stage) => (
              <optgroup key={stage.id} label={stage.name}>
                {textbooks
                  .filter((item) => item.stage_id === stage.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
              </optgroup>
            ))}
          </SelectField>
          <SelectField label="單元" name="unit" defaultValue={unitId} hint={book ? undefined : "先選教材並按篩選"}>
            <option value="">全部單元</option>
            {book?.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.title}
              </option>
            ))}
          </SelectField>
          <SelectField label="題目類型" name="type" defaultValue={params.type ?? ""}>
            <option value="">全部類型</option>
            {CONTENT_TYPES.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="難度" name="difficulty" defaultValue={params.difficulty ?? ""}>
            <option value="">全部難度</option>
            {[1, 2, 3, 4].map((level) => (
              <option key={level} value={level}>
                難度 {level}
              </option>
            ))}
          </SelectField>
          <SelectField label="狀態" name="status" defaultValue={params.status ?? ""}>
            <option value="">全部狀態</option>
            <option value="draft">待確認</option>
            <option value="active">啟用中</option>
            <option value="disabled">已停用</option>
          </SelectField>
          <TextField label="搜尋題目" name="q" defaultValue={q} autoComplete="off" />
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <Button type="submit" variant="secondary">
              篩選
            </Button>
            <Link href="/teacher/questions" className={buttonClass("ghost")}>
              清除
            </Link>
          </div>
        </form>
      </Card>

      <p className="text-sm text-muted">共 {total} 題</p>

      {!questions || questions.length === 0 ? (
        <EmptyState title="沒有符合的題目">新增題目，或下載範本批次匯入。</EmptyState>
      ) : (
        <form action={applyBulkAction} className="space-y-3">
          <input type="hidden" name="back" value={back} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="bulk" value="confirm" variant="secondary">
              確認並啟用
            </Button>
            <Button type="submit" name="bulk" value="enable" variant="secondary">
              啟用
            </Button>
            <Button type="submit" name="bulk" value="disable" variant="secondary">
              停用
            </Button>
            <Button type="submit" name="bulk" value="archive" variant="danger">
              刪除
            </Button>
          </div>
          <Card className="divide-y divide-line p-0">
            {questions.map((question) => {
              const bookInfo = question.textbooks as unknown as { title: string } | null;
              const unitInfo = question.units as unknown as { title: string } | null;
              const stage = stages.find((item) => item.id === question.stage_id);
              return (
                <div key={question.id} className="flex items-start gap-3 px-4 py-3 hover:bg-sky/30">
                  <input
                    type="checkbox"
                    name="questionId"
                    value={question.id}
                    aria-label={`選取 ${question.search_text}`}
                    className="mt-1 size-5 shrink-0 accent-[var(--navy)]"
                  />
                  <Link href={`/teacher/questions/${question.id}`} className="min-w-0 flex-1">
                    <span className="block break-words font-medium">{question.search_text}</span>
                    <span className="block text-sm text-muted">
                      {bookInfo?.title}・{unitInfo?.title}・
                      {stage?.difficulty_labels[question.difficulty - 1]}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <Badge>{contentTypeLabel(question.content_type)}</Badge>
                      {question.review_status === "draft" ? (
                        <Badge tone="muted">待確認</Badge>
                      ) : question.is_active ? (
                        <Badge tone="ok">啟用中</Badge>
                      ) : (
                        <Badge tone="muted">已停用</Badge>
                      )}
                    </span>
                  </Link>
                </div>
              );
            })}
          </Card>
        </form>
      )}

      {pages > 1 ? (
        <nav aria-label="分頁" className="flex items-center justify-between gap-3">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={buttonClass("secondary")}>
              上一頁
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted">
            第 {page} / {pages} 頁
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className={buttonClass("secondary")}>
              下一頁
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
