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
    .select("id, title, game_type, is_published, units(title), textbooks(title)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">遊戲管理</h1>
        <Link href="/teacher/games/new" className={buttonClass()}>
          <Plus size={18} aria-hidden />
          新增遊戲
        </Link>
      </div>
      {!games || games.length === 0 ? (
        <EmptyState title="還沒有遊戲">選擇單元和遊戲類型後，就能讓學生練習。</EmptyState>
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
                  <Badge tone={game.is_published ? "ok" : "muted"}>
                    {game.is_published ? "已發布" : "未發布"}
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
