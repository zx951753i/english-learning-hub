import { Check, Flag, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  AvatarPicker,
  AvatarProvider,
  CurrentAvatar,
} from "@/components/adventure/avatar-picker";
import { IslandArt } from "@/components/adventure/island-art";
import { StarIcon, Stars } from "@/components/adventure/stars";
import { StudentHeader } from "@/components/adventure/student-header";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  adventureLevel,
  computeLevelStates,
  isAvatar,
  levelTitle,
  type UnlockRule,
} from "@/features/adventure/rules";
import { requireStudent } from "@/features/auth/session";
import { startLevel } from "@/features/games/engine";
import { loadOpenMistakes, loadTodayMission } from "@/features/missions/data";
import {
  assignmentStatus,
  formatDue,
  type AssignmentStatus,
} from "@/features/missions/rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "冒險地圖" };

const card = "rounded-[24px] border-2 border-[#EADFCB] bg-paper p-5";

export default async function WorldMapPage() {
  const profile = await requireStudent();
  const supabase = await createClient();

  const [
    { data: me },
    { data: stages },
    { data: classes },
    { data: zones },
    { data: levels },
    { data: progress },
    { data: badges },
    { data: earned },
    assignments,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("avatar_key")
      .eq("id", profile.id)
      .maybeSingle(),
    supabase
      .from("learning_stages")
      .select("id, slug, island_name, tagline")
      .order("order_index"),
    supabase.from("classes").select("id, stage_id"),
    supabase
      .from("island_zones")
      .select("id, name, stage_id, order_index, textbook_id")
      .order("order_index"),
    supabase
      .from("game_levels")
      .select("id, zone_id, title, order_index, unlock_rule")
      .eq("is_published", true),
    supabase
      .from("student_progress")
      .select("level_id, stars, last_played_at")
      .order("last_played_at", { ascending: false }),
    supabase
      .from("badges")
      .select("id, code, name, description")
      .order("created_at"),
    supabase.from("student_badges").select("badge_id"),
    loadAssignments(supabase),
  ]);
  const admin = createAdminClient();
  const openMistakes = (await loadOpenMistakes(admin, profile.id)).length;
  const mission = await loadTodayMission(admin, profile.id, {
    hasLevels: (levels?.length ?? 0) > 0,
    openMistakes,
  });

  const avatar = isAvatar(me?.avatar_key ?? "")
    ? (me!.avatar_key as "explorer")
    : "explorer";
  const stars = new Map(
    (progress ?? []).map((row) => [
      row.level_id as string,
      row.stars as number,
    ]),
  );
  const totalStars = (progress ?? []).reduce((sum, row) => sum + row.stars, 0);
  const rank = adventureLevel(totalStars);
  const openStages = new Set(classes?.map((item) => item.stage_id));
  const zoneById = new Map((zones ?? []).map((zone) => [zone.id, zone]));
  const levelById = new Map((levels ?? []).map((level) => [level.id, level]));
  const earnedIds = new Set(earned?.map((row) => row.badge_id));

  // 下一關：最近玩過的區域優先，否則第一個區域。
  const recentZoneId = (progress ?? [])
    .map((row) => levelById.get(row.level_id)?.zone_id)
    .find(Boolean);
  const zoneOrder = [
    recentZoneId,
    ...(zones ?? []).map((zone) => zone.id),
  ].filter(Boolean) as string[];
  let next: { id: string; title: string; zone: string } | null = null;
  for (const zoneId of zoneOrder) {
    const zoneLevels = (levels ?? []).filter(
      (level) => level.zone_id === zoneId,
    ) as {
      id: string;
      title: string;
      order_index: number;
      unlock_rule: UnlockRule;
    }[];
    const current = computeLevelStates(zoneLevels, stars).find(
      (state) => state.status === "current",
    );
    if (current) {
      next = {
        id: current.id,
        title: levelById.get(current.id)!.title,
        zone: zoneById.get(zoneId)!.name,
      };
      break;
    }
  }

  const recent = (progress ?? [])
    .filter((row) => levelById.has(row.level_id))
    .slice(0, 3)
    .map((row) => {
      const level = levelById.get(row.level_id)!;
      return {
        id: level.id,
        title: level.title,
        zone: zoneById.get(level.zone_id)?.name ?? "",
        stars: row.stars,
      };
    });

  return (
    <div data-stage="kids" className="min-h-dvh">
      <StudentHeader />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        <div className="grid gap-5 md:grid-cols-2">
          <section
            aria-labelledby="hello"
            className={`${card} shadow-[0_5px_0_#E3D6BE]`}
          >
            <AvatarProvider initial={avatar}>
              <div className="flex flex-wrap items-center gap-4">
                <CurrentAvatar size={104} />
                <div className="min-w-0 flex-1 space-y-2">
                  <h1 id="hello" className="text-3xl">
                    Hi, {profile.display_name}!
                  </h1>
                  <p className="text-[17px] text-ink/80">
                    今天也一起出發去冒險吧！
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-navy px-3 py-1 text-[15px] font-bold text-paper">
                      Lv.{rank.level} {levelTitle(rank.level)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF1CC] px-3 py-1 text-[15px] font-bold text-[#6B4A00]">
                      <StarIcon /> {totalStars} 顆星
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div
                  className="h-3.5 overflow-hidden rounded-full bg-[#EDE5D6]"
                  role="progressbar"
                  aria-label="升級進度"
                  aria-valuenow={Math.round(rank.progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-[#F2B629]"
                    style={{ width: `${rank.progress * 100}%` }}
                  />
                </div>
                <p className="mt-1.5 text-sm text-muted">
                  再拿 {rank.toNext} 顆星，就能升到 Lv.{rank.level + 1}
                </p>
              </div>
              <AvatarPicker />
            </AvatarProvider>
          </section>

          <section
            aria-labelledby="mission"
            className="space-y-3 self-start rounded-[24px] bg-navy p-5 text-paper shadow-[0_5px_0_#052e4c]"
          >
            <h2
              id="mission"
              className="flex items-center gap-2 text-2xl text-paper"
            >
              <Flag size={24} className="text-[#F2B629]" aria-hidden />
              Today&apos;s Mission
            </h2>
            {mission ? (
              <ol className="space-y-2.5">
                {mission.tasks.map((task) => (
                  <li
                    key={task.key}
                    className="flex items-center justify-between gap-3 rounded-[18px] bg-white/10 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                          task.done
                            ? "bg-[#F2B629] text-[#3a2700]"
                            : "border-2 border-white/40"
                        }`}
                      >
                        {task.done ? <Check size={18} aria-hidden /> : null}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[17px] font-bold">
                          {task.label}
                          <span className="sr-only">
                            {task.done ? "，已完成" : "，未完成"}
                          </span>
                        </p>
                        <p className="text-sm text-sky">
                          {task.key === "level"
                            ? next
                              ? `${next.zone}・${next.title}`
                              : "任選一關再挑戰也可以"
                            : openMistakes > 0
                              ? `錯題本還有 ${openMistakes} 題`
                              : "錯題本清空了"}
                        </p>
                      </div>
                    </div>
                    {task.done ? null : task.key === "level" && next ? (
                      <form
                        action={startLevel.bind(
                          null,
                          next.id,
                          "normal",
                          undefined,
                        )}
                      >
                        <SubmitButton
                          pendingText="準備中…"
                          aria-label={`出發：${next.title}`}
                          className="rounded-full bg-[#F2B629] text-[#3a2700] hover:bg-[#e5a91f]"
                        >
                          出發
                        </SubmitButton>
                      </form>
                    ) : task.key === "review" ? (
                      <Link
                        href="/mistakes"
                        className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-[#F2B629] px-4 font-bold text-[#3a2700] hover:bg-[#e5a91f]"
                      >
                        複習
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-[18px] bg-white/10 px-4 py-3">
                {!classes?.length
                  ? "老師還沒有把您加入班級，加入後就能出發。"
                  : "老師正在準備關卡，很快就能出發。"}
              </p>
            )}
            {mission?.complete ? (
              <p className="rounded-[18px] bg-[#F2B629] px-4 py-3 text-[15px] font-bold text-[#3a2700]">
                今天的任務完成了！明天會有新的任務。
              </p>
            ) : null}
          </section>
        </div>

        {assignments.length > 0 ? (
          <section aria-labelledby="assigned" className={`${card} space-y-3`}>
            <h2 id="assigned" className="text-xl">
              老師指派的任務
            </h2>
            <ul className="space-y-2.5">
              {assignments.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-[#F6EFE2] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-bold">{item.title}</p>
                    <p className="text-sm text-muted">
                      {item.zone}
                      {item.due_on ? `・期限 ${formatDue(item.due_on)}` : ""}
                    </p>
                    {item.note ? (
                      <p className="text-sm text-ink/80">{item.note}</p>
                    ) : null}
                  </div>
                  {item.status === "done" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-3 py-1 text-sm font-bold text-ok">
                      <Check size={16} aria-hidden /> 已完成
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      {item.status === "overdue" ? (
                        <span className="rounded-full bg-[#FCEDE6] px-3 py-1 text-sm font-bold text-[#8a3b22]">
                          已過期限
                        </span>
                      ) : null}
                      <form
                        action={startLevel.bind(
                          null,
                          item.level_id,
                          "normal",
                          undefined,
                        )}
                      >
                        <SubmitButton
                          pendingText="準備中…"
                          aria-label={`開始任務：${item.title}`}
                          className="rounded-full"
                        >
                          開始
                        </SubmitButton>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-muted">拿到 2 顆星就完成任務。</p>
          </section>
        ) : null}

        <section aria-labelledby="islands" className="space-y-4">
          <h2 id="islands" className="text-2xl">
            選擇你的闖關島
          </h2>
          <div className="grid gap-5 rounded-[36px] bg-[#CFE4F2] p-5 sm:grid-cols-2 lg:grid-cols-3">
            {stages?.map((stage) => {
              const open = openStages.has(stage.id);
              const stageLevels = (levels ?? []).filter(
                (level) => zoneById.get(level.zone_id)?.stage_id === stage.id,
              );
              const done = stageLevels.filter(
                (level) => (stars.get(level.id) ?? 0) > 0,
              ).length;
              const body = (
                <>
                  <IslandArt slug={stage.slug} open={open} />
                  <div className="flex flex-col gap-1.5 px-5 pb-5 pt-4">
                    <span className="font-serif text-[22px] font-bold leading-tight text-navy">
                      {stage.island_name}
                    </span>
                    <span className="text-[15px] text-ink/80">
                      {stage.tagline}
                    </span>
                    {open ? (
                      <span className="mt-1 self-start rounded-full bg-ok-soft px-3 py-1 text-sm font-bold text-ok">
                        已開放・{done} / {stageLevels.length} 關
                      </span>
                    ) : (
                      <span className="mt-1 inline-flex items-center gap-1.5 self-start rounded-full bg-[#E8E1D4] px-3 py-1 text-sm font-bold text-[#4a5866]">
                        <Lock size={14} aria-hidden /> 尚未開放
                      </span>
                    )}
                  </div>
                </>
              );
              return open ? (
                <Link
                  key={stage.id}
                  href={`/island/${stage.slug}`}
                  className="flex flex-col overflow-hidden rounded-[28px] border-[3px] border-navy bg-paper shadow-[0_6px_0_#073f68] transition-transform hover:-translate-y-0.5"
                >
                  {body}
                </Link>
              ) : (
                <div
                  key={stage.id}
                  className="flex flex-col overflow-hidden rounded-[28px] border-[3px] border-dashed border-[#B9AE9B] bg-[#F4EFE6] text-muted"
                >
                  {body}
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <section aria-labelledby="recent" className={`${card} space-y-3`}>
            <h2 id="recent" className="text-xl">
              最近完成的關卡
            </h2>
            {recent.length === 0 ? (
              <p className="text-muted">完成第一關後，紀錄就會出現在這裡。</p>
            ) : (
              recent.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-[#F7F1E6] px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block font-bold">{item.title}</span>
                    <span className="block text-[13px] text-muted">
                      {item.zone}
                    </span>
                  </span>
                  <Stars count={item.stars} size={20} />
                </div>
              ))
            )}
          </section>

          <section aria-labelledby="badges" className={`${card} space-y-3`}>
            <h2 id="badges" className="text-xl">
              我的徽章（{earnedIds.size} / {badges?.length ?? 0}）
            </h2>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {badges?.map((badge) => {
                const has = earnedIds.has(badge.id);
                return (
                  <li
                    key={badge.id}
                    className="flex flex-col items-center gap-1.5 text-center"
                    title={badge.description}
                  >
                    <span
                      className={`flex size-14 items-center justify-center rounded-full border-[3px] font-bold ${
                        has
                          ? "border-[#F2B629] bg-[#FFF1CC] text-[#6B4A00]"
                          : "border-[#C9BEAA] bg-[#EDE5D6] text-[#6E6559]"
                      }`}
                    >
                      {has ? (
                        <StarIcon size={26} />
                      ) : (
                        <Lock size={20} aria-hidden />
                      )}
                    </span>
                    <span
                      className={`text-[12.5px] leading-tight ${has ? "text-ink" : "text-muted"}`}
                    >
                      {badge.name}
                      <span className="sr-only">
                        {has ? "，已獲得" : "，尚未獲得"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}

type StudentAssignment = {
  id: string;
  level_id: string;
  title: string;
  zone: string;
  note: string | null;
  due_on: string | null;
  status: AssignmentStatus;
};

/**
 * 學生的指派任務（RLS 只回傳自己的、且關卡學生看得到的）。
 * 未完成的依期限排在前面；已完成的只顯示最近 3 個。
 */
async function loadAssignments(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<StudentAssignment[]> {
  const { data: rows } = await supabase
    .from("assignments")
    .select(
      "id, level_id, note, due_on, created_at, game_levels!inner(title, island_zones!inner(name))",
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (!rows?.length) return [];
  const { data: attempts } = await supabase
    .from("game_sessions")
    .select("level_id, completed_at, stars_earned")
    .in("level_id", [...new Set(rows.map((row) => row.level_id))])
    .in("mode", ["normal", "retry_all"])
    .eq("status", "completed");
  const now = new Date();
  // 同一關同時指派給班級與個人時只顯示一次（最新的那筆）。
  const latest = rows.filter((row, index) => rows.findIndex((other) => other.level_id === row.level_id) === index);
  const items = latest.map((row) => {
    const level = row.game_levels as unknown as {
      title: string;
      island_zones: { name: string };
    };
    return {
      id: row.id,
      level_id: row.level_id,
      title: level.title,
      zone: level.island_zones.name,
      note: row.note,
      due_on: row.due_on,
      created_at: row.created_at,
      status: assignmentStatus(
        row,
        (attempts ?? []).filter((attempt) => attempt.level_id === row.level_id),
        now,
      ),
    };
  });
  const pending = items
    .filter((item) => item.status !== "done")
    .sort((a, b) => (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999"));
  const done = items.filter((item) => item.status === "done").slice(0, 3);
  return [...pending, ...done];
}
