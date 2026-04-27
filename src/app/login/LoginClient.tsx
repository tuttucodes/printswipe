"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/Wordmark";
import { CMYKBar } from "@/components/CMYKBar";
import { RegistrationMark } from "@/components/RegistrationMark";

interface CampusLite {
  name: string;
  allowed_email_domains: string[];
}

const ERRORS: Record<string, string> = {
  domain_mismatch:
    "We couldn't match your email to a supported campus. Please use your university or work email — for example, the address you sign in with on campus.",
  oauth_failed: "Google sign-in failed. Please try again.",
  no_email: "Google didn't return an email. Please try again or contact support.",
  unknown: "Something went wrong. Please try again.",
};

export function LoginClient({
  supportedCampuses,
  errorCode,
  attemptedEmail,
}: {
  supportedCampuses: CampusLite[];
  errorCode: string | null;
  attemptedEmail: string | null;
}) {
  const sb = createClient();
  const [busy, setBusy] = useState(false);
  const errorMsg = errorCode ? ERRORS[errorCode] ?? ERRORS.unknown : null;

  async function signInWithGoogle() {
    setBusy(true);
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
    if (error) {
      setBusy(false);
      window.location.href = `/login?error=oauth_failed`;
    }
    // On success the browser navigates to Google then to /auth/callback.
  }

  return (
    <main className="min-h-[100dvh] flex flex-col bg-paper">
      <CMYKBar height={4} />
      <header className="container py-6 flex items-center justify-between">
        <Wordmark className="h-6 w-auto text-ink" />
        <a href="/merchant/login" className="smallcaps text-ink/60 hover:text-ink">
          Merchant
        </a>
      </header>

      <section className="container flex-1 flex flex-col justify-center max-w-md mx-auto w-full pb-20">
        <RegistrationMark size={20} className="text-accent mb-6" />
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-4 text-ink/70">
          Use your <span className="font-semibold text-ink">university or work email</span>.
          We'll match it to your campus automatically.
        </p>

        {errorMsg && (
          <div className="mt-6 hairline border-status-failed text-status-failed p-3 text-sm">
            {errorMsg}
            {attemptedEmail && (
              <div className="mt-1 font-mono text-xs opacity-80">Tried: {attemptedEmail}</div>
            )}
          </div>
        )}

        <div className="mt-8">
          <Button
            onClick={signInWithGoogle}
            disabled={busy}
            size="lg"
            variant="secondary"
            className="w-full justify-center"
          >
            <GoogleGlyph />
            <span>{busy ? "Redirecting…" : "Continue with Google"}</span>
          </Button>
        </div>

        {supportedCampuses.length > 0 && (
          <div className="mt-10 hairline-t pt-6">
            <div className="smallcaps text-ink/60 mb-3">Supported campuses</div>
            <ul className="space-y-2">
              {supportedCampuses.map((c) => (
                <li key={c.name} className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold">{c.name}</span>
                  <span className="font-mono text-xs text-ink/60">
                    {c.allowed_email_domains.join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {supportedCampuses.length === 0 && (
          <div className="mt-10 hairline border-status-bundled p-3 text-sm text-status-bundled">
            No campuses configured yet. Run <code className="font-mono">pnpm seed</code> on the
            backend, or contact support.
          </div>
        )}
      </section>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
