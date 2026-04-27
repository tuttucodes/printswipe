export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 32" className={className} aria-label="Printswipe">
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
}
