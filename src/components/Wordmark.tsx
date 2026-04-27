import Link from "next/link";

interface WordmarkProps {
  className?: string;
  /** Link target. Pass null to render plain SVG (e.g. inside merchant sidebar). */
  href?: string | null;
}

export function Wordmark({ className = "", href = "/" }: WordmarkProps) {
  const svg = (
    <svg viewBox="0 0 240 32" className={className} aria-label="Printswipe — home">
      <text
        x="0"
        y="24"
        fontFamily="JetBrains Mono, ui-monospace, monospace"
        fontWeight="700"
        fontSize="22"
        letterSpacing="2"
        fill="currentColor"
      >
        PRINTSWIPE
      </text>
      <rect x="206" y="6" width="6" height="20" fill="#EF3340" />
    </svg>
  );
  if (!href) return svg;
  return (
    <Link href={href} aria-label="Printswipe home" className="inline-block">
      {svg}
    </Link>
  );
}
