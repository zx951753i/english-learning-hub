export function Notice({
  tone = "danger",
  children,
}: {
  tone?: "danger" | "ok";
  children: React.ReactNode;
}) {
  const style = tone === "ok" ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger";
  return (
    <p role={tone === "danger" ? "alert" : "status"} className={`rounded-control px-3 py-2 text-sm ${style}`}>
      {children}
    </p>
  );
}
