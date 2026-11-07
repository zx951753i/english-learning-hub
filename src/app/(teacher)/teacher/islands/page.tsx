import { ArrowDown, ArrowUp, Wand2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ZoneIcon } from "@/components/adventure/zone-icon";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { createZonesFromTemplate, moveZone } from "@/features/adventure/admin-actions";
import { ZONE_TEMPLATES } from "@/features/adventure/rules";
import { requireTeacher } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ZoneForm } from "./zone-form";

export const metadata: Metadata = { title: "闖關島管理" };

type Props = { searchParams: Promise<{ stage?: string; book?: string; error?: string }> };

export default async function IslandsPage({ searchParams }: Props) {
  await requireTeacher();
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: stages }, { data: books }] = await Promise.all([
    supabase.from("learning_stages").select("id, slug, island_name").order("order_index"),
    supabase.from("textbooks").select("id, title, stage_id").order("order_index").order("title"),
  ]);
  const requestedBook = books?.find((book) => book.id === params.book);
  const stage =
    stages?.find((item) => item.id === requestedBook?.stage_id) ??
    stages?.find((item) => item.slug === params.stage) ??
    stages?.[0];
  const stageBooks = books?.filter((book) => book.stage_id === stage?.id) ?? [];
  const book = requestedBook ?? stageBooks[0];

  const { data: zones } = book
    ? await supabase
        .from("island_zones")
        .select("id, name, theme_key, is_open, game_levels(id, is_published)")
        .eq("textbook_id", book.id)
        .order("order_index")
    : { data: [] };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">闖關島管理</h1>
      {params.error ? <Notice>操作失敗，請稍後再試。</Notice> : null}

      <nav aria-label="闖關島" className="flex flex-wrap gap-2">
        {stages?.map((item) => (
          <Link
            key={item.id}
            href={`/teacher/islands?stage=${item.slug}`}
            aria-current={item.id === stage?.id ? "page" : undefined}
            className={`min-h-11 rounded-full px-4 py-2.5 font-medium ${
              item.id === stage?.id ? "bg-navy text-cream" : "border border-line bg-paper text-navy hover:bg-sky"
            }`}
          >
            {item.island_name}
          </Link>
        ))}
      </nav>

      {stageBooks.length === 0 ? (
        <EmptyState title="這座島還沒有教材">
          先到 <Link href="/teacher/textbooks/new" className="text-navy underline">教材</Link> 新增教材。
        </EmptyState>
      ) : (
        <>
          <nav aria-label="教材" className="flex flex-wrap gap-2">
            {stageBooks.map((item) => (
              <Link
                key={item.id}
                href={`/teacher/islands?book=${item.id}`}
                aria-current={item.id === book?.id ? "page" : undefined}
                className={`min-h-11 rounded-control px-3 py-2.5 text-sm font-medium ${
                  item.id === book?.id ? "bg-sky text-navy" : "border border-line bg-paper text-ink hover:bg-sky/50"
                }`}
              >
                {item.title}
              </Link>
            ))}
          </nav>

          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl">學習區域（{zones?.length ?? 0}）</h2>
              {stage && ZONE_TEMPLATES[stage.slug] && book ? (
                <form action={createZonesFromTemplate.bind(null, book.id)}>
                  <SubmitButton variant="secondary" pendingText="建立中…">
                    <Wand2 size={18} aria-hidden />
                    用範本建立區域
                  </SubmitButton>
                </form>
              ) : null}
            </div>
            {!zones || zones.length === 0 ? (
              <EmptyState title="還沒有學習區域">
                範本會建立 {stage ? ZONE_TEMPLATES[stage.slug]?.map((zone) => zone.name).join("、") : ""}。
              </EmptyState>
            ) : (
              <ol className="divide-y divide-line">
                {zones.map((zone, index) => {
                  const levels = zone.game_levels as { id: string; is_published: boolean }[];
                  const published = levels.filter((level) => level.is_published).length;
                  return (
                    <li key={zone.id} className="flex items-center justify-between gap-2 py-1.5">
                      <Link href={`/teacher/islands/zones/${zone.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-1">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky text-navy">
                          <ZoneIcon theme={zone.theme_key} />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium">{zone.name}</span>
                          <span className="block text-sm text-muted">
                            {levels.length} 關，已發布 {published} 關
                          </span>
                        </span>
                        {!zone.is_open ? <Badge tone="muted">已關閉</Badge> : null}
                      </Link>
                      <span className="flex shrink-0">
                        <form action={moveZone.bind(null, book!.id, zone.id, -1)}>
                          <SubmitButton variant="ghost" pendingText="…" disabled={index === 0} aria-label={`將 ${zone.name} 上移`} className="px-2.5">
                            <ArrowUp size={18} aria-hidden />
                          </SubmitButton>
                        </form>
                        <form action={moveZone.bind(null, book!.id, zone.id, 1)}>
                          <SubmitButton variant="ghost" pendingText="…" disabled={index === zones.length - 1} aria-label={`將 ${zone.name} 下移`} className="px-2.5">
                            <ArrowDown size={18} aria-hidden />
                          </SubmitButton>
                        </form>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          {book ? (
            <Card>
              <h2 className="mb-4 text-xl">新增區域</h2>
              <ZoneForm textbookId={book.id} />
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
