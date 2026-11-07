/** compact：窄螢幕只顯示「E」圖示，空間不夠時使用。 */
export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden
        className={`flex size-9 items-center justify-center rounded-[10px] font-serif text-xl font-semibold ${
          light ? "bg-cream text-navy" : "bg-navy text-cream"
        }`}
      >
        E
      </span>
      <span
        className={`font-serif text-lg font-semibold leading-tight ${light ? "text-cream" : "text-navy"} ${
          compact ? "hidden min-[400px]:inline" : ""
        }`}
      >
        English Learning Hub
      </span>
    </span>
  );
}
