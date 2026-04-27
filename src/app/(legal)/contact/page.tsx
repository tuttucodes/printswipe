import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contact · Printswipe" };

export default function ContactPage() {
  return (
    <article className="space-y-6">
      <div>
        <div className="smallcaps text-ink/60">Get in touch</div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mt-2">Contact</h1>
      </div>

      <div className="hairline p-6 space-y-4">
        <div>
          <div className="smallcaps text-ink/60 mb-1">General + support</div>
          <a
            href="mailto:hello@printswipe.in"
            className="font-mono text-lg hover:text-accent transition-colors"
          >
            hello@printswipe.in
          </a>
        </div>
        <div>
          <div className="smallcaps text-ink/60 mb-1">Merchants + partnerships</div>
          <a
            href="mailto:partners@printswipe.in"
            className="font-mono text-lg hover:text-accent transition-colors"
          >
            partners@printswipe.in
          </a>
        </div>
        <div>
          <div className="smallcaps text-ink/60 mb-1">Press</div>
          <a
            href="mailto:press@printswipe.in"
            className="font-mono text-lg hover:text-accent transition-colors"
          >
            press@printswipe.in
          </a>
        </div>
      </div>

      <div className="hairline p-6">
        <div className="smallcaps text-ink/60 mb-2">Response time</div>
        <p className="text-sm text-ink/80">
          We aim to reply within 48 working hours. Print jobs that are stuck or failing are
          prioritised — include your token (e.g. <span className="font-mono">A047</span>) and
          the shop name.
        </p>
      </div>

      <div className="hairline p-6">
        <div className="smallcaps text-ink/60 mb-2">Address</div>
        <p className="text-sm font-mono leading-relaxed">
          Printswipe<br />
          Chennai, Tamil Nadu, India
        </p>
      </div>
    </article>
  );
}
