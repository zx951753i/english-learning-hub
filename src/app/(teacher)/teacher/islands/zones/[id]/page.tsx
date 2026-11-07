import { ArrowDown, ArrowUp, Crown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ZoneIcon } from "@/components/adventure/zone-icon";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { SelectField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { createLevelsForUnits, deleteZone, moveLevel, setZoneOpen } from "@/features/adventure/admin-actions";
import { requireTeacher } from "@/features/auth/session";
import { GAME_DEFINITIONS, getGameDefinition } from "@/features/games/registry";
import { createClient } from "@/lib/supabase/server";
import { ZoneForm } from "../../zone-form";
import { DeleteLevelButton } from "./delete-level-button";
import { NewLevelForm } from "./zone-editors";

export const metadata: Metadata = { title: "學習區域" };

const ERRORS: Record<string, string> = {
  delete: "這個區域還有關卡，無法刪除；可以改為關閉。",
  move: "順序調整失敗，請稍後再試。",
  bulk: "部分關卡建立失敗，請檢查後再試。",
  levelUsed: "這個關卡已有學生的作答紀錄，為了保留紀錄無法刪除；可以進入關卡改為取消發布。",
  status: "狀態更新失敗，請稍後再試。",
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> };

export default async function ZonePage({ params, searchParams }: Props) {
  await requireTeacher();
  const { id } = await params;
  const { error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: zone } = await supabase
    .from("island_zones")
    .select("id, name, theme_key, description, is_open, textbook_id, stage_id, textbooks(title), learning_stages(slug, difficulty_labels)")
    .eq("id", id)
    .maybeSingle();
  if (!zone) notFound();

  const [{ data: levels }, { data: units }] = await Promise.all([
    supabase
      .from("game_levels")
      .select("id, title, is_published, is_boss, games(game_type, units(title))")
      .eq("zone_id", id)
      .order("order_index"),
    supabase.from("units").select("id, title").eq("textbook_id", zone.textbook_id).eq("is_active", true).order("order_index"),
  ]);

  const stage = zone.learning_stages as unknown as { slug: string; difficulty_labels: string[] };
  const book = zone.textbooks as unknown as { title: string };
  const games = GAME_DEFINITIONS.filter((game) => game.stages.includes(stage.slug)).map(
    ({ key, label, description }) => ({ key, label, description }),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={`/teacher/islands?book=${zone.textbook_id}`} className="text-sm text-navy underline underline-offset-4">
          {book.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-sky text-navy">
            <ZoneIcon theme={zone.theme_key} size={22} />
          </span>
          <h1 className="text-3xl">{zone.name}</h1>
          {!zone.is_open ? <Badge tone="muted">已關閉</Badge> : null}
        </div>
      </div>

      {error && ERRORS[error] ? <Notice>{ERRORS[error]}</Notice> : null}

      <Card>
        <h2 className="mb-3 text-xl">關卡路線（{levels?.length ?? 0}）</h2>
        {!levels || levels.length === 0 ? (
          <EmptyState title="還沒有關卡">在下方新增，或一次為每個單元各建一關。</EmptyState>
        ) : (
          <ol className="divide-y divide-line">
            {levels.map((level, index) => {
              const game = level.games as unknown as { game_type: string; units: { title: string } };
              return (
                <li key={level.id} className="flex flex-wrap items-center justify-between gap-x-2 py-1.5">
                  <Link href={`/teacher/islands/levels/${level.id}`} className="flex min-w-0 basis-full items-center gap-3 py-1 sm:basis-0 sm:flex-1">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy font-serif font-semibold text-cream">
                      {level.is_boss ? <Crown size={18} aria-label="終極挑戰" /> : index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">{level.title}</span>
                      <span className="block text-sm text-muted">
                        {getGameDefinition(game.game_type)?.label}・{game.units.title}
                      </span>
                    </span>
                    <Badge tone={level.is_published ? "ok" : "muted"}>{level.is_published ? "已發布" : "未發布"}</Badge>
                  </Link>
                  <span className="ml-auto flex shrink-0 items-center">
                    <form action={moveLevel.bind(null, id, level.id, -1)}>
                      <SubmitButton variant="ghost" pendingText="…" disabled={index === 0} aria-label={`將 ${level.title} 上移`} className="px-2.5">
                        <ArrowUp size={18} aria-hidden />
                      </SubmitButton>
                    </form>
                    <form action={moveLevel.bind(null, id, level.id, 1)}>
                      <SubmitButton variant="ghost" pendingText="…" disabled={index === levels.length - 1} aria-label={`將 ${level.title} 下移`} className="px-2.5">
                        <ArrowDown size={18} aria-hidden />
                      </SubmitButton>
                    </form>
                    <DeleteLevelButton levelId={level.id} zoneId={id} title={level.title} />
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {units && units.length > 0 && games.length > 0 ? (
          <form action={createLevelsForUnits.bind(null, id)} className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
            <div className="min-w-48 flex-1">
              <SelectField label={`為 ${units.length} 個單元各建一關`} name="gameType" defaultValue={games[0].key}>
                {games.map((game) => (
                  <option key={game.key} value={game.key}>
                    {game.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <SubmitButton variant="secondary" pendingText="建立中…">
              一次建立
            </SubmitButton>
          </form>
        ) : null}
      </Card>

      <Card>
        <h2 className="mb-4 text-xl">新增關卡</h2>
        {games.length === 0 ? (
          <p className="text-muted">這座島的遊戲將在後續階段加入。</p>
        ) : !units?.length ? (
          <p className="text-muted">這本教材還沒有單元。</p>
        ) : (
          <NewLevelForm zoneId={id} units={units} games={games} labels={stage.difficulty_labels} />
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-xl">區域設定</h2>
        <ZoneForm zone={zone} />
      </Card>

      <Card className="space-y-3">
        <div>
          <h2 className="mb-1 text-xl">{zone.is_open ? "關閉區域" : "開放區域"}</h2>
          <p className="text-sm text-muted">關閉後學生地圖上看不到這個區域，進度會保留。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={setZoneOpen.bind(null, id, !zone.is_open)}>
            <SubmitButton variant={zone.is_open ? "danger" : "secondary"}>{zone.is_open ? "關閉區域" : "開放區域"}</SubmitButton>
          </form>
          {!levels?.length ? (
            <form action={deleteZone.bind(null, id, zone.textbook_id)}>
              <SubmitButton variant="danger" pendingText="刪除中…">
                刪除區域
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
