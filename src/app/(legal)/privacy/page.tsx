import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy · Printswipe" };

export default function PrivacyPage() {
  return (
    <article className="space-y-6">
      <div>
        <div className="smallcaps text-ink/60">Legal</div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mt-2">Privacy Policy</h1>
        <p className="text-sm text-ink/60 mt-2 font-mono num">
          Last updated: 28 April 2026
        </p>
      </div>

      <Section title="What we collect">
        <ul className="list-disc pl-5 space-y-1">
          <li>Email + Google profile name (from OAuth)</li>
          <li>Mobile number (you provide)</li>
          <li>Campus association (auto-matched from email domain)</li>
          <li>Files you upload (encrypted at rest, deleted within 4 hours)</li>
          <li>Job history: filename, settings, amount, status, token</li>
          <li>Payment metadata via Razorpay (we never see your card details)</li>
        </ul>
      </Section>

      <Section title="What we don't collect">
        <ul className="list-disc pl-5 space-y-1">
          <li>Your card numbers, CVVs, or bank credentials — Razorpay handles all of this</li>
          <li>Your file contents after they are deleted (we keep only filenames)</li>
          <li>Location, device fingerprints, ad-tech identifiers</li>
        </ul>
      </Section>

      <Section title="How we use it">
        <p>
          To schedule, bundle, and fulfil print jobs; show your job history; issue receipts;
          and contact you about your jobs (e.g. when ready for collection). We do not sell your
          data.
        </p>
      </Section>

      <Section title="Who sees your files">
        <p>
          Only the bundler (server-side automation) and the assigned merchant for the duration
          of fulfilment. Files are stored in private Supabase Storage with row-level security.
        </p>
      </Section>

      <Section title="Retention">
        <ul className="list-disc pl-5 space-y-1">
          <li>Files: deleted within 4 hours of slot time, or 30 min after collection</li>
          <li>Job metadata: retained for receipts</li>
          <li>Account data: retained until you request deletion</li>
        </ul>
      </Section>

      <Section title="Your rights">
        <p>
          Email <a href="mailto:hello@printswipe.in" className="font-mono underline hover:text-accent">hello@printswipe.in</a> to
          request a copy of your data, correct it, or delete your account.
        </p>
      </Section>

      <Section title="Contact / DPO">
        <p>
          Data protection queries: <a href="mailto:hello@printswipe.in" className="font-mono underline hover:text-accent">hello@printswipe.in</a>
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
