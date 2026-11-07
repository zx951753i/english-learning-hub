/** 原創島嶼插畫；未開放的島以灰階顯示。 */
export function IslandArt({ slug, open }: { slug: string; open: boolean }) {
  if (!open) {
    return (
      <svg viewBox="0 0 300 170" className="block h-auto w-full bg-[#D6DEE3]" aria-hidden>
        <path d="M0 128 Q40 118 80 128 T160 128 T240 128 T300 128 V170 H0 Z" fill="#B7C6CF" />
        {slug === "senior" ? (
          <g>
            <path d="M50 132 Q90 96 150 94 Q214 96 252 132 Z" fill="#C9C0B1" />
            <path d="M104 104 L150 80 L196 104 Z" fill="#8C8478" />
            <rect x="110" y="104" width="80" height="24" fill="#A99F91" />
            <rect x="120" y="108" width="8" height="20" fill="#E8E1D4" />
            <rect x="146" y="108" width="8" height="20" fill="#E8E1D4" />
            <rect x="172" y="108" width="8" height="20" fill="#E8E1D4" />
          </g>
        ) : (
          <g>
            <path d="M40 132 L84 74 L120 92 L158 58 L206 88 L262 132 Z" fill="#A99F91" />
            <path d="M128 132 V100 Q150 80 172 100 V132 Z" fill="#6E6559" />
            <rect x="186" y="70" width="4" height="26" fill="#6E6559" />
            <path d="M190 70 L210 76 L190 82 Z" fill="#8C8478" />
          </g>
        )}
      </svg>
    );
  }
  if (slug === "kids") {
    return (
      <svg viewBox="0 0 300 170" className="block h-auto w-full bg-[#BFDDF0]" aria-hidden>
        <circle cx="250" cy="36" r="20" fill="#F2B629" />
        <path d="M0 128 Q40 118 80 128 T160 128 T240 128 T300 128 V170 H0 Z" fill="#9CC9E6" />
        <path d="M42 132 Q70 76 150 72 Q236 76 262 132 Z" fill="#F3D9A4" />
        <path d="M62 126 Q90 92 150 88 Q214 92 240 126 Z" fill="#7CC17E" />
        <rect x="88" y="78" width="8" height="34" rx="3" fill="#8A5A3B" />
        <circle cx="92" cy="72" r="18" fill="#4FA35F" />
        <rect x="204" y="80" width="8" height="30" rx="3" fill="#8A5A3B" />
        <circle cx="208" cy="74" r="16" fill="#5BB06B" />
        <path d="M132 108 V86 L150 72 L168 86 V108 Z" fill="#FFFDF9" stroke="#B8583C" strokeWidth="3" />
        <path d="M126 88 L150 66 L174 88" fill="none" stroke="#B8583C" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="144" y="94" width="12" height="14" rx="2" fill="#073f68" />
        <ellipse cx="60" cy="40" rx="12" ry="15" fill="#E86F5A" />
        <path d="M60 55 L60 70" stroke="#5b6b7a" strokeWidth="1.5" />
      </svg>
    );
  }
  if (slug === "junior") {
    return (
      <svg viewBox="0 0 300 170" className="block h-auto w-full bg-[#C8DDEA]" aria-hidden>
        <path d="M0 128 Q40 118 80 128 T160 128 T240 128 T300 128 V170 H0 Z" fill="#8DB8D2" />
        <path d="M40 132 L84 74 L120 92 L158 58 L206 88 L262 132 Z" fill="#A8946F" />
        <path d="M128 132 V100 Q150 80 172 100 V132 Z" fill="#073f68" />
        <rect x="186" y="70" width="4" height="26" fill="#5a4a33" />
        <path d="M190 70 L210 76 L190 82 Z" fill="#B8583C" />
        <circle cx="140" cy="112" r="3" fill="#F2B629" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 300 170" className="block h-auto w-full bg-[#D9E4EC]" aria-hidden>
      <path d="M0 128 Q40 118 80 128 T160 128 T240 128 T300 128 V170 H0 Z" fill="#A9C2D3" />
      <path d="M50 132 Q90 96 150 94 Q214 96 252 132 Z" fill="#E4DCCB" />
      <path d="M104 104 L150 80 L196 104 Z" fill="#073f68" />
      <rect x="110" y="104" width="80" height="24" fill="#FFFDF9" stroke="#073f68" strokeWidth="2" />
      <rect x="120" y="108" width="8" height="20" fill="#4F8FB8" />
      <rect x="146" y="108" width="8" height="20" fill="#4F8FB8" />
      <rect x="172" y="108" width="8" height="20" fill="#4F8FB8" />
    </svg>
  );
}
