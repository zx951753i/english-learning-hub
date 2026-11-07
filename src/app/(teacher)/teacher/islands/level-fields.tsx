import { SelectField, TextField } from "@/components/ui/field";
import { DEFAULT_THREE_STAR, DEFAULT_TWO_STAR, UNLOCK_RULES } from "@/features/adventure/rules";

type Values = {
  title?: string;
  question_count?: number;
  difficulty_min?: number;
  difficulty_max?: number;
  two_star_percent?: number;
  three_star_percent?: number;
  unlock_rule?: string;
  is_boss?: boolean;
};

export function LevelFields({ values = {}, labels }: { values?: Values; labels: string[] }) {
  const difficulty = labels.map((label, index) => (
    <option key={label} value={index + 1}>
      {label}
    </option>
  ));
  return (
    <>
      <TextField label="關卡名稱" name="title" required maxLength={120} defaultValue={values.title} autoComplete="off" />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="每局題數" name="questionCount" type="number" min={2} max={30} required defaultValue={values.question_count ?? 8} />
        <SelectField label="最低難度" name="difficultyMin" defaultValue={values.difficulty_min ?? 1}>
          {difficulty}
        </SelectField>
        <SelectField label="最高難度" name="difficultyMax" defaultValue={values.difficulty_max ?? 4}>
          {difficulty}
        </SelectField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="2 星門檻（正確率 %）" name="twoStar" type="number" min={1} max={99} required defaultValue={values.two_star_percent ?? DEFAULT_TWO_STAR} />
        <TextField label="3 星門檻（正確率 %）" name="threeStar" type="number" min={2} max={100} required defaultValue={values.three_star_percent ?? DEFAULT_THREE_STAR} />
      </div>
      <p className="-mt-2 text-sm text-muted">完成關卡就有 1 顆星；正確率以第一次作答計算。</p>
      <SelectField label="解鎖條件" name="unlockRule" defaultValue={values.unlock_rule ?? "previous_complete"} hint="區域的第一關永遠開放">
        {UNLOCK_RULES.map((rule) => (
          <option key={rule.key} value={rule.key}>
            {rule.label}
          </option>
        ))}
      </SelectField>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" name="isBoss" defaultChecked={values.is_boss} className="size-5 accent-[var(--navy)]" />
        <span>這是終極挑戰關（地圖上顯示皇冠）</span>
      </label>
    </>
  );
}
