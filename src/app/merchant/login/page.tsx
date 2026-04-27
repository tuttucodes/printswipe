"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/Wordmark";
import { CMYKBar } from "@/components/CMYKBar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export default function MerchantLoginPage() {
  return (
    <Suspense fallback={null}>
      <MerchantLoginInner />
    </Suspense>
  );
}

function MerchantLoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/merchant/dashboard";
  const sb = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main className="min-h-[100dvh] flex flex-col bg-paper">
      <CMYKBar height={4} />
      <header className="container py-6">
        <Wordmark className="h-6 w-auto text-ink" />
      </header>
      <section className="container flex-1 flex flex-col justify-center max-w-md mx-auto w-full pb-20">
        <Card>
          <CardHeader>
            <div className="smallcaps text-ink/60">Merchant access</div>
            <h1 className="text-2xl font-bold mt-1">Sign in</h1>
          </CardHeader>
          <CardBody>
            {err && (
              <div className="hairline border-status-failed text-status-failed p-3 mb-4 text-sm">
                {err}
              </div>
            )}
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="merchant@printshop.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardBody>
        </Card>
      </section>
    </main>
  );
}
