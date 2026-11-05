const tones = {
  navy: "bg-sky text-navy",
  ok: "bg-ok-soft text-ok",
  muted: "bg-line/60 text-muted",
};

export function Badge({ tone = "navy", children }: { tone?: keyof typeof tones; children: React.ReactNode }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm ${tones[tone]}`}>
      {children}
    </span>
  );
}
