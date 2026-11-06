import { alphabetMatching } from "@/features/games/definitions/alphabet-matching";
import { listenAndChoose } from "@/features/games/definitions/listen-and-choose";
import { wordSpelling } from "@/features/games/definitions/word-spelling";
import type { GameDefinition } from "@/features/games/types";

/** 新增遊戲時，在這裡加入定義，並在 game_types 新增一筆。 */
export const GAME_DEFINITIONS: GameDefinition[] = [alphabetMatching, listenAndChoose, wordSpelling];

export const getGameDefinition = (key: string) =>
  GAME_DEFINITIONS.find((definition) => definition.key === key);
