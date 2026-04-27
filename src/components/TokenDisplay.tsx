import { RegistrationMark } from "./RegistrationMark";
import { cn } from "@/lib/utils";

const SIZES = {
  hero: { token: "text-[120px] leading-[0.95]", reg: 16, pad: "p-8" },
  md:   { token: "text-5xl leading-[0.95]",     reg: 12, pad: "p-5" },
  sm:   { token: "text-2xl",                    reg: 10, pad: "p-3" },
} as const;

export function TokenDisplay({
  token,
  size = "md",
  className,
}: {
  token: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <div className={cn("relative hairline bg-paper inline-flex flex-col items-center justify-center", s.pad, className)}>
      <RegistrationMark size={s.reg} className="absolute top-2 left-2 text-ink/60" />
      <RegistrationMark size={s.reg} className="absolute top-2 right-2 text-ink/60" />
      <RegistrationMark size={s.reg} className="absolute bottom-2 left-2 text-ink/60" />
      <RegistrationMark size={s.reg} className="absolute bottom-2 right-2 text-ink/60" />
      <span className="smallcaps text-ink/60 mb-2">Token</span>
      <span className={cn("font-mono font-bold num text-ink", s.token)}>{token}</span>
    </div>
  );
}
