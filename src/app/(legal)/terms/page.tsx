import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · Printswipe",
  description: "The legal terms governing your use of Printswipe.",
};

export default function TermsPage() {
  return (
    <article className="space-y-8">
      <header>
        <div className="smallcaps text-ink/60">Legal</div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mt-2">Terms of Service</h1>
        <p className="text-sm text-ink/60 mt-2 font-mono num">
          Effective: 28 April 2026 · Last updated: 28 April 2026
        </p>
      </header>

      <p className="text-ink/80">
        These Terms of Service ("Terms") govern your access to and use of Printswipe (the
        "Service"), operated from Chennai, Tamil Nadu, India. By creating an account, signing
        in, or placing a print order, you accept these Terms in full.
      </p>

      <Section number="1" title="Definitions">
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Service</strong> — the Printswipe web application at printswipe.in.</li>
          <li><strong>You / User</strong> — any individual who creates an account or uses the Service.</li>
          <li><strong>Merchant</strong> — an independent on-campus print shop that fulfils print jobs through the Service.</li>
          <li><strong>Print Job</strong> — a single instance of files, configuration, slot, and payment that you submit through the Service.</li>
          <li><strong>Token</strong> — the unique alphanumeric identifier (e.g. <span className="font-mono">A047</span>) issued upon successful payment.</li>
        </ul>
      </Section>

      <Section number="2" title="Eligibility">
        <p>To use the Service you must:</p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li>Be at least 13 years old (a parent or guardian must agree on your behalf if under 18 in India).</li>
          <li>Hold a valid email address at a campus we support, evidenced by a matching email domain.</li>
          <li>Have legal capacity to enter into a binding contract under Indian law.</li>
        </ul>
      </Section>

      <Section number="3" title="Account & Authentication">
        <p>You sign in via Google OAuth using your university or work email. You agree to:</p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li>Keep your Google account secure and not share access.</li>
          <li>Provide accurate name and Indian mobile number during profile setup.</li>
          <li>Notify us immediately of any unauthorised use at <Email />.</li>
        </ul>
      </Section>

      <Section number="4" title="Print Jobs & Fulfilment">
        <p>
          Printswipe is a booking and bundling platform. The Merchant is the actual provider of
          printing services; Printswipe coordinates the schedule, collects payment, prepares the
          merged print PDFs, and assigns a numbered bin for collection.
        </p>
        <p className="mt-2">
          You acknowledge that print quality, paper appearance, and color reproduction depend on
          the Merchant's equipment. Printswipe sets paper-type, size, color and duplex options
          based on the Merchant's declared printer configuration.
        </p>
      </Section>

      <Section number="5" title="Pricing & Payment">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>All prices are in Indian Rupees (INR) and stored internally as paise.</li>
          <li>The price shown on the review screen is final and includes per-side or per-sheet print cost, the Merchant's convenience fee, and applicable GST where the Merchant is registered.</li>
          <li>Payments are processed by Razorpay. Printswipe does not store your card or banking details.</li>
          <li>You authorise Printswipe and Razorpay to charge the chosen payment method when you click <span className="font-mono">Confirm &amp; Pay</span>.</li>
        </ul>
      </Section>

      <Section number="6" title="Files, Privacy & Data">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Files you upload are stored privately in encrypted Supabase Storage and accessible only to the bundler and the assigned Merchant.</li>
          <li>Files are deleted within four (4) hours after slot time, or thirty (30) minutes after collection, whichever fires first.</li>
          <li>Job metadata (filename, page count, settings, amount, status, token) is retained indefinitely for receipts, history, and dispute resolution.</li>
          <li>See our <a href="/privacy" className="underline hover:text-accent">Privacy Policy</a> for details.</li>
        </ul>
      </Section>

      <Section number="7" title="Cancellations & Refunds">
        <p>
          See the <a href="/refunds" className="underline hover:text-accent">Refunds &amp; Cancellations</a> policy
          for cancellation windows, the 10% post-bundling admin fee, and refund timing. Refunds are
          issued through Razorpay back to the original payment method and typically clear within 5–7
          working days.
        </p>
      </Section>

      <Section number="8" title="Acceptable Use">
        <p>You will not use the Service to print, distribute, or store content that:</p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li>Infringes any intellectual-property right, including textbooks or copyrighted material you do not own or have licence to reproduce.</li>
          <li>Constitutes hate speech, defamation, or incitement to violence under Indian law.</li>
          <li>Depicts minors in sexual or harmful contexts.</li>
          <li>Violates campus policy, the Indian Penal Code, or any applicable statute.</li>
          <li>Contains malware, executable code embedded in PDFs, or attempts to exploit our systems.</li>
        </ul>
        <p className="mt-2">
          We reserve the right to refuse, cancel, and refund any job that violates these rules.
          Repeated violations result in account termination.
        </p>
      </Section>

      <Section number="9" title="Merchant Obligations">
        <p>
          Merchants are independent contractors. They print, sort into bins, and hand over jobs at
          the scheduled time. Disputes about quality, missing pages, or wrong paper are resolved
          between you and the Merchant, with Printswipe mediating where possible.
        </p>
      </Section>

      <Section number="10" title="Service Availability">
        <p>
          The Service is provided "as is" and "as available". We do not guarantee uninterrupted
          uptime, and may perform maintenance with reasonable notice. We are not liable for downtime
          caused by Supabase, Razorpay, Vercel, Cloudflare, ISPs, or campus network outages.
        </p>
      </Section>

      <Section number="11" title="Limitation of Liability">
        <p>
          To the maximum extent permitted by Indian law, Printswipe's aggregate liability for any
          claim arising from the Service is limited to the total amount you paid for the affected
          Print Job. We are not liable for indirect, incidental, consequential, or punitive damages,
          including loss of grades, deadlines, or academic standing.
        </p>
      </Section>

      <Section number="12" title="Indemnity">
        <p>
          You agree to indemnify and hold harmless Printswipe, its operators, and Merchants from
          any third-party claim arising out of content you upload or your violation of these Terms.
        </p>
      </Section>

      <Section number="13" title="Termination">
        <p>
          You may delete your account anytime by emailing <Email />. We may suspend or terminate
          your access for violation of these Terms, fraudulent payments, or court order. Files are
          purged on termination subject to legal retention requirements.
        </p>
      </Section>

      <Section number="14" title="Governing Law & Disputes">
        <p>
          These Terms are governed by the laws of India. Any dispute is subject to the exclusive
          jurisdiction of the courts in Chennai, Tamil Nadu. Before approaching a court, you agree
          to attempt good-faith resolution by emailing <Email /> with full details, and to wait at
          least 30 days for a response.
        </p>
      </Section>

      <Section number="15" title="Changes to These Terms">
        <p>
          We may update these Terms. Material changes will be announced via email or in-app banner
          at least 7 days before they take effect. Continued use of the Service after the effective
          date constitutes acceptance.
        </p>
      </Section>

      <Section number="16" title="Contact">
        <p>Questions about these Terms: <Email /></p>
      </Section>
    </article>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl md:text-2xl font-bold flex items-baseline gap-3">
        <span className="font-mono text-accent text-sm">{number}.</span>
        {title}
      </h2>
      <div className="text-ink/80 text-base leading-relaxed">{children}</div>
    </section>
  );
}

function Email() {
  return (
    <a href="mailto:hello@printswipe.in" className="font-mono underline hover:text-accent">
      hello@printswipe.in
    </a>
  );
}
