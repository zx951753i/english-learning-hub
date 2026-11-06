"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateGame } from "@/features/games/admin-actions";
import { GameFields } from "../game-fields";

type Game = {
  id: string;
  title: string;
  question_count: number;
  difficulty_min: number;
  difficulty_max: number;
};

export function GameEditor({ game, labels }: { game: Game; labels: string[] }) {
  const [state, action] = useActionState(updateGame.bind(null, game.id), {});
  return (
    <ActionForm action={action} className="space-y-4">
      <GameFields values={game} labels={labels} />
      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.saved ? <Notice tone="ok">已儲存。</Notice> : null}
      <SubmitButton pendingText="儲存中…">儲存</SubmitButton>
    </ActionForm>
  );
}
