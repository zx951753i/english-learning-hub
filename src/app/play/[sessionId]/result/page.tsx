import { Unlock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StarIcon } from "@/components/adventure/stars";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { loadZoneLevels } from "@/features/adventure/data";
import { homePathFor } from "@/features/auth/session";
import { startGame, startLevel } from "@/features/games/engine";
import { loadOwnSession } from "@/features/games/session-data";
import type { GradingKey, PublicRound } from "@/features/games/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "遊戲成績" };

const promptOf = (round: PublicRound) => (round.renderer === "match_pairs" ? round.left : round.prompt);

export default async function ResultPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { admin, profile, session, title, theme } = await loadOwnSession(sessionId);
  if (session.status !== "completed") redirect(`/play/${sessionId}`);

  const levelId = (session as { level_id?: string | null }).level_id ?? null;
  const preview = session.mode === "preview";

  const [{ data: wrong }, outcome] = await Promise.all([
    admin
      .from("answers")
      .select("session_item_id, game_session_items(position, public_round, grading_key)")
      .eq("session_id", sessionId)
      .eq("is_correct", false),
    levelId ? admin.rpc("record_level_result", { p_session_id: sessionId }) : Promise.resolve({ data: null }),
  ]);
  const result = (outcome.data ?? { stars: null, badges: [] }) as { stars: number | null; badges: string[] };

  const { data: badgeRows } = result.badges.length
    ? await admin.from("badges").select("code, name").in("code", result.badges)
    : { data: [] as { code: string; name: string }[] };

  // 下一關：只對學生計算，使用學生身分查詢，與地圖上的狀態一致。
  let next: { id: string; title: string; open: boolean; hint: string | null } | null = null;
  let zoneId: string | null = null;
  let threeStar: number | null = null;
  if (levelId && !preview) {
    const { data: level } = await admin.from("game_levels").select("zone_id, three_star_percent").eq("id", levelId).maybeSingle();
    if (level) {
      zoneId = level.zone_id;
      threeStar = level.three_star_percent;
      const levels = await loadZoneLevels(await createClient(), level.zone_id, profile.id);
      const index = levels.findIndex((item) => item.id === levelId);
      const after = index >= 0 ? levels[index + 1] : undefined;
      if (after) next = { id: after.id, title: after.title, open: after.state.status !== "locked", hint: after.state.hint };
    }
  }

  const mistakes = (wrong ?? [])
    .map((row) => row.game_session_items as unknown as { position: number; public_round: PublicRound; grading_key: GradingKey })
    .sort((a, b) => a.position - b.position);

  const neededForThree =
    threeStar !== null && result.stars !== null && result.stars < 3
      ? Math.ceil((threeStar / 100) * session.question_total) - session.correct_count
      : 0;

  const replay = (mode: "retry_all" | "retry_wrong") =>
    levelId ? startLevel.bind(null, levelId, preview ? "preview" : mode, sessionId) : startGame.bind(null, session.game_id);

  return (
    <main data-stage={theme} className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <section aria-labelledby="clear" className="flex flex-col items-center gap-2 rounded-[28px] bg-navy px-5 py-6 text-center text-paper shadow-[0_5px_0_#052e4c]">
        <p className="text-sm text-sky">{title}</p>
        <h1 id="clear" className="text-[32px] text-paper">
          {result.stars !== null ? "過關！" : "完成了！"}
        </h1>
        {result.stars !== null ? (
          <div className="flex items-end gap-1.5" role="img" aria-label={`獲得 ${result.stars} 顆星，共 3 顆`}>
            {[0, 1, 2].map((index) => (
              <StarIcon key={index} size={index === 1 ? 72 : 56} filled={index < result.stars!} />
            ))}
          </div>
        ) : null}
        <p className="font-serif text-[42px] font-bold leading-none">
          {session.score} <span className="font-sans text-lg">分</span>
        </p>
        <p className="text-[15px] text-sky">
          答對 {session.correct_count} / {session.question_total} 題
          {neededForThree > 0 ? `・再答對 ${neededForThree} 題就能拿 3 顆星` : ""}
        </p>
      </section>

      {preview ? <p className="text-sm text-muted">這是老師試玩，不計入學習紀錄與星星。</p> : null}
      {session.mode === "retry_wrong" ? <p className="text-sm text-muted">只練錯題不改變關卡星數，但會記入錯題複習。</p> : null}

      {(badgeRows?.length ?? 0) > 0 || next?.open ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {badgeRows?.map((badge) => (
            <div key={badge.code} className="flex flex-col items-center gap-1 rounded-[20px] border-2 border-[#F2B629] bg-[#FFF1CC] p-3 text-center">
              <StarIcon size={32} />
              <span className="text-[12.5px] font-bold text-[#6B4A00]">新徽章</span>
              <span className="font-bold">{badge.name}</span>
            </div>
          ))}
          {next?.open ? (
            <div className="flex flex-col items-center gap-1 rounded-[20px] border-2 border-[#5BA56B] bg-ok-soft p-3 text-center">
              <Unlock size={28} className="text-ok" aria-hidden />
              <span className="text-[12.5px] font-bold text-ok">下一關已開放</span>
              <span className="font-bold">{next.title}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {mistakes.length > 0 ? (
        <section aria-labelledby="wrong-title">
          <h2 id="wrong-title" className="mb-2 font-sans text-lg font-bold text-navy">
            答錯的題目（{mistakes.length}）
          </h2>
          <Card className="divide-y divide-line p-0">
            {mistakes.map((item) => (
              <p key={item.position} className="flex justify-between gap-3 px-4 py-2.5">
                <span className="text-[15px] text-ink/80">{promptOf(item.public_round)}</span>
                <span className="font-bold">{item.grading_key.display}</span>
              </p>
            ))}
          </Card>
          {!preview ? <p className="mt-1.5 text-[13px] text-muted">這些題目已記入錯題，過幾天會再出現。</p> : null}
        </section>
      ) : null}

      <div className="space-y-2.5">
        {next?.open ? (
          <form action={startLevel.bind(null, next.id, "normal", undefined)}>
            <SubmitButton pendingText="準備中…" className="w-full rounded-full bg-[#F2B629] text-lg text-[#3a2700] shadow-[0_4px_0_#B8583C] hover:bg-[#e5a91f]">
              前往下一關
            </SubmitButton>
          </form>
        ) : next ? (
          <p className="text-center text-sm text-muted">下一關「{next.title}」：{next.hint}</p>
        ) : null}
        <div className="flex gap-2.5">
          {mistakes.length > 0 ? (
            <form action={replay("retry_wrong")} className="flex-1">
              <SubmitButton variant="secondary" pendingText="準備中…" className="w-full rounded-full">
                只練錯題
              </SubmitButton>
            </form>
          ) : null}
          <form action={replay("retry_all")} className="flex-1">
            <SubmitButton variant="secondary" pendingText="準備中…" className="w-full rounded-full">
              再挑戰一次
            </SubmitButton>
          </form>
        </div>
        <div className="flex justify-center gap-4">
          {zoneId ? (
            <Link href={`/zone/${zoneId}`} className={buttonClass("ghost")}>
              回到關卡路線
            </Link>
          ) : null}
          <Link href={homePathFor(profile.role)} className={buttonClass("ghost")}>
            {profile.role === "teacher" ? "回到後台" : "回到冒險地圖"}
          </Link>
        </div>
      </div>
    </main>
  );
}
