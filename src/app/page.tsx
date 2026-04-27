import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { CMYKBar } from "@/components/CMYKBar";
import { Button } from "@/components/ui/button";
import { RegistrationMark } from "@/components/RegistrationMark";

export default function LandingPage() {
  return (
    <main className="min-h-[100dvh] flex flex-col">
      <CMYKBar height={4} />
      <header className="container py-6 flex items-center justify-between">
        <Wordmark className="h-6 w-auto text-ink" />
        <Link href="/merchant/login" className="smallcaps text-ink/60 hover:text-ink">
          Merchant Login
        </Link>
      </header>

      <section className="container flex-1 flex flex-col justify-center py-16">
        <div className="max-w-2xl">
          <RegistrationMark size={20} className="text-accent mb-4" />
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            Skip the<br />print queue.
          </h1>
          <p className="mt-6 text-lg text-ink/70 max-w-lg">
            Upload your PDFs. Pick a slot. Pay. Walk in at your time and collect from a numbered bin.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/login">Get started</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="#how">How it works</Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="how" className="container py-16 hairline-t">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            ["01", "Upload", "PDFs, photos, screenshots. We convert HEIC and images for you."],
            ["02", "Configure", "Paper, color, sides, layout, copies. Live price updates."],
            ["03", "Walk in", "Show your token. Grab from your numbered bin. Done."],
          ].map(([n, t, d]) => (
            <div key={n} className="hairline p-6">
              <div className="font-mono text-accent text-sm">{n}</div>
              <div className="font-bold text-2xl mt-2">{t}</div>
              <p className="text-ink/70 mt-2 text-sm">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="container py-8 hairline-t mt-auto smallcaps text-ink/60 flex justify-between">
        <span>printswipe.in</span>
        <span>made for indian campuses</span>
      </footer>
    </main>
  );
}
