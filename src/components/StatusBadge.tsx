import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/types";

const COLORS: Record<JobStatus, string> = {
  PENDING_PAYMENT: "text-ink/60 border-ink/30",
  SCHEDULED: "text-status-scheduled border-status-scheduled/50",
  BUNDLED: "text-status-bundled border-status-bundled/50",
  PRINTED: "text-status-printed border-status-printed/50",
  READY: "text-status-ready border-status-ready/50",
  COLLECTED: "text-status-collected border-status-collected/50",
  EXPIRED: "text-status-failed border-status-failed/50",
  FAILED: "text-status-failed border-status-failed/50",
  REFUNDED: "text-status-collected border-status-collected/50",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={cn("smallcaps inline-block px-2 py-0.5 border-[1.5px] font-mono", COLORS[status])}>
      {status.replace("_", " ")}
    </span>
  );
}
