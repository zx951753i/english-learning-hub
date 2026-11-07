const PATH = "M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z";

/** 星星同時有文字標示，不只靠顏色。 */
export function Stars({ count, size = 18, label = true }: { count: number; size?: number; label?: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${count} 顆星，共 3 顆`} role="img">
      {[0, 1, 2].map((index) => (
        <svg key={index} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
          <path
            d={PATH}
            fill={index < count ? "#F2B629" : "#E6DFD2"}
            stroke={index < count ? "#9A6A00" : "#B9AE9B"}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ))}
      {label ? <span className="ml-1 text-xs text-muted">{count} / 3</span> : null}
    </span>
  );
}

export function StarIcon({ size = 18, filled = true }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d={PATH} fill={filled ? "#F2B629" : "#E6DFD2"} stroke={filled ? "#9A6A00" : "#B9AE9B"} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
