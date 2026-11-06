import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { requireTeacher } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "教材管理" };

export default async function TextbooksPage() {
  await requireTeacher();
  const supabase = await createClient();
  const [{ data: stages }, { data: textbooks, error }] = await Promise.all([
    supabase.from("learning_stages").select("id, name").order("order_index"),
    supabase
      .from("textbooks")
      .select("id, title, publisher, grade, is_active, stage_id, units(count), questions(count)")
      .is("questions.deleted_at", null)
      .order("order_index")
      .order("title"),
  ]);
  if (error) throw new Error(error.message);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">教材管理</h1>
        <Link href="/teacher/textbooks/new" className={buttonClass()}>
          <Plus size={18} aria-hidden />
          新增教材
        </Link>
      </div>

      {stages?.map((stage) => {
        const books = textbooks?.filter((book) => book.stage_id === stage.id) ?? [];
        return (
          <section key={stage.id} aria-label={stage.name} className="space-y-3">
            <h2 className="text-xl">{stage.name}</h2>
            {books.length === 0 ? (
              <EmptyState title="這個階段還沒有教材" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {books.map((book) => (
                  <Link key={book.id} href={`/teacher/textbooks/${book.id}`}>
                    <Card className="h-full transition-colors hover:border-navy/40">
                      <h3 className="text-lg">{book.title}</h3>
                      {book.publisher || book.grade ? (
                        <p className="text-sm text-muted">
                          {[book.publisher, book.grade].filter(Boolean).join("・")}
                        </p>
                      ) : null}
                      <p className="mt-2 text-sm text-muted">
                        {(book.units as unknown as { count: number }[])[0]?.count ?? 0} 個單元・
                        {(book.questions as unknown as { count: number }[])[0]?.count ?? 0} 題
                      </p>
                      {!book.is_active ? (
                        <div className="mt-2">
                          <Badge tone="muted">已停用</Badge>
                        </div>
                      ) : null}
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
