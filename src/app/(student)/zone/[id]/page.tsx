import { ChevronLeft, Crown, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StarIcon, Stars } from "@/components/adventure/stars";
import { StudentHeader } from "@/components/adventure/student-header";
import { EmptyState } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { loadZoneLevels } from "@/features/adventure/data";
import { requireStudent } from "@/features/auth/session";
import { startLevel } from "@/features/games/engine";
import { getGameDefinition } from "@/features/games/registry";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "關卡路線" };

const X = [50, 78, 50, 22];
const ROW = 112;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ locked?: string; error?: string }> };

export default async function ZonePathPage({ params, searchParams }: Props) {
  const profile = await requireStudent();
  const { id } = await params;
  const { locked, error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: zone } = await supabase
    .from("island_zones")
    .select("id, name, textbook_id, textbooks(title), learning_stages(slug, island_name)")
    .eq("id", id)
    .maybeSingle();
  if (!zone) notFound();

  const levels = await loadZoneLevels(supabase, id, profile.id);
  const stage = zone.learning_stages as unknown as { slug: string; island_name: string };
  const book = zone.textbooks as unknown as { title: string };
  const done = levels.filter((level) => level.state.status === "done").length;
  const starTotal = levels.reduce((sum, level) => sum + level.state.stars, 0);
  const current = levels.find((level) => level.state.status === "current");
  const height = Math.max(1, levels.length) * ROW;
  const points = levels.map((_, index) => `${X[index % 4]},${index * ROW + ROW / 2}`).join(" ");

  return (
    <div data-stage="kids" className="min-h-dvh">
      <StudentHeader />
      <main className="mx-auto max-w-xl space-y-4 px-4 py-5">
        <Link href={`/island/${stage.slug}?book=${zone.textbook_id}`} className="inline-flex min-h-11 items-center gap-1 font-bold text-navy">
          <ChevronLeft size={20} aria-hidden /> {stage.island_name}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-3xl">{zone.name}</h1>
            <p className="text-sm text-muted">
              {book.title}・已完成 {done} / {levels.length} 關
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF1CC] px-3 py-1 text-sm font-bold text-[#6B4A00]">
            <StarIcon size={16} /> {starTotal} / {levels.length * 3}
          </span>
        </div>

        {locked ? <Notice>這一關還沒解鎖，先完成前面的關卡吧！</Notice> : null}
        {error ? <Notice>這一關暫時無法進行，請告訴老師。</Notice> : null}

        {levels.length === 0 ? (
          <EmptyState title="這個區域還沒有關卡" />
        ) : (
          <ol className="relative rounded-[32px] bg-[#DDEFD7]" style={{ height: height + 24 }}>
            <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${height + 24}`} preserveAspectRatio="none" aria-hidden>
              <polyline points={points} fill="none" stroke="#C9B48A" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" transform="translate(0 12)" />
            </svg>
            {levels.map((level, index) => {
              const status = level.state.status;
              const size = status === "current" ? 80 : 60;
              return (
                <li
                  key={level.id}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                  style={{ left: `${X[index % 4]}%`, top: index * ROW + ROW / 2 + 12 }}
                >
                  {status === "locked" ? (
                    <>
                      <button
                        type="button"
                        disabled
                        aria-label={`第 ${index + 1} 關 ${level.title}，尚未解鎖：${level.state.hint}`}
                        className="flex items-center justify-center rounded-full border-4 border-paper bg-[#E8E1D4] text-[#6E6559] shadow-[0_4px_0_#C9BEAA]"
                        style={{ width: size, height: size }}
                      >
                        {level.is_boss ? <Crown size={26} aria-hidden /> : <Lock size={22} aria-hidden />}
                      </button>
                      <span className="max-w-28 rounded-full bg-paper/90 px-2 text-center text-[11.5px] leading-snug text-muted">
                        {level.state.hint}
                      </span>
                    </>
                  ) : (
                    <>
                      <form action={startLevel.bind(null, level.id, "normal", undefined)}>
                        <button
                          type="submit"
                          aria-label={`第 ${index + 1} 關 ${level.title}${status === "done" ? `，已完成 ${level.state.stars} 顆星，再挑戰` : "，開始"}`}
                          className={`flex items-center justify-center rounded-full font-serif font-bold ${
                            status === "current"
                              ? "border-[6px] border-paper bg-[#F2B629] text-[28px] text-[#3a2700] shadow-[0_0_0_8px_rgba(242,182,41,0.35),0_5px_0_#B8583C]"
                              : status === "done"
                                ? "border-4 border-paper bg-navy text-[22px] text-paper shadow-[0_4px_0_#052e4c]"
                                : "border-4 border-navy bg-paper text-[22px] text-navy shadow-[0_4px_0_#073f68]"
                          }`}
                          style={{ width: size, height: size }}
                        >
                          {level.is_boss ? <Crown size={26} aria-hidden /> : index + 1}
                        </button>
                      </form>
                      {status === "done" ? (
                        <span className="rounded-full bg-paper px-1.5">
                          <Stars count={level.state.stars} size={14} label={false} />
                        </span>
                      ) : status === "current" ? (
                        <span className="rounded-full bg-terracotta px-2.5 text-[12.5px] font-bold text-paper">下一關</span>
                      ) : (
                        <span className="rounded-full bg-paper px-2 text-[12px] text-navy">可以挑戰</span>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {current ? (
          <section aria-labelledby="next-title" className="space-y-2 rounded-[24px] border-[3px] border-navy bg-paper p-4 shadow-[0_5px_0_#073f68]">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="next-title" className="font-sans text-lg font-bold text-navy">
                第 {levels.indexOf(current) + 1} 關｜{current.title}
              </h2>
              <span className="shrink-0 text-[13px] text-muted">{current.question_count} 題</span>
            </div>
            <p className="text-sm text-ink/80">
              {getGameDefinition(current.game_type)?.description}。答對 {current.two_star_percent}% 拿 2 顆星，答對 {current.three_star_percent}% 拿 3 顆星。
            </p>
            <form action={startLevel.bind(null, current.id, "normal", undefined)}>
              <SubmitButton pendingText="準備中…" className="w-full rounded-full bg-[#F2B629] text-lg text-[#3a2700] shadow-[0_4px_0_#B8583C] hover:bg-[#e5a91f]">
                開始挑戰
              </SubmitButton>
            </form>
          </section>
        ) : levels.length > 0 && done === levels.length ? (
          <Notice tone="ok">這個區域全部完成了！可以回去挑戰更多星星。</Notice>
        ) : null}
      </main>
    </div>
  );
}
