import { describe, expect, it } from "vitest";
import { finalBoss } from "@/features/games/definitions/final-boss";
import { listenAndChoose } from "@/features/games/definitions/listen-and-choose";
import { phonicsSoundMatch } from "@/features/games/definitions/phonics-sound-match";
import { pictureVocabulary } from "@/features/games/definitions/picture-vocabulary";
import { normalizeSentence, sentenceBuilder } from "@/features/games/definitions/sentence-builder";
import { wordSpelling } from "@/features/games/definitions/word-spelling";
import type { QuestionRow } from "@/features/games/types";

const row = (id: string, content_type: string, content: Record<string, unknown>, answer_key = {}): QuestionRow => ({
  id,
  topic_id: null,
  content_type,
  content,
  answer_key,
  explanation_zh: null,
});
const vocab = (word: string, meaning: string, image = "", audio = "") =>
  row(word, "vocab_item", { word, meaning_zh: meaning, image, audio });
const phonics = (letter: string, words: string[]) =>
  row(letter, "phonics_item", { letter, sound: `/${letter}/`, example_words: words });
const sentence = (en: string, chunks: string[], alternatives: string[] = [], instruction = "") =>
  row(en, "sentence_item", { sentence_zh: `中文：${en}`, chunks, instruction }, { answer: en, alternatives });
const seeded = (start = 7) => {
  let seed = start;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
};

describe("Picture Vocabulary", () => {
  const pool = [vocab("cat", "貓", "cat.png"), vocab("dog", "狗", "dog.png"), vocab("hat", "帽子"), vocab("bag", "包包")];
  it("只接受有圖片的單字題", () => {
    expect(pool.filter((q) => pictureVocabulary.accepts(q)).map((q) => q.id)).toEqual(["cat", "dog"]);
  });
  it("題目顯示圖片，選項是英文單字", () => {
    const [round] = pictureVocabulary.buildRounds([pool[0]], pool, seeded());
    expect(round.publicRound).toMatchObject({ renderer: "single_choice", image: "cat.png" });
    if (round.publicRound.renderer !== "single_choice") throw new Error();
    expect(round.publicRound.options.map((o) => o.label).sort()).toEqual(["bag", "cat", "dog", "hat"]);
    expect(round.publicRound.options.every((o) => !o.image)).toBe(true);
    const correct = round.publicRound.options.find((o) => o.label === "cat")!;
    expect(pictureVocabulary.grade(correct.id, round.gradingKey)).toBe(true);
    expect(pictureVocabulary.grade("o9", round.gradingKey)).toBe(false);
  });
});

describe("Phonics Sound Match", () => {
  const pool = [phonics("a", ["cat"]), phonics("b", ["bag"]), phonics("sh", ["ship"]), phonics("t", ["top"]), phonics("m", ["map"])];
  it("播放例字，選項是字母；例字裡有的字母不能當干擾選項", () => {
    for (let seed = 1; seed < 40; seed += 1) {
      const [round] = phonicsSoundMatch.buildRounds([pool[0]], pool, seeded(seed));
      if (round.publicRound.renderer !== "single_choice") throw new Error();
      const labels = round.publicRound.options.map((o) => o.label);
      expect(round.publicRound.speak).toBe("cat");
      expect(labels).toContain("a");
      expect(labels).not.toContain("t");
      expect(new Set(labels).size).toBe(labels.length);
      expect(round.publicRound.large).toBe(true);
    }
  });
  it("批改與顯示", () => {
    const [round] = phonicsSoundMatch.buildRounds([pool[2]], pool, seeded());
    if (round.publicRound.renderer !== "single_choice") throw new Error();
    const correct = round.publicRound.options.find((o) => o.label === "sh")!;
    expect(phonicsSoundMatch.grade(correct.id, round.gradingKey)).toBe(true);
    expect(round.gradingKey.display).toBe("sh /sh/（ship）");
  });
  it("沒有例字的題目不使用", () => {
    expect(phonicsSoundMatch.accepts(phonics("z", []))).toBe(false);
  });
});

describe("Sentence Builder", () => {
  const q = sentence("I like apples.", ["I", "like", "apples."], ["I love apples."]);
  it("詞塊一定被打亂，且不含答案順序以外的資訊", () => {
    for (let seed = 1; seed < 30; seed += 1) {
      const [round] = sentenceBuilder.buildRounds([q], [], seeded(seed));
      if (round.publicRound.renderer !== "order_chunks") throw new Error();
      expect(round.publicRound.chunks.map((c) => c.label)).not.toEqual(["I", "like", "apples."]);
      expect(round.publicRound.chunks.map((c) => c.label).sort()).toEqual(["I", "apples.", "like"]);
      expect(round.publicRound.prompt).toBe("中文：I like apples.");
    }
  });
  it("排對才算對，多餘空白不影響；其他可接受答案也算對", () => {
    const [round] = sentenceBuilder.buildRounds([q], [], seeded());
    expect(sentenceBuilder.grade("I  like apples. ", round.gradingKey)).toBe(true);
    expect(sentenceBuilder.grade("like I apples.", round.gradingKey)).toBe(false);
    expect(sentenceBuilder.grade("I love apples.", round.gradingKey)).toBe(true);
    expect(normalizeSentence("  a   b ")).toBe("a b");
  });
  it("詞塊少於 2 個的題目不使用；有作答指示時一起顯示", () => {
    expect(sentenceBuilder.accepts(sentence("Hi.", ["Hi."]))).toBe(false);
    const [round] = sentenceBuilder.buildRounds([sentence("I am not sad.", ["I", "am not", "sad."], [], "改成否定句")], [], seeded());
    expect(round.publicRound).toMatchObject({ instruction: "改成否定句" });
  });
});

describe("Final Boss Challenge", () => {
  const pool = [
    vocab("cat", "貓", "cat.png"),
    vocab("dog", "狗", "dog.png"),
    vocab("hat", "帽子"),
    vocab("bag", "包包"),
    phonics("a", ["cat"]),
    phonics("b", ["bag"]),
    phonics("sh", ["ship"]),
    sentence("I like cats.", ["I", "like", "cats."]),
    sentence("It is a dog.", ["It", "is", "a dog."]),
  ];
  it("一局裡混合多種遊戲，每題標記使用的遊戲", () => {
    const rounds = finalBoss.buildRounds(pool, pool, seeded());
    const games = rounds.map((round) => round.gradingKey.game);
    expect(new Set(games).size).toBeGreaterThanOrEqual(4);
    expect(games.every(Boolean)).toBe(true);
    expect(rounds.map((r) => r.publicRound.renderer)).toContain("order_chunks");
  });
  it("每題依它的遊戲批改", () => {
    const rounds = finalBoss.buildRounds(pool, pool, seeded(3));
    for (const round of rounds) {
      const key = round.gradingKey;
      if (key.game === "word_spelling") expect(finalBoss.grade(key.display, key)).toBe(true);
      if (key.game === "sentence_builder") expect(finalBoss.grade(key.answer, key)).toBe(true);
      if (key.game === "picture_vocabulary" || key.game === "listen_and_choose" || key.game === "phonics_sound_match") {
        expect(finalBoss.grade(key.answer, key)).toBe(true);
      }
      expect(finalBoss.grade("definitely wrong", key)).toBe(false);
    }
    expect(finalBoss.grade("x", { answer: "x", display: "x", game: "nope" })).toBe(false);
  });
  it("接受單字、自然發音與句子題", () => {
    expect(pool.every((q) => finalBoss.accepts(q))).toBe(true);
    expect(finalBoss.accepts(row("x", "choice_item", { stem: "?" }))).toBe(false);
  });
});

describe("音檔", () => {
  it("有音檔時，聽力類遊戲把檔名放進題目，由畫面優先播放", () => {
    const q = vocab("cat", "貓", "", "cat.mp3");
    const [listen] = listenAndChoose.buildRounds([q], [q, vocab("dog", "狗")], seeded());
    const [spell] = wordSpelling.buildRounds([q], [q], seeded());
    expect(listen.publicRound).toMatchObject({ audio: "cat.mp3", speak: "cat" });
    expect(spell.publicRound).toMatchObject({ audio: "cat.mp3", speak: "cat" });
  });
});

describe("音檔格式判斷", () => {
  const bytes = (...parts: (string | number[])[]) =>
    new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part)));
  it("接受 MP3（ID3 或音框）、M4A、WAV", async () => {
    const { detectMedia } = await import("@/features/media/rules");
    expect(detectMedia(bytes("ID3", [3, 0, 0, 0]))).toMatchObject({ kind: "audio", ext: "mp3" });
    expect(detectMedia(bytes([0xff, 0xfb, 0x90, 0x00]))).toMatchObject({ kind: "audio", ext: "mp3" });
    expect(detectMedia(bytes([0, 0, 0, 0x20], "ftypM4A ", [0, 0, 0, 0]))).toMatchObject({ kind: "audio", ext: "m4a" });
    expect(detectMedia(bytes("RIFF", [0, 0, 0, 0], "WAVEfmt "))).toMatchObject({ kind: "audio", ext: "wav" });
  });
  it("拒絕 HEIC 照片、WebP 不會被當成 WAV、文字檔", async () => {
    const { detectMedia } = await import("@/features/media/rules");
    expect(detectMedia(bytes([0, 0, 0, 0x18], "ftypheic", [0, 0, 0, 0]))).toBeNull();
    expect(detectMedia(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "))).toMatchObject({ kind: "image" });
    expect(detectMedia(bytes("<svg onload=alert(1)>"))).toBeNull();
    expect(detectMedia(bytes([0xff, 0xd8, 0xff, 0xe0]))).toMatchObject({ kind: "image", ext: "jpg" });
  });
});

describe("作答後唸出正確答案", () => {
  it("看圖選字：作答後才唸單字，作答前題目裡沒有發音", () => {
    const pool = [vocab("cat", "貓", "cat.png"), vocab("dog", "狗")];
    const [round] = pictureVocabulary.buildRounds([pool[0]], pool, seeded());
    expect(round.gradingKey.speakAfter).toBe("cat");
    expect(round.publicRound).not.toHaveProperty("speak");
  });
  it("句子重組：作答後唸整句", () => {
    const [round] = sentenceBuilder.buildRounds([sentence("I like apples.", ["I", "like", "apples."])], [], seeded());
    expect(round.gradingKey.speakAfter).toBe("I like apples.");
  });
  it("Final Boss 保留各遊戲的作答後發音", () => {
    const pool = [vocab("cat", "貓", "cat.png"), vocab("dog", "狗", "dog.png"), sentence("I like cats.", ["I", "like", "cats."])];
    const rounds = finalBoss.buildRounds(pool, pool, seeded(5));
    for (const round of rounds) {
      if (round.gradingKey.game === "picture_vocabulary" || round.gradingKey.game === "sentence_builder") {
        expect(round.gradingKey.speakAfter).toBeTruthy();
      }
    }
  });
});

describe("「Aa」寫法的字母", () => {
  it("Ii、Aa 視同單一字母；sh、Ss 以外的寫法照舊", async () => {
    const { baseLetter, isSingleLetter } = await import("@/features/games/letters");
    expect(baseLetter("Ii")).toBe("i");
    expect(baseLetter(" Aa ")).toBe("a");
    expect(baseLetter("sh")).toBe("sh");
    expect(baseLetter("AA")).toBe("aa");
    expect(isSingleLetter("Ii")).toBe(true);
    expect(isSingleLetter("i")).toBe(true);
    expect(isSingleLetter("sh")).toBe(false);
    expect(isSingleLetter("ee")).toBe(false);
  });
  it("Alphabet Matching 可以使用「Ii」格式的題目", async () => {
    const { alphabetMatching } = await import("@/features/games/definitions/alphabet-matching");
    const ii = phonics("Ii", ["insect"]);
    const tt = phonics("Tt", ["top"]);
    expect(alphabetMatching.accepts(ii)).toBe(true);
    const rounds = alphabetMatching.buildRounds([ii, tt], [], seeded());
    expect(rounds.map((round) => round.publicRound)).toEqual([
      expect.objectContaining({ left: "I" }),
      expect.objectContaining({ left: "T" }),
    ]);
    expect(alphabetMatching.grade("i", rounds[0].gradingKey)).toBe(true);
  });
  it("Phonics Sound Match：例字裡有的字母（Tt 寫法）也不當干擾選項", () => {
    const pool = [phonics("Aa", ["cat"]), phonics("Tt", ["top"]), phonics("Bb", ["bag"]), phonics("Mm", ["map"]), phonics("Ss", ["sun"])];
    for (let seed = 1; seed < 30; seed += 1) {
      const [round] = phonicsSoundMatch.buildRounds([pool[0]], pool, seeded(seed));
      if (round.publicRound.renderer !== "single_choice") throw new Error();
      const labels = round.publicRound.options.map((o) => o.label);
      expect(labels).toContain("Aa");
      expect(labels).not.toContain("Tt");
    }
  });
});
