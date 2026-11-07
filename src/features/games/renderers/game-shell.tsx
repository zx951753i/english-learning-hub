"use client";

import { ArrowRight, Check, Volume2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { submitAnswer, type AnswerResult } from "@/features/games/engine";
import { canSpeak, speakEnglish } from "@/features/games/speak";
import type { PublicRound } from "@/features/games/types";

export type PlayItem = {
  id: string;
  round: PublicRound;
  answered?: { isCorrect: boolean };
};

type Props = {
  sessionId: string;
  title: string;
  items: PlayItem[];
  /** 題目用到的圖片與音檔：檔名 → 限時連結。 */
  media: Record<string, string>;
};

type Sound = { speak?: string; audio?: string };

/** 這一題要播放的聲音：老師上傳的音檔優先，沒有時用內建語音。 */
const soundOf = (round: PublicRound | undefined): Sound =>
  round && (round.renderer === "single_choice" || round.renderer === "text_input")
    ? { speak: round.speak, audio: round.audio }
    : {};

/** 必須在點擊當下呼叫（iPhone 限制）。回傳是否有可播放的聲音。 */
function playSound(sound: Sound, media: Record<string, string>) {
  const url = sound.audio ? media[sound.audio] : undefined;
  if (url) {
    const player = new Audio(url);
    player.play().catch(() => {
      if (sound.speak) speakEnglish(sound.speak);
    });
    return true;
  }
  return sound.speak ? speakEnglish(sound.speak) : false;
}

type Feedback = Extract<AnswerResult, { ok: true }>;

function ListenButton({ sound, media }: { sound: Sound; media: Record<string, string> }) {
  const hasAudio = Boolean(sound.audio && media[sound.audio]);
  const supported = useSyncExternalStore(
    () => () => {},
    canSpeak,
    () => true,
  );
  return (
    <div className="space-y-1">
      <Button variant="secondary" onClick={() => playSound(sound, media)} className="text-lg">
        <Volume2 size={22} aria-hidden />
        聽發音
      </Button>
      {hasAudio || supported ? (
        <p className="text-sm text-muted">沒有聲音時，請確認手機沒有開啟靜音並調高音量。</p>
      ) : (
        <p className="text-sm text-danger">這個瀏覽器不支援語音朗讀。</p>
      )}
    </div>
  );
}

function ChunkBoard({
  chunks,
  disabled,
  onSubmit,
  pending,
}: {
  chunks: { id: string; label: string }[];
  disabled: boolean;
  pending: boolean;
  onSubmit: (sentence: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const label = (id: string) => chunks.find((chunk) => chunk.id === id)?.label ?? "";
  const left = chunks.filter((chunk) => !picked.includes(chunk.id));
  const complete = picked.length === chunks.length;

  return (
    <div className="space-y-4">
      <div
        aria-label="我排的句子"
        className="flex min-h-20 flex-wrap content-start gap-2 rounded-card border-2 border-dashed border-sky-deep bg-white p-3"
      >
        {picked.length === 0 ? <span className="self-center text-muted">依序點下面的詞塊</span> : null}
        {picked.map((id) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => setPicked((current) => current.filter((item) => item !== id))}
            aria-label={`移除 ${label(id)}`}
            className="min-h-12 rounded-control border-2 border-navy bg-sky px-3.5 text-xl font-medium text-navy"
          >
            {label(id)}
          </button>
        ))}
      </div>
      <div aria-label="詞塊" className="flex flex-wrap gap-2">
        {left.map((chunk) => (
          <button
            key={chunk.id}
            type="button"
            disabled={disabled}
            onClick={() => setPicked((current) => [...current, chunk.id])}
            className="min-h-12 rounded-control border-2 border-line bg-paper px-3.5 text-xl font-medium hover:border-sky-deep"
          >
            {chunk.label}
          </button>
        ))}
      </div>
      {!disabled ? (
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => onSubmit(picked.map(label).join(" "))}
            disabled={pending || !complete}
            className="w-full sm:w-auto"
          >
            {pending ? "批改中…" : "送出答案"}
          </Button>
          {picked.length > 0 ? (
            <Button variant="ghost" onClick={() => setPicked([])}>
              重來
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FeedbackPanel({ feedback, onNext }: { feedback: Feedback; onNext: () => void }) {
  // 作答後唸出正確答案。電腦會自動播放；iPhone 若擋下，可按「再聽一次」。
  useEffect(() => {
    if (feedback.speakAfter) speakEnglish(feedback.speakAfter);
  }, [feedback.speakAfter]);

  return (
    <div
      role="status"
      className={`space-y-2 rounded-card p-4 ${feedback.isCorrect ? "bg-ok-soft" : "bg-danger-soft"}`}
    >
      <p className={`flex items-center gap-2 text-lg font-semibold ${feedback.isCorrect ? "text-ok" : "text-danger"}`}>
        {feedback.isCorrect ? <Check aria-hidden /> : <X aria-hidden />}
        {feedback.isCorrect ? "答對了！" : "再接再厲"}
      </p>
      {!feedback.isCorrect ? <p>正確答案：{feedback.correctAnswer}</p> : null}
      {feedback.explanation ? <p className="text-sm text-muted">{feedback.explanation}</p> : null}
      <div className="flex flex-wrap gap-2">
        {feedback.speakAfter ? (
          <Button variant="secondary" onClick={() => speakEnglish(feedback.speakAfter!)}>
            <Volume2 size={18} aria-hidden />
            再聽一次
          </Button>
        ) : null}
        <Button onClick={onNext} autoFocus className="w-full sm:w-auto">
          {feedback.finished ? "看成績" : "下一題"}
          <ArrowRight size={18} aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function useAnswer(sessionId: string) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = performance.now();
  }, []);

  function send(itemId: string, response: string, done: (result: Feedback) => void) {
    setError("");
    const elapsed = performance.now() - startedAt.current;
    startTransition(async () => {
      const result = await submitAnswer(sessionId, itemId, response, elapsed);
      if (result.ok) {
        startedAt.current = performance.now();
        done(result);
      } else {
        setError(result.error);
      }
    });
  }
  return { send, pending, error };
}

function SequentialGame({ sessionId, items, media }: Omit<Props, "title">) {
  const router = useRouter();
  const queue = items.filter((item) => !item.answered);
  const done = items.length - queue.length;
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [selected, setSelected] = useState("");
  const [typed, setTyped] = useState("");
  const { send, pending, error } = useAnswer(sessionId);

  const item = queue[index];
  const sound = soundOf(item?.round);

  // 第一題自動播放：電腦可用，iPhone 會擋下，需按「聽發音」。之後的題目在按「下一題」時播放。
  useEffect(() => {
    if (index === 0) playSound(sound, media);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在進入第一題時播放一次
  }, [index]);

  useEffect(() => {
    if (!item) router.replace(`/play/${sessionId}/result`);
  }, [item, router, sessionId]);

  if (!item || item.round.renderer === "match_pairs") return null;
  const round = item.round;

  function next() {
    if (feedback?.finished) {
      router.replace(`/play/${sessionId}/result`);
      return;
    }
    playSound(soundOf(queue[index + 1]?.round), media);
    setFeedback(null);
    setSelected("");
    setTyped("");
    setIndex((value) => value + 1);
  }

  return (
    <div className="space-y-5">
      <Progress current={done + index + (feedback ? 1 : 0)} total={items.length} />
      {round.renderer === "order_chunks" ? (
        <>
          <p className="text-2xl font-medium text-navy">{round.prompt}</p>
          {round.instruction ? <p className="text-muted">{round.instruction}</p> : null}
          <ChunkBoard
            key={item.id}
            chunks={round.chunks}
            pending={pending}
            disabled={pending || Boolean(feedback)}
            onSubmit={(sentence) => send(item.id, sentence, setFeedback)}
          />
        </>
      ) : round.renderer === "single_choice" ? (
        <>
          <p className="text-xl font-medium text-navy">{round.prompt}</p>
          {round.image && media[round.image] ? (
            // eslint-disable-next-line @next/next/no-img-element -- 私有限時連結，不經過圖片最佳化
            <img src={media[round.image]} alt="題目圖片" className="mx-auto size-48 rounded-card object-contain" />
          ) : null}
          {round.speak || round.audio ? <ListenButton sound={sound} media={media} /> : null}
          <div className="grid grid-cols-2 gap-3">
            {round.options.map((option) => {
              const url = option.image ? media[option.image] : undefined;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={pending || Boolean(feedback)}
                  aria-pressed={selected === option.id}
                  onClick={() => {
                    setSelected(option.id);
                    send(item.id, option.id, setFeedback);
                  }}
                  className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-card border-2 bg-paper p-3 font-medium transition-colors disabled:cursor-default ${
                    round.large ? "text-4xl" : "text-lg"
                  } ${
                    selected === option.id ? "border-navy" : "border-line hover:border-sky-deep"
                  }`}
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 私有限時連結，不經過圖片最佳化
                    <img src={url} alt={option.label} className="size-28 object-contain" />
                  ) : (
                    option.label
                  )}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (typed.trim()) send(item.id, typed, setFeedback);
          }}
        >
          {round.image && media[round.image] ? (
            // eslint-disable-next-line @next/next/no-img-element -- 私有限時連結，不經過圖片最佳化
            <img src={media[round.image]} alt="" className="size-40 rounded-card object-contain" />
          ) : null}
          <p className="text-2xl font-medium text-navy">{round.prompt}</p>
          {round.speak || round.audio ? <ListenButton sound={sound} media={media} /> : null}
          <label className="block space-y-1.5">
            <span className="font-medium">拼出單字（{round.length} 個字元）</span>
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              disabled={pending || Boolean(feedback)}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              className="min-h-14 w-full rounded-control border-2 border-line bg-white px-4 text-2xl tracking-wide"
            />
          </label>
          {!feedback ? (
            <Button type="submit" disabled={pending || !typed.trim()} className="w-full sm:w-auto">
              {pending ? "批改中…" : "送出答案"}
            </Button>
          ) : null}
        </form>
      )}
      {error ? <Notice>{error}</Notice> : null}
      {feedback ? <FeedbackPanel feedback={feedback} onNext={next} /> : null}
    </div>
  );
}

function MatchingGame({ sessionId, items }: Omit<Props, "title" | "media">) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { isCorrect: boolean; right: string }>>({});
  const [finished, setFinished] = useState(false);
  const { send, pending, error } = useAnswer(sessionId);

  const rights = items[0].round.renderer === "match_pairs" ? items[0].round.rights : [];
  const used = new Set(Object.values(results).map((result) => result.right));
  const previouslyAnswered = items.filter((item) => item.answered).length;

  function choose(right: string) {
    if (!activeId) return;
    const itemId = activeId;
    setActiveId(null);
    send(itemId, right, (result) => {
      setResults((current) => ({
        ...current,
        [itemId]: { isCorrect: result.isCorrect, right: result.correctAnswer },
      }));
      if (result.finished) setFinished(true);
    });
  }

  return (
    <div className="space-y-5">
      <Progress current={previouslyAnswered + Object.keys(results).length} total={items.length} />
      <p className="text-xl font-medium text-navy">先點大寫字母，再點對應的小寫字母</p>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          {items.map((item) => {
            if (item.round.renderer !== "match_pairs") return null;
            const result = results[item.id];
            const closed = Boolean(result || item.answered);
            return (
              <button
                key={item.id}
                type="button"
                disabled={closed || pending}
                aria-pressed={activeId === item.id}
                aria-label={`大寫 ${item.round.left}`}
                onClick={() => setActiveId(item.id)}
                className={`flex min-h-16 w-full items-center justify-center gap-2 rounded-card border-2 bg-paper text-3xl font-semibold ${
                  activeId === item.id ? "border-navy bg-sky" : "border-line"
                } ${result?.isCorrect ? "border-ok bg-ok-soft" : ""} ${
                  result && !result.isCorrect ? "border-danger bg-danger-soft" : ""
                } ${item.answered ? "opacity-50" : ""}`}
              >
                {item.round.left}
                {result ? <span className="text-xl">→ {result.right}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {rights.map((right) => (
            <button
              key={right}
              type="button"
              disabled={!activeId || pending || used.has(right)}
              aria-label={`小寫 ${right}`}
              onClick={() => choose(right)}
              className={`flex min-h-16 w-full items-center justify-center rounded-card border-2 border-line bg-paper text-3xl font-semibold disabled:cursor-default ${
                used.has(right) ? "opacity-30" : ""
              }`}
            >
              {right}
            </button>
          ))}
        </div>
      </div>
      {error ? <Notice>{error}</Notice> : null}
      {finished ? (
        <Button onClick={() => router.replace(`/play/${sessionId}/result`)} autoFocus className="w-full sm:w-auto">
          看成績
          <ArrowRight size={18} aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}

function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div>
      <p className="mb-1 text-sm text-muted">
        第 {Math.min(current + 1, total)} / {total} 題
      </p>
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="完成進度"
        className="h-2.5 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full bg-navy transition-all" style={{ width: `${(current / total) * 100}%` }} />
      </div>
    </div>
  );
}

export function GameShell({ sessionId, title, items, media }: Props) {
  return (
    <div className="mx-auto w-full max-w-xl space-y-5 px-4 py-6">
      <h1 className="text-2xl">{title}</h1>
      {items[0]?.round.renderer === "match_pairs" ? (
        <MatchingGame sessionId={sessionId} items={items} />
      ) : (
        <SequentialGame sessionId={sessionId} items={items} media={media} />
      )}
    </div>
  );
}
