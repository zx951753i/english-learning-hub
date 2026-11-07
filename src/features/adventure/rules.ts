/** 闖關規則的純函式：伺服器與測試共用。星星結算本身在資料庫函式 record_level_result。 */

export type UnlockRule = "previous_complete" | "previous_two_stars" | "always_open";
export type LevelStatus = "done" | "current" | "open" | "locked";

export type LevelInput = { id: string; order_index: number; unlock_rule: UnlockRule };
export type LevelState = { id: string; stars: number; status: LevelStatus; hint: string | null };

export const DEFAULT_TWO_STAR = 60;
export const DEFAULT_THREE_STAR = 90;
export const STARS_PER_LEVEL_UP = 10;

export const UNLOCK_RULES: { key: UnlockRule; label: string }[] = [
  { key: "previous_complete", label: "完成上一關（至少 1 顆星）" },
  { key: "previous_two_stars", label: "上一關拿到 2 顆星" },
  { key: "always_open", label: "一律開放" },
];

/** 與資料庫結算一致：完成 1 星，達門檻 2、3 星。 */
export function starsFor(score: number, two = DEFAULT_TWO_STAR, three = DEFAULT_THREE_STAR) {
  if (score >= three) return 3;
  if (score >= two) return 2;
  return 1;
}

/** 依順序判斷每關狀態。第一關永遠開放；第一個開放但未完成的關卡為「下一關」。 */
export function computeLevelStates(levels: LevelInput[], stars: Map<string, number>): LevelState[] {
  const ordered = [...levels].sort((a, b) => a.order_index - b.order_index);
  let currentAssigned = false;
  return ordered.map((level, index) => {
    const own = stars.get(level.id) ?? 0;
    const previous = index > 0 ? (stars.get(ordered[index - 1].id) ?? 0) : null;
    const unlocked =
      index === 0 ||
      level.unlock_rule === "always_open" ||
      (level.unlock_rule === "previous_complete" && (previous ?? 0) >= 1) ||
      (level.unlock_rule === "previous_two_stars" && (previous ?? 0) >= 2);

    let status: LevelStatus;
    if (own > 0) status = "done";
    else if (!unlocked) status = "locked";
    else if (!currentAssigned) {
      status = "current";
      currentAssigned = true;
    } else status = "open";

    const hint =
      status !== "locked"
        ? null
        : level.unlock_rule === "previous_two_stars"
          ? "先在上一關拿到 2 顆星"
          : "先完成上一關";
    return { id: level.id, stars: own, status, hint };
  });
}

export function adventureLevel(totalStars: number) {
  const level = Math.floor(totalStars / STARS_PER_LEVEL_UP) + 1;
  const toNext = STARS_PER_LEVEL_UP - (totalStars % STARS_PER_LEVEL_UP);
  const progress = (totalStars % STARS_PER_LEVEL_UP) / STARS_PER_LEVEL_UP;
  return { level, toNext, progress };
}

export const LEVEL_TITLES = ["小小探險家", "勇敢探險家", "冒險高手", "傳奇探險家"];
export const levelTitle = (level: number) =>
  LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((level - 1) / 3))];

export type ZoneTheme =
  | "forest" | "cave" | "village" | "castle" | "lake" | "tower" | "boss"
  | "dungeon" | "lab" | "bridge" | "station" | "academy" | "archive" | "workshop" | "practice";

export const ZONE_THEMES: { key: ZoneTheme; label: string }[] = [
  { key: "forest", label: "森林" },
  { key: "cave", label: "洞穴" },
  { key: "village", label: "村莊" },
  { key: "castle", label: "城堡" },
  { key: "lake", label: "湖泊" },
  { key: "tower", label: "高塔" },
  { key: "boss", label: "終極挑戰" },
  { key: "dungeon", label: "地城" },
  { key: "lab", label: "實驗室" },
  { key: "bridge", label: "橋樑" },
  { key: "station", label: "基地" },
  { key: "academy", label: "學院" },
  { key: "archive", label: "檔案館" },
  { key: "workshop", label: "工作坊" },
  { key: "practice", label: "練習區" },
];

export const isZoneTheme = (value: string): value is ZoneTheme =>
  ZONE_THEMES.some((theme) => theme.key === value);

export const ZONE_TEMPLATES: Record<string, { name: string; theme: ZoneTheme }[]> = {
  kids: [
    { name: "Alphabet Forest", theme: "forest" },
    { name: "Phonics Cave", theme: "cave" },
    { name: "Vocabulary Village", theme: "village" },
    { name: "Sentence Castle", theme: "castle" },
    { name: "Listening Lake", theme: "lake" },
    { name: "Reading Tower", theme: "tower" },
    { name: "Final Boss Challenge", theme: "boss" },
  ],
  junior: [
    { name: "Vocabulary Dungeon", theme: "dungeon" },
    { name: "Grammar Lab", theme: "lab" },
    { name: "Sentence Bridge", theme: "bridge" },
    { name: "Reading Forest", theme: "forest" },
    { name: "Listening Station", theme: "station" },
    { name: "Exam Challenge", theme: "boss" },
  ],
  senior: [
    { name: "Vocabulary Academy", theme: "academy" },
    { name: "Grammar Laboratory", theme: "lab" },
    { name: "Reading Archive", theme: "archive" },
    { name: "Cloze Challenge", theme: "tower" },
    { name: "Translation Workshop", theme: "workshop" },
    { name: "Advanced Mission", theme: "boss" },
  ],
};

export const AVATARS = ["explorer", "sailor", "wizard", "astronaut", "ranger", "artist"] as const;
export type AvatarKey = (typeof AVATARS)[number];
export const isAvatar = (value: string): value is AvatarKey =>
  (AVATARS as readonly string[]).includes(value);
