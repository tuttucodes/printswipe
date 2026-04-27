import { cn } from "@/lib/utils";

const STEPS = [
  { key: 1, label: "Shop" },
  { key: 2, label: "Time" },
  { key: 3, label: "Files" },
  { key: 4, label: "Setup" },
  { key: 5, label: "Pay" },
];

export function StepIndicator({ current }: { current: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <div aria-label={`Step ${current} of ${STEPS.length}`} className="flex items-center gap-1.5 sm:gap-2">
      {STEPS.map((s) => {
        const done = s.key < current;
        const active = s.key === current;
        return (
          <div key={s.key} className="flex items-center gap-2 flex-1">
            <div
              className={cn(
                "flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 hairline font-mono text-xs num shrink-0",
                done && "bg-ink text-paper",
                active && "bg-accent text-paper border-accent",
                !done && !active && "text-ink/40"
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? "✓" : s.key}
            </div>
            <span
              className={cn(
                "smallcaps hidden sm:inline-block",
                active ? "text-ink" : "text-ink/40"
              )}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
