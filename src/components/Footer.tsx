import Link from "next/link";
import { CMYKBar } from "./CMYKBar";

const LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refunds", label: "Refunds" },
  { href: "/contact", label: "Contact" },
];

export function Footer() {
  return (
    <footer className="hairline-t bg-paper mt-auto">
      <div className="container py-10 grid gap-8 md:grid-cols-3">
        <div>
          <div className="font-mono font-bold tracking-tight text-lg">PRINTSWIPE</div>
          <p className="text-sm text-ink/60 mt-2 max-w-xs">
            Skip the queue. Schedule print jobs at on-campus shops, pay online, walk in
            and collect from numbered bins.
          </p>
        </div>

        <nav aria-label="Legal" className="md:col-span-1">
          <div className="smallcaps text-ink/60 mb-3">Information</div>
          <ul className="space-y-2 text-sm">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="hover:text-accent transition-colors min-h-11 inline-flex items-center"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="md:text-right">
          <div className="smallcaps text-ink/60 mb-3">Reach us</div>
          <a
            href="mailto:hello@printswipe.in"
            className="text-sm font-mono hover:text-accent transition-colors break-all"
          >
            hello@printswipe.in
          </a>
        </div>
      </div>

      <div className="hairline-t">
        <CMYKBar height={4} />
      </div>

      <div className="container py-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <p className="text-xs font-mono text-ink/60 num">
          &copy; {new Date().getFullYear()} Printswipe. All rights reserved.
        </p>
        <p className="text-xs font-mono text-ink/60 flex items-center gap-1.5">
          Created with
          <HeartIcon />
          by{" "}
          <a
            href="https://kernelandoak.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors underline-offset-4 hover:underline"
          >
            Kernel &amp; Oak
          </a>
        </p>
      </div>
    </footer>
  );
}

function HeartIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      aria-label="hearts"
      role="img"
      className="text-accent inline-block"
    >
      <path
        d="M6.5 11.6 1.6 6.6a3.1 3.1 0 0 1 4.4-4.4l.5.5.5-.5a3.1 3.1 0 0 1 4.4 4.4Z"
        fill="currentColor"
      />
    </svg>
  );
}
