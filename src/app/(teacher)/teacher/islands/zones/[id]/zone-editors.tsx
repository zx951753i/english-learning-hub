"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { SelectField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { createLevel, type FormState } from "@/features/adventure/admin-actions";
import { LevelFields } from "../../level-fields";

type Props = {
  zoneId: string;
  units: { id: string; title: string }[];
  games: { key: string; label: string; description: string }[];
  labels: string[];
};

export function NewLevelForm({ zoneId, units, games, labels }: Props) {
  const [state, submit] = useActionState<FormState, FormData>(createLevel.bind(null, zoneId), {});
  const [gameType, setGameType] = useState(games[0]?.key ?? "");
  return (
    <ActionForm action={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
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
        <SelectField label="單元" name="unitId" required defaultValue="">
          <option value="" disabled>
            請選擇
          </option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.title}
            </option>
          ))}
        </SelectField>
      </div>
      <LevelFields labels={labels} />
      {state.error ? <Notice>{state.error}</Notice> : null}
      <SubmitButton pendingText="建立中…">新增關卡</SubmitButton>
    </ActionForm>
  );
}
