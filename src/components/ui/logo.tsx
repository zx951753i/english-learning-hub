export function Logo({ light = false }: { light?: boolean }) {
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
        className={`font-serif text-lg font-semibold leading-tight ${light ? "text-cream" : "text-navy"}`}
      >
        English Learning Hub
      </span>
    </span>
  );
}
