import { AvatarArt, avatarLabel } from "@/components/adventure/avatar";
import { chooseAvatar } from "@/features/adventure/student-actions";
import { AVATARS, type AvatarKey } from "@/features/adventure/rules";

export function AvatarPicker({ current }: { current: AvatarKey }) {
  return (
    <details className="group">
      <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm font-medium text-navy underline underline-offset-4">
        換頭像
      </summary>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {AVATARS.map((avatar) => (
          <form key={avatar} action={chooseAvatar.bind(null, avatar)}>
            <button
              type="submit"
              aria-pressed={avatar === current}
              aria-label={`選擇${avatarLabel(avatar)}`}
              className={`flex w-full flex-col items-center gap-1 rounded-2xl border-2 p-2 text-xs ${
                avatar === current ? "border-navy bg-sky" : "border-transparent hover:bg-sky/50"
              }`}
            >
              <AvatarArt avatar={avatar} size={56} />
              {avatarLabel(avatar)}
            </button>
          </form>
        ))}
      </div>
    </details>
  );
}
