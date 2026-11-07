export type RendererKey = "match_pairs" | "single_choice" | "text_input" | "order_chunks";

export type QuestionRow = {
  id: string;
  /** 錯題複習局跨單元，作答時用題目本身的單元記錄。 */
  unit_id?: string;
  topic_id: string | null;
  content_type: string;
  content: Record<string, unknown>;
  answer_key: Record<string, unknown>;
  explanation_zh: string | null;
};

/** 傳給瀏覽器的內容，絕不可包含正確答案的識別資料。 */
export type PublicRound =
  | { renderer: "match_pairs"; left: string; rights: string[] }
  | {
      renderer: "single_choice";
      prompt: string;
      speak?: string;
      /** 老師上傳的音檔檔名；有音檔時取代內建語音。 */
      audio?: string;
      /** 題目圖片（例如看圖選單字）。 */
      image?: string;
      /** 選項以大字顯示（例如字母）。 */
      large?: boolean;
      options: { id: string; label: string; image?: string }[];
    }
  | { renderer: "text_input"; prompt: string; speak?: string; audio?: string; image?: string; length: number }
  | {
      renderer: "order_chunks";
      prompt: string;
      instruction?: string;
      /** 已打亂順序的詞塊；id 只用來追蹤點選，不代表正確順序。 */
      chunks: { id: string; label: string }[];
    };

export type GradingKey = {
  answer: string;
  display: string;
  /** 其他可接受的答案（已正規化）。 */
  accepted?: string[];
  /** Final Boss：這一題實際使用的遊戲。 */
  game?: string;
};

export type BuiltRound = { publicRound: PublicRound; gradingKey: GradingKey };

export type GameDefinition = {
  key: string;
  label: string;
  description: string;
  /** mixed：一局內每題的介面不同（Final Boss）。 */
  renderer: RendererKey | "mixed";
  contentTypes: string[];
  stages: string[];
  minQuestions: number;
  /** 同一局內不重複出現的識別值。 */
  identity: (question: QuestionRow) => string;
  /** 題目是否適用這個遊戲。 */
  accepts: (question: QuestionRow) => boolean;
  buildRounds: (questions: QuestionRow[], pool: QuestionRow[], random: () => number) => BuiltRound[];
  grade: (response: string, key: GradingKey) => boolean;
};
