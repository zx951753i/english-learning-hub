import { BookCheck, ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StudentHeader } from "@/components/adventure/student-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireStudent } from "@/features/auth/session";
import { startReview } from "@/features/games/engine";
import { getGameDefinition } from "@/features/games/registry";
import { loadMistakeGroups } from "@/features/missions/data";
import { REVIEW_SIZE } from "@/features/missions/rules";
import { MISTAKE_CLEAR_STREAK } from "@/features/games/scoring";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "錯題本" };

const ERRORS: Record<string, string> = {
  empty: "這組錯題已經複習完了。",
  "no-mistakes": "這組錯題已經複習完了。",
  "not-enough": "這組題目不夠組成一局，請先多玩幾個關卡。",
};

export default async function MistakesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const profile = await requireStudent();
  const { error } = await searchParams;
  const admin = createAdminClient();
  const groups = await loadMistakeGroups(admin, profile.id);
  const bookIds = [...new Set(groups.map((group) => group.textbook_id))];
  const { data: books } = bookIds.length
    ? await admin.from("textbooks").select("id, title").in("id", bookIds)
    : { data: [] as { id: string; title: string }[] };
  const titleOf = new Map((books ?? []).map((book) => [book.id, book.title]));
  const total = groups.reduce((sum, group) => sum + group.questionIds.length, 0);

  return (
    <div data-stage="kids" className="min-h-dvh">
      <StudentHeader />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <Link href="/home" className="inline-flex min-h-11 items-center gap-1 font-bold text-navy">
          <ChevronLeft size={20} aria-hidden /> 冒險地圖
        </Link>
        <div>
          <h1 className="text-3xl">錯題本</h1>
          <p className="mt-1 text-[15px] text-ink/80">
            答錯的題目會放在這裡。之後連續答對 {MISTAKE_CLEAR_STREAK} 次，就會自動移出。
          </p>
        </div>

        {error && ERRORS[error] ? (
          <p role="status" className="rounded-[18px] bg-sky px-4 py-3 text-[15px] text-navy">
            {ERRORS[error]}
          </p>
        ) : null}

        {groups.length === 0 ? (
          <section className="flex flex-col items-center gap-3 rounded-[24px] border-2 border-[#EADFCB] bg-paper px-5 py-10 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-ok-soft text-ok">
              <BookCheck size={32} aria-hidden />
            </span>
            <h2 className="text-xl">錯題本是空的，太棒了！</h2>
            <p className="text-muted">繼續闖關，答錯的題目會出現在這裡。</p>
          </section>
        ) : (
          <section aria-labelledby="groups" className="space-y-3">
            <h2 id="groups" className="text-xl">
              共 {total} 題要複習
            </h2>
            <ul className="space-y-3">
              {groups.map((group) => {
                const count = group.questionIds.length;
                return (
                  <li
                    key={group.key}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border-2 border-[#EADFCB] bg-paper px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-navy">{getGameDefinition(group.game_type)?.label}</p>
                      <p className="text-sm text-muted">
                        {titleOf.get(group.textbook_id) ?? ""}・{count} 題
                        {count > REVIEW_SIZE ? `（每次 ${REVIEW_SIZE} 題）` : ""}
                      </p>
                    </div>
                    <form action={startReview.bind(null, group.key)}>
                      <SubmitButton
                        pendingText="準備中…"
                        aria-label={`開始複習：${getGameDefinition(group.game_type)?.label}`}
                        className="rounded-full bg-[#F2B629] text-[#3a2700] hover:bg-[#e5a91f]"
                      >
                        開始複習
                      </SubmitButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
