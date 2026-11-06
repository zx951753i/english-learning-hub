import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { requireTeacher } from "@/features/auth/session";
import { GAME_DEFINITIONS } from "@/features/games/registry";
import { loadContentTree } from "@/features/question-bank/data";
import { GameForm } from "./game-form";

export const metadata: Metadata = { title: "新增遊戲" };

export default async function NewGamePage() {
  await requireTeacher();
  const { stages, textbooks } = await loadContentTree();
  const kids = stages.find((stage) => stage.name === "English Kids");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl">新增遊戲</h1>
      <Card>
        <GameForm
          textbooks={textbooks.filter((book) => book.stage_id === kids?.id)}
          games={GAME_DEFINITIONS.map(({ key, label, description }) => ({ key, label, description }))}
          labels={kids?.difficulty_labels ?? ["1", "2", "3", "4"]}
        />
      </Card>
    </div>
  );
}
