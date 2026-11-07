import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { requireTeacher } from "@/features/auth/session";
import { getGameDefinition } from "@/features/games/registry";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "遊戲管理" };

export default async function GamesPage() {
  await requireTeacher();
  const supabase = await createClient();
  const { data: games, error } = await supabase
    .from("games")
    .select("id, title, game_type, units(title), textbooks(title), game_levels(id, is_published)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl">遊戲管理</h1>
          <p className="text-muted">每個遊戲設定對應地圖上的一個關卡。</p>
        </div>
        <Link href="/teacher/islands" className={buttonClass()}>
          <Plus size={18} aria-hidden />
          到闖關島新增關卡
        </Link>
      </div>
      {!games || games.length === 0 ? (
        <EmptyState title="還沒有遊戲">在闖關島的區域內新增關卡時，會自動建立遊戲設定。</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {games.map((game) => (
            <Link key={game.id} href={`/teacher/games/${game.id}`}>
              <Card className="h-full transition-colors hover:border-navy/40">
                <h2 className="text-lg">{game.title}</h2>
                <p className="text-sm text-muted">
                  {getGameDefinition(game.game_type)?.label}
                  <br />
                  {(game.textbooks as unknown as { title: string }).title}・
                  {(game.units as unknown as { title: string }).title}
                </p>
                <div className="mt-2">
                  {(() => {
                    const level = (game.game_levels as { id: string; is_published: boolean }[])[0];
                    if (!level) return <Badge tone="muted">未放上地圖</Badge>;
                    return <Badge tone={level.is_published ? "ok" : "muted"}>{level.is_published ? "關卡已發布" : "關卡未發布"}</Badge>;
                  })()}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
