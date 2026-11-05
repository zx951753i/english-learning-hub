import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { requireTeacher } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "班級管理" };

export default async function ClassesPage() {
  await requireTeacher();
  const supabase = await createClient();
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, is_archived, learning_stages(name), student_classes(left_at)")
    .order("is_archived")
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">班級管理</h1>
        <Link href="/teacher/classes/new" className={buttonClass()}>
          <Plus size={18} aria-hidden />
          新增班級
        </Link>
      </div>

      {!classes || classes.length === 0 ? (
        <EmptyState title="還沒有班級">建立第一個班級後，就能把學生加入。</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map((item) => {
            const stage = item.learning_stages as unknown as { name: string } | null;
            const count = item.student_classes.filter((member) => !member.left_at).length;
            return (
              <Link key={item.id} href={`/teacher/classes/${item.id}`}>
                <Card className="h-full transition-colors hover:border-navy/40">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <Badge>{stage?.name}</Badge>
                    {item.is_archived ? <Badge tone="muted">已封存</Badge> : null}
                  </div>
                  <h2 className="text-lg">{item.name}</h2>
                  <p className="text-sm text-muted">{count} 位學生</p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
