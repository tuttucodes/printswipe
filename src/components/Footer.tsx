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
    <footer className="bg-ink text-paper mt-auto border-t border-ink/10">
      <div className="container py-16 grid gap-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="font-serif font-bold tracking-tight text-3xl mb-4">PrintSwipe</div>
          <p className="text-sm text-paper/60 max-w-sm leading-relaxed">
            Skip the queue. Schedule print jobs at on-campus shops, pay online, walk in
            and collect from numbered bins.
          </p>
        </div>

        <nav aria-label="Legal" className="md:col-span-1">
          <div className="text-xs font-mono text-paper/40 uppercase tracking-widest mb-4">Information</div>
          <ul className="space-y-3 text-sm">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-paper/70 hover:text-accent transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="md:col-span-1">
          <div className="text-xs font-mono text-paper/40 uppercase tracking-widest mb-4">Reach us</div>
          <a
            href="mailto:hello@printswipe.in"
            className="text-sm text-paper/70 hover:text-accent transition-colors break-all"
          >
            hello@printswipe.in
          </a>
        </div>
      </div>

      <div className="border-t border-paper/10">
        <div className="container py-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <p className="text-sm text-paper/40">
            &copy; {new Date().getFullYear()} Printswipe. All rights reserved.
          </p>
          <p className="text-sm text-paper/40 flex items-center gap-1.5">
            Created with
            <HeartIcon />
            by{" "}
            <a
              href="https://kernelandoak.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-paper/70 hover:text-accent transition-colors"
            >
              Kernel &amp; Oak
            </a>
          </p>
        </div>
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
