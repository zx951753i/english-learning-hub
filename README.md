# English Learning Hub

老師用教材帶學生課後自學的英文平台。目前完成 Phase 3：登入、權限、學生與班級、教材與題庫、媒體庫、遊戲引擎與前三款遊戲。

## 技術

Next.js 16、TypeScript、Tailwind CSS、Lucide、Supabase（Auth、Postgres、RLS）、Vercel。

## 本機開發

```bash
npm install
cp .env.example .env.local   # 填入 Supabase 設定
npm run dev
```

資料庫變更放在 `supabase/migrations/`，依檔名順序執行。
第一位老師用 `node --env-file=.env.local scripts/create-teacher.mjs <帳號> <顯示名稱>` 建立。

## 檢查

```bash
npm run check          # lint、型別、單元與 RLS 測試、production build
npx playwright test    # 端對端流程，需要測試用 Supabase，見 playwright.config.ts
```

## 新增遊戲

在 `src/features/games/definitions/` 新增定義，加入 `registry.ts`，並在 `game_types` 新增一筆。
`publicRound` 會送到瀏覽器，不可放入答案；`gradingKey` 只留在伺服器。

## 規則

- 學生與班級資料的權限由 RLS 把關，不只靠畫面隱藏。
- `SUPABASE_SECRET_KEY` 只在伺服器使用，且必須先通過 `requireTeacher()`。
- 新資料表必須啟用 RLS，並在 `tests/rls.test.ts` 加上測試。
- 不放假資料；教材與題目只使用老師提供或確認的內容。
