import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service · Printswipe" };

export default function TermsPage() {
  return (
    <article className="space-y-6">
      <div>
        <div className="smallcaps text-ink/60">Legal</div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mt-2">Terms of Service</h1>
        <p className="text-sm text-ink/60 mt-2 font-mono num">
          Last updated: 28 April 2026
        </p>
      </div>

      <Section title="1. Acceptance">
        <p>
          By using Printswipe (the "Service") you agree to these Terms. If you do not agree, do
          not use the Service.
        </p>
      </Section>

      <Section title="2. Eligibility">
        <p>
          You must be a current student, faculty, or staff member of a campus that Printswipe
          supports. Sign in via Google with your university or work email.
        </p>
      </Section>

      <Section title="3. Print jobs">
        <p>
          Printswipe schedules print jobs for fulfilment by independent on-campus print shops.
          Printswipe is the booking layer; the merchant is the actual provider of printing
          services. Quality, paper type, and color reproduction depend on the merchant's
          equipment.
        </p>
      </Section>

      <Section title="4. Payments">
        <p>
          Payments are processed through Razorpay in INR (paise as base unit). The price shown
          before checkout includes any convenience fee and applicable GST. By paying, you
          authorise Printswipe to charge the chosen payment method.
        </p>
      </Section>

      <Section title="5. Files & privacy">
        <p>
          Files you upload are stored privately and are accessible only to the bundler and the
          assigned merchant. Files are deleted within 4 hours of slot time, or 30 minutes after
          collection — whichever is first. Job metadata (filename, page count, settings, amount)
          is retained for receipts and history.
        </p>
      </Section>

      <Section title="6. Cancellations & refunds">
        <p>
          See the <a href="/refunds" className="underline hover:text-accent">Refunds policy</a>{" "}
          for details on cancellation windows and refund admin fees.
        </p>
      </Section>

      <Section title="7. Acceptable use">
        <p>
          You will not use Printswipe to print content that infringes intellectual property,
          contains malware, is hate speech, depicts minors in harmful contexts, or violates
          campus policy or Indian law.
        </p>
      </Section>

      <Section title="8. Liability">
        <p>
          Printswipe's liability is limited to the amount you paid for the affected job.
          Printswipe is not liable for delays caused by printer downtime, power outages, or
          force majeure.
        </p>
      </Section>

      <Section title="9. Changes">
        <p>
          We may update these Terms. Continued use of the Service after changes constitutes
          acceptance.
        </p>
      </Section>

      <Section title="10. Contact">
        <p>
          Questions: <a href="mailto:hello@printswipe.in" className="font-mono underline hover:text-accent">hello@printswipe.in</a>
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
