import type { Metadata } from "next";

export const metadata: Metadata = { title: "Refunds & Cancellations · Printswipe" };

export default function RefundsPage() {
  return (
    <article className="space-y-6">
      <div>
        <div className="smallcaps text-ink/60">Legal</div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mt-2">Refunds &amp; Cancellations</h1>
        <p className="text-sm text-ink/60 mt-2 font-mono num">
          Last updated: 28 April 2026
        </p>
      </div>

      <Section title="When you can cancel">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Before bundling</strong> (job status SCHEDULED): full refund.
          </li>
          <li>
            <strong>After bundling, before printing</strong> (status BUNDLED): refund minus a
            10% admin fee. The fee covers PDF prep + bin allocation cost.
          </li>
          <li>
            <strong>After printing</strong> (status PRINTED, READY, COLLECTED): manual review.
            Refunds only granted for clear merchant-fault (e.g. wrong paper, missing pages).
          </li>
        </ul>
      </Section>

      <Section title="How to request">
        <p>
          Email <a href="mailto:hello@printswipe.in" className="font-mono underline hover:text-accent">hello@printswipe.in</a>{" "}
          with your token (e.g. <span className="font-mono">A047</span>) and the reason. We
          respond within 48 hours on weekdays.
        </p>
      </Section>

      <Section title="Refund timing">
        <p>
          Refunds are issued through Razorpay back to the original payment method. Banks
          typically credit within 5–7 working days.
        </p>
      </Section>

      <Section title="Failed payments">
        <p>
          If a payment fails after debit, Razorpay auto-refunds within 5–7 working days. No
          action needed from you.
        </p>
      </Section>

      <Section title="Disputes">
        <p>
          Disputes are governed by Indian consumer protection law and resolved at courts in
          Chennai, Tamil Nadu.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="text-ink/80 text-base leading-relaxed">{children}</div>
    </section>
  );
}
