import type { AvatarKey } from "@/features/adventure/rules";

/** 原創頭像：同一張笑臉，不同帽子與底色。 */
const LOOKS: Record<AvatarKey, { label: string; bg: string; hat: string; band: string; kind: "safari" | "cap" | "wizard" | "helmet" | "beanie" | "beret" }> = {
  explorer: { label: "探險家", bg: "#D9EAF5", hat: "#D8743F", band: "#073f68", kind: "safari" },
  sailor: { label: "水手", bg: "#FFF1CC", hat: "#FFFDF9", band: "#073f68", kind: "cap" },
  wizard: { label: "魔法師", bg: "#E7E1F5", hat: "#4B3F8F", band: "#F2B629", kind: "wizard" },
  astronaut: { label: "太空人", bg: "#DDEFF0", hat: "#E8EEF2", band: "#4F8FB8", kind: "helmet" },
  ranger: { label: "森林巡守員", bg: "#E3F1E9", hat: "#3F8F55", band: "#F2B629", kind: "beanie" },
  artist: { label: "小畫家", bg: "#FCEDE6", hat: "#B8583C", band: "#FFFDF9", kind: "beret" },
};

export const avatarLabel = (key: AvatarKey) => LOOKS[key].label;

export function AvatarArt({ avatar, size = 96 }: { avatar: AvatarKey; size?: number }) {
  const look = LOOKS[avatar] ?? LOOKS.explorer;
  return (
    <svg width={size} height={size} viewBox="0 0 112 112" aria-hidden>
      <circle cx="56" cy="56" r="54" fill={look.bg} />
      <ellipse cx="56" cy="70" rx="30" ry="28" fill="#F3C9A0" />
      <circle cx="45" cy="66" r="4" fill="#16283a" />
      <circle cx="67" cy="66" r="4" fill="#16283a" />
      <path d="M47 80 Q56 88 65 80" stroke="#16283a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <circle cx="38" cy="77" r="5" fill="#F29C86" opacity="0.7" />
      <circle cx="74" cy="77" r="5" fill="#F29C86" opacity="0.7" />
      {look.kind === "safari" ? (
        <g>
          <path d="M20 50 Q56 34 92 50 L86 56 Q56 46 26 56 Z" fill="#B8583C" />
          <path d="M32 50 Q34 22 56 20 Q78 22 80 50 Z" fill={look.hat} />
          <rect x="33" y="42" width="46" height="7" rx="3" fill={look.band} />
        </g>
      ) : null}
      {look.kind === "cap" ? (
        <g>
          <path d="M28 50 Q30 26 56 24 Q82 26 84 50 Z" fill={look.hat} stroke="#073f68" strokeWidth="3" />
          <rect x="28" y="44" width="56" height="8" rx="4" fill={look.band} />
          <circle cx="56" cy="34" r="4" fill="#B8583C" />
        </g>
      ) : null}
      {look.kind === "wizard" ? (
        <g>
          <path d="M30 50 L56 6 L82 50 Z" fill={look.hat} />
          <rect x="26" y="46" width="60" height="8" rx="4" fill={look.band} />
          <circle cx="60" cy="28" r="3.5" fill={look.band} />
        </g>
      ) : null}
      {look.kind === "helmet" ? (
        <g>
          <path d="M22 66 Q22 22 56 20 Q90 22 90 66" fill="none" stroke={look.hat} strokeWidth="9" />
          <path d="M22 66 Q22 22 56 20 Q90 22 90 66" fill="none" stroke={look.band} strokeWidth="2.5" />
          <circle cx="56" cy="20" r="5" fill={look.band} />
        </g>
      ) : null}
      {look.kind === "beanie" ? (
        <g>
          <path d="M30 52 Q30 22 56 22 Q82 22 82 52 Z" fill={look.hat} />
          <rect x="28" y="46" width="56" height="9" rx="4" fill="#2F6E40" />
          <circle cx="56" cy="20" r="6" fill={look.band} />
        </g>
      ) : null}
      {look.kind === "beret" ? (
        <g>
          <ellipse cx="54" cy="42" rx="30" ry="12" fill={look.hat} />
          <path d="M60 30 l6 -8" stroke={look.hat} strokeWidth="4" strokeLinecap="round" />
          <circle cx="82" cy="52" r="4" fill="#F2B629" />
          <circle cx="88" cy="60" r="3" fill="#4F8FB8" />
        </g>
      ) : null}
    </svg>
  );
}
