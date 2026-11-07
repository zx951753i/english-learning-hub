import { Badge } from "@/components/ui/badge";
import type { AssignmentStatus } from "@/features/missions/rules";

const LABELS: Record<AssignmentStatus, string> = { done: "已完成", open: "未完成", overdue: "逾期未完成" };

export function StatusBadge({ status }: { status: AssignmentStatus }) {
  if (status === "overdue") {
    return (
      <span className="inline-block whitespace-nowrap rounded-full bg-danger-soft px-2.5 py-0.5 text-sm text-danger">
        {LABELS.overdue}
      </span>
    );
  }
  return <Badge tone={status === "done" ? "ok" : "muted"}>{LABELS[status]}</Badge>;
}
