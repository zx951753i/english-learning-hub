import { Backpack, GraduationCap, LogOut, School, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { startGame } from "@/features/games/engine";
import { getGameDefinition } from "@/features/games/registry";
import { Card, EmptyState } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { logout } from "@/features/auth/actions";
import { requireStudent } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "我的首頁" };

const stageLabels: Record<string, { zh: string; icon: LucideIcon }> = {
  kids: { zh: "國小", icon: Backpack },
  junior: { zh: "國中", icon: School },
  senior: { zh: "高中", icon: GraduationCap },
};

export default async function StudentHomePage() {
  const profile = await requireStudent();
  const supabase = await createClient();

  const [{ data: stages }, { data: classes }, { data: games }, { data: sessions }] = await Promise.all([
    supabase.from("learning_stages").select("id, slug, name, theme_key").order("order_index"),
    supabase.from("classes").select("id, name, stage_id").order("name"),
    supabase
      .from("games")
      .select("id, title, game_type, stage_id, units(title, order_index)")
      .order("title"),
    supabase
      .from("game_sessions")
      .select("id, score, games(title)")
      .eq("status", "completed")
      .neq("mode", "preview")
      .order("completed_at", { ascending: false })
      .limit(5),
  ]);
  const gameStages = new Set(games?.map((game) => game.stage_id));

  const stageIds = new Set(classes?.map((item) => item.stage_id));
  const firstStage = stages?.find((stage) => stageIds.has(stage.id));

  return (
    <div data-stage={firstStage?.theme_key} className="min-h-dvh">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <form action={logout} className="no-print">
            <Button type="submit" variant="ghost" aria-label="登出">
              <LogOut size={18} aria-hidden />
              <span className="hidden sm:inline">登出</span>
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <section>
          <h1 className="text-3xl">Welcome, {profile.display_name}!</h1>
          {classes && classes.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {classes.map((item) => (
                <Badge key={item.id}>{item.name}</Badge>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-muted">老師還沒有把您加入班級。</p>
          )}
        </section>

        <section aria-labelledby="stages-heading">
          <h2 id="stages-heading" className="mb-3 text-xl">
            學習階段
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {stages?.map((stage) => {
              const label = stageLabels[stage.slug];
              const Icon = label?.icon ?? School;
              const open = stageIds.has(stage.id);
              return (
                <Card key={stage.id} className={open ? "" : "opacity-60"}>
                  <span
                    className={`mb-3 flex size-11 items-center justify-center rounded-xl ${
                      open ? "bg-sky text-navy" : "bg-line/60 text-muted"
                    }`}
                  >
                    <Icon size={22} aria-hidden />
                  </span>
                  <p className="text-sm text-muted">{label?.zh}</p>
                  <h3 className="mb-2 text-lg">{stage.name}</h3>
                  <Badge tone={open ? "navy" : "muted"}>
                    {!open ? "尚未開放" : gameStages.has(stage.id) ? "可以練習" : "教材準備中"}
                  </Badge>
                </Card>
              );
            })}
          </div>
        </section>

        {games && games.length > 0 ? (
          <section aria-labelledby="games-heading">
            <h2 id="games-heading" className="mb-3 text-xl">
              我的練習
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {games.map((game) => (
                <Card key={game.id} className="flex flex-col gap-3">
                  <div>
                    <h3 className="text-lg">{game.title}</h3>
                    <p className="text-sm text-muted">
                      {getGameDefinition(game.game_type)?.label}・
                      {(game.units as unknown as { title: string }).title}
                    </p>
                  </div>
                  <form action={startGame.bind(null, game.id, "normal", undefined)}>
                    <SubmitButton pendingText="準備中…" aria-label={`開始 ${game.title}`} className="w-full">
                      開始
                    </SubmitButton>
                  </form>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <div className="grid gap-6 sm:grid-cols-2">
          <section aria-labelledby="mission-heading">
            <h2 id="mission-heading" className="mb-3 text-xl">
              Today&apos;s Mission
            </h2>
            <EmptyState title="目前沒有任務">老師指派後會顯示在這裡。</EmptyState>
          </section>
          <section aria-labelledby="progress-heading">
            <h2 id="progress-heading" className="mb-3 text-xl">
              My Learning Progress
            </h2>
            {sessions && sessions.length > 0 ? (
              <Card className="divide-y divide-line p-0">
                {sessions.map((session) => (
                  <a key={session.id} href={`/play/${session.id}/result`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-sky/40">
                    <span>{(session.games as unknown as { title: string }).title}</span>
                    <span className="font-serif text-xl font-semibold text-navy">{session.score}</span>
                  </a>
                ))}
              </Card>
            ) : (
              <EmptyState title="還沒有學習紀錄">完成第一個練習後就會開始累積。</EmptyState>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
