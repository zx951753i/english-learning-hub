"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { SelectField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { createGame } from "@/features/games/admin-actions";
import type { TextbookOption } from "@/features/question-bank/data";
import { GameFields } from "../game-fields";

type Props = {
  textbooks: TextbookOption[];
  games: { key: string; label: string; description: string }[];
  labels: string[];
};

export function GameForm({ textbooks, games, labels }: Props) {
  const [state, action] = useActionState(createGame, {});
  const [textbookId, setTextbookId] = useState("");
  const [gameType, setGameType] = useState(games[0]?.key ?? "");
  const book = textbooks.find((item) => item.id === textbookId);

  return (
    <ActionForm action={action} className="space-y-4">
      <SelectField
        label="遊戲類型"
        name="gameType"
        value={gameType}
        onChange={(event) => setGameType(event.target.value)}
        hint={games.find((game) => game.key === gameType)?.description}
      >
        {games.map((game) => (
          <option key={game.key} value={game.key}>
            {game.label}
          </option>
        ))}
      </SelectField>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="教材"
          required
          value={textbookId}
          onChange={(event) => setTextbookId(event.target.value)}
        >
          <option value="" disabled>
            請選擇
          </option>
          {textbooks.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </SelectField>
        <SelectField label="單元" name="unitId" required defaultValue="" key={textbookId}>
          <option value="" disabled>
            請選擇
          </option>
          {book?.units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.title}
            </option>
          ))}
        </SelectField>
      </div>
      <GameFields labels={labels} />
      {state.error ? <Notice>{state.error}</Notice> : null}
      <SubmitButton pendingText="建立中…">建立遊戲</SubmitButton>
    </ActionForm>
  );
}
