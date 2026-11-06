import { ArrowDown, ArrowUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireTeacher } from "@/features/auth/session";
import { deleteTextbook, moveUnit, setTextbookActive } from "@/features/textbooks/actions";
import { createClient } from "@/lib/supabase/server";
import { AddUnitForm, TextbookEditor } from "./textbook-editors";

export const metadata: Metadata = { title: "教材資料" };

const ERRORS: Record<string, string> = {
  units: "教材已建立，但單元建立失敗，請手動新增。",
  delete: "這本教材還有單元、題目或班級授權，無法刪除；可以改為停用。",
  move: "順序調整失敗，請稍後再試。",
  status: "狀態更新失敗，請稍後再試。",
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> };

export default async function TextbookDetailPage({ params, searchParams }: Props) {
  await requireTeacher();
  const { id } = await params;
  const { error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: book } = await supabase
    .from("textbooks")
    .select("id, title, publisher, series, grade, kind, is_active, learning_stages(name)")
    .eq("id", id)
    .maybeSingle();
  if (!book) notFound();

  const { data: units } = await supabase
    .from("units")
    .select("id, title, order_index, is_active, learning_topics(count), questions(count)")
    .eq("textbook_id", id)
    .is("questions.deleted_at", null)
    .order("order_index");

  const stage = book.learning_stages as unknown as { name: string } | null;
  const count = (value: unknown) => (value as { count: number }[])[0]?.count ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/teacher/textbooks" className="text-sm text-navy underline underline-offset-4">
          教材列表
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">{book.title}</h1>
          <Badge>{stage?.name}</Badge>
          {!book.is_active ? <Badge tone="muted">已停用</Badge> : null}
        </div>
      </div>

      {error && ERRORS[error] ? <Notice>{ERRORS[error]}</Notice> : null}

      <Card>
        <h2 className="mb-3 text-xl">單元（{units?.length ?? 0}）</h2>
        {!units || units.length === 0 ? (
          <EmptyState title="還沒有單元" />
        ) : (
          <ol className="divide-y divide-line">
            {units.map((unit, index) => (
              <li key={unit.id} className="flex items-center justify-between gap-2 py-1.5">
                <Link href={`/teacher/units/${unit.id}`} className="min-w-0 flex-1 py-1">
                  <span className="font-medium">{unit.title}</span>
                  {!unit.is_active ? (
                    <span className="ml-2">
                      <Badge tone="muted">已停用</Badge>
                    </span>
                  ) : null}
                  <span className="block text-sm text-muted">
                    {count(unit.learning_topics)} 個主題・{count(unit.questions)} 題
                  </span>
                </Link>
                <span className="flex shrink-0">
                  <form action={moveUnit.bind(null, id, unit.id, -1)}>
                    <SubmitButton
                      variant="ghost"
                      pendingText="…"
                      disabled={index === 0}
                      aria-label={`將 ${unit.title} 上移`}
                      className="px-2.5"
                    >
                      <ArrowUp size={18} aria-hidden />
                    </SubmitButton>
                  </form>
                  <form action={moveUnit.bind(null, id, unit.id, 1)}>
                    <SubmitButton
                      variant="ghost"
                      pendingText="…"
                      disabled={index === units.length - 1}
                      aria-label={`將 ${unit.title} 下移`}
                      className="px-2.5"
                    >
                      <ArrowDown size={18} aria-hidden />
                    </SubmitButton>
                  </form>
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-4 border-t border-line pt-4">
          <AddUnitForm textbookId={id} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-xl">教材資料</h2>
        <TextbookEditor book={book} />
      </Card>

      <Card className="space-y-3">
        <div>
          <h2 className="mb-1 text-xl">{book.is_active ? "停用教材" : "恢復教材"}</h2>
          <p className="text-sm text-muted">停用後學生看不到這本教材，資料會保留。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={setTextbookActive.bind(null, id, !book.is_active)}>
            <SubmitButton variant={book.is_active ? "danger" : "secondary"}>
              {book.is_active ? "停用教材" : "恢復教材"}
            </SubmitButton>
          </form>
          {units?.length === 0 ? (
            <form action={deleteTextbook.bind(null, id)}>
              <SubmitButton variant="danger" pendingText="刪除中…">
                刪除教材
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
