import { Wordmark } from "@/components/Wordmark";
import { CMYKBar } from "@/components/CMYKBar";
import { Footer } from "@/components/Footer";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-[100dvh] bg-paper">
      <CMYKBar height={4} />
      <header className="container py-6 flex items-center justify-between">
        <Wordmark className="h-6 w-auto text-ink" href="/" />
        <a href="/login" className="smallcaps text-ink/60 hover:text-ink">
          Sign in
        </a>
      </header>
      <main className="container flex-1 max-w-3xl py-10 prose-printswipe">
        {children}
      </main>
      <Footer />
    </div>
  );
}
