"use client";

import { createContext, useContext, useRef, useState, useTransition, type ReactNode } from "react";
import { AvatarArt, avatarLabel } from "@/components/adventure/avatar";
import { chooseAvatar } from "@/features/adventure/student-actions";
import { AVATARS, type AvatarKey } from "@/features/adventure/rules";

type Ctx = { avatar: AvatarKey; setAvatar: (avatar: AvatarKey) => void };
const AvatarContext = createContext<Ctx | null>(null);

/** 頭像選擇後立即顯示，背景再存檔；存檔失敗時換回原本的頭像。 */
export function AvatarProvider({ initial, children }: { initial: AvatarKey; children: ReactNode }) {
  const [avatar, setAvatar] = useState(initial);
  return <AvatarContext.Provider value={{ avatar, setAvatar }}>{children}</AvatarContext.Provider>;
}

function useAvatar() {
  const ctx = useContext(AvatarContext);
  if (!ctx) throw new Error("AvatarProvider is missing");
  return ctx;
}

export function CurrentAvatar({ size }: { size: number }) {
  return <AvatarArt avatar={useAvatar().avatar} size={size} />;
}

export function AvatarPicker() {
  const { avatar, setAvatar } = useAvatar();
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();
  const details = useRef<HTMLDetailsElement>(null);

  const pick = (next: AvatarKey) => {
    if (next === avatar) return;
    const previous = avatar;
    setAvatar(next);
    setFailed(false);
    if (details.current) details.current.open = false;
    startTransition(async () => {
      const result = await chooseAvatar(next).catch(() => ({ ok: false }));
      if (!result.ok) {
        setAvatar(previous);
        setFailed(true);
      }
    });
  };

  return (
    <details ref={details} className="group">
      <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm font-medium text-navy underline underline-offset-4">
        換頭像
      </summary>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {AVATARS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => pick(key)}
            aria-pressed={key === avatar}
            aria-label={`選擇${avatarLabel(key)}`}
            className={`flex w-full flex-col items-center gap-1 rounded-2xl border-2 p-2 text-xs ${
              key === avatar ? "border-navy bg-sky" : "border-transparent hover:bg-sky/50"
            }`}
          >
            <AvatarArt avatar={key} size={56} />
            {avatarLabel(key)}
          </button>
        ))}
      </div>
      {failed ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          頭像沒有存成功，請稍後再試。
        </p>
      ) : null}
    </details>
  );
}
