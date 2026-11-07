import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StarIcon } from "@/components/adventure/stars";
import { StudentHeader } from "@/components/adventure/student-header";
import { ZoneIcon } from "@/components/adventure/zone-icon";
import { EmptyState } from "@/components/ui/card";
import { computeLevelStates, type UnlockRule } from "@/features/adventure/rules";
import { requireStudent } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "闖關島" };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ book?: string }> };

export default async function IslandPage({ params, searchParams }: Props) {
  await requireStudent();
  const { slug } = await params;
  const { book: bookId } = await searchParams;
  const supabase = await createClient();

  const { data: stage } = await supabase
    .from("learning_stages")
    .select("id, slug, island_name, tagline")
    .eq("slug", slug)
    .maybeSingle();
  if (!stage) notFound();

  const { data: books } = await supabase
    .from("textbooks")
    .select("id, title")
    .eq("stage_id", stage.id)
    .order("order_index")
    .order("title");
  if (!books?.length) notFound();
  const book = books.find((item) => item.id === bookId) ?? books[0];

  const { data: zones } = await supabase
    .from("island_zones")
    .select("id, name, theme_key, description")
    .eq("textbook_id", book.id)
    .order("order_index");
  const zoneIds = (zones ?? []).map((zone) => zone.id);
  const [{ data: levels }, { data: progress }] = await Promise.all([
    zoneIds.length
      ? supabase.from("game_levels").select("id, zone_id, order_index, unlock_rule").in("zone_id", zoneIds).eq("is_published", true)
      : Promise.resolve({ data: [] as { id: string; zone_id: string; order_index: number; unlock_rule: string }[] }),
    supabase.from("student_progress").select("level_id, stars"),
  ]);
  const stars = new Map((progress ?? []).map((row) => [row.level_id as string, row.stars as number]));

  const items = (zones ?? []).map((zone) => {
    const zoneLevels = (levels ?? []).filter((level) => level.zone_id === zone.id) as {
      id: string; order_index: number; unlock_rule: UnlockRule;
    }[];
    const states = computeLevelStates(zoneLevels, stars);
    const done = states.filter((state) => state.status === "done").length;
    const starCount = states.reduce((sum, state) => sum + state.stars, 0);
    const status =
      zoneLevels.length === 0 ? "empty" : done === zoneLevels.length ? "done" : done > 0 ? "progress" : "new";
    return { ...zone, total: zoneLevels.length, done, starCount, status };
  });
  const highlight = items.find((item) => item.status === "progress") ?? items.find((item) => item.status === "new");

  return (
    <div data-stage="kids" className="min-h-dvh">
      <StudentHeader />
      <main className="mx-auto max-w-xl space-y-5 px-4 py-5">
        <Link href="/home" className="inline-flex min-h-11 items-center gap-1 font-bold text-navy">
          <ChevronLeft size={20} aria-hidden /> 冒險地圖
        </Link>
        <div>
          <h1 className="text-3xl">{stage.island_name}</h1>
          <p className="text-muted">{stage.tagline}</p>
        </div>

        {books.length > 1 ? (
          <nav aria-label="選擇教材" className="flex flex-wrap gap-2">
            {books.map((item) => (
              <Link
                key={item.id}
                href={`/island/${slug}?book=${item.id}`}
                aria-current={item.id === book.id ? "page" : undefined}
                className={`flex min-h-11 flex-1 items-center justify-center rounded-full px-4 text-[15px] font-bold ${
                  item.id === book.id ? "bg-navy text-paper" : "border-2 border-[#D5C9B3] bg-paper text-navy"
                }`}
              >
                {item.title}
              </Link>
            ))}
          </nav>
        ) : (
          <p className="font-bold text-navy">{book.title}</p>
        )}

        {items.length === 0 ? (
          <EmptyState title="這本教材的地圖還在準備中">老師完成後就能出發。</EmptyState>
        ) : (
          <ol className="relative space-y-4 rounded-[32px] bg-[#BFDDF0] px-4 py-6">
            <span aria-hidden className="absolute bottom-8 left-1/2 top-8 border-l-[6px] border-dotted border-paper/90" />
            {items.map((zone, index) => {
              const isNext = zone.id === highlight?.id;
              const style =
                zone.status === "done"
                  ? "border-[#052e4c] bg-navy text-paper shadow-[0_4px_0_#052e4c]"
                  : isNext
                    ? "border-terracotta bg-[#FFF1CC] text-[#5a2a18] shadow-[0_4px_0_#B8583C]"
                    : zone.status === "empty"
                      ? "border-[#C9BEAA] bg-[#F4EFE6] text-[#4a5866] shadow-[0_4px_0_#C9BEAA]"
                      : "border-navy bg-paper text-navy shadow-[0_4px_0_#073f68]";
              const sub =
                zone.status === "empty"
                  ? "準備中"
                  : zone.status === "done"
                    ? `已完成 ${zone.done} / ${zone.total}`
                    : isNext
                      ? `下一關在這裡・${zone.done} / ${zone.total}`
                      : `${zone.done} / ${zone.total} 關`;
              const content = (
                <>
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${zone.status === "done" ? "bg-[#F2B629] text-[#3a2700]" : "bg-sky text-navy"}`}>
                    <ZoneIcon theme={zone.theme_key} size={22} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold leading-tight">{zone.name}</span>
                    <span className="block text-[13px] opacity-90">{sub}</span>
                  </span>
                  {zone.starCount > 0 ? (
                    <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-sm font-bold">
                      <StarIcon size={16} /> {zone.starCount}
                    </span>
                  ) : null}
                </>
              );
              const className = `relative flex min-h-16 w-[82%] items-center gap-3 rounded-[20px] border-[3px] px-3 py-2 ${style} ${index % 2 ? "ml-auto" : ""}`;
              return (
                <li key={zone.id}>
                  {zone.status === "empty" ? (
                    <div className={className}>{content}</div>
                  ) : (
                    <Link href={`/zone/${zone.id}`} className={className}>
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </main>
    </div>
  );
}
