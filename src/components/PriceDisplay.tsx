import { cn } from "@/lib/utils";

const SIZES = {
  hero: "text-5xl",
  md: "text-2xl",
  sm: "text-base",
} as const;

export function PriceDisplay({
  paise,
  size = "md",
  className,
}: {
  paise: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const r = (paise / 100).toFixed(2);
  return (
    <span className={cn("font-mono num font-bold tracking-tight", SIZES[size], className)}>
      <span className="text-ink/50">₹</span>
      <span>{r}</span>
    </span>
  );
}
