"use client";

import { ArrowRight, Check, Volume2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { submitAnswer, type AnswerResult } from "@/features/games/engine";
import { speakEnglish } from "@/features/games/speak";
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
  images: Record<string, string>;
};

type Feedback = Extract<AnswerResult, { ok: true }>;

function ListenButton({ text }: { text: string }) {
  return (
    <Button variant="secondary" onClick={() => speakEnglish(text)} className="text-lg">
      <Volume2 size={22} aria-hidden />
      聽發音
    </Button>
  );
}

function FeedbackPanel({ feedback, onNext }: { feedback: Feedback; onNext: () => void }) {
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
      <Button onClick={onNext} autoFocus className="w-full sm:w-auto">
        {feedback.finished ? "看成績" : "下一題"}
        <ArrowRight size={18} aria-hidden />
      </Button>
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

function SequentialGame({ sessionId, items, images }: Omit<Props, "title">) {
  const router = useRouter();
  const queue = items.filter((item) => !item.answered);
  const done = items.length - queue.length;
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [selected, setSelected] = useState("");
  const [typed, setTyped] = useState("");
  const { send, pending, error } = useAnswer(sessionId);

  const item = queue[index];
  const speak = item?.round.renderer !== "match_pairs" ? item?.round.speak : undefined;

  useEffect(() => {
    if (speak) speakEnglish(speak);
  }, [speak]);

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
    setFeedback(null);
    setSelected("");
    setTyped("");
    setIndex((value) => value + 1);
  }

  return (
    <div className="space-y-5">
      <Progress current={done + index + (feedback ? 1 : 0)} total={items.length} />
      {round.renderer === "single_choice" ? (
        <>
          <p className="text-xl font-medium text-navy">{round.prompt}</p>
          {round.speak ? <ListenButton text={round.speak} /> : null}
          <div className="grid grid-cols-2 gap-3">
            {round.options.map((option) => {
              const url = option.image ? images[option.image] : undefined;
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
                  className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-card border-2 bg-paper p-3 text-lg font-medium transition-colors disabled:cursor-default ${
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
          {round.image && images[round.image] ? (
            // eslint-disable-next-line @next/next/no-img-element -- 私有限時連結，不經過圖片最佳化
            <img src={images[round.image]} alt="" className="size-40 rounded-card object-contain" />
          ) : null}
          <p className="text-2xl font-medium text-navy">{round.prompt}</p>
          {round.speak ? <ListenButton text={round.speak} /> : null}
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

function MatchingGame({ sessionId, items }: Omit<Props, "title" | "images">) {
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

export function GameShell({ sessionId, title, items, images }: Props) {
  return (
    <div className="mx-auto w-full max-w-xl space-y-5 px-4 py-6">
      <h1 className="text-2xl">{title}</h1>
      {items[0]?.round.renderer === "match_pairs" ? (
        <MatchingGame sessionId={sessionId} items={items} />
      ) : (
        <SequentialGame sessionId={sessionId} items={items} images={images} />
      )}
    </div>
  );
}
