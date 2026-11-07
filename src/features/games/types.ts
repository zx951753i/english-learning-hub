export type RendererKey = "match_pairs" | "single_choice" | "text_input";

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
      options: { id: string; label: string; image?: string }[];
    }
  | { renderer: "text_input"; prompt: string; speak?: string; image?: string; length: number };

export type GradingKey = { answer: string; display: string };

export type BuiltRound = { publicRound: PublicRound; gradingKey: GradingKey };

export type GameDefinition = {
  key: string;
  label: string;
  description: string;
  renderer: RendererKey;
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
