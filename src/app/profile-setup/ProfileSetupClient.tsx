"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/Wordmark";
import { CMYKBar } from "@/components/CMYKBar";

export function ProfileSetupClient({
  initialName,
  email,
  campusName,
  next,
}: {
  initialName: string;
  email: string;
  campusName: string | null;
  next: string;
}) {
  const router = useRouter();
  const sb = createClient();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const cleaned = phone.replace(/\s|-/g, "");
    if (!/^(\+91)?[6-9]\d{9}$/.test(cleaned)) {
      setErr("Enter a 10-digit Indian mobile.");
      return;
    }
    setBusy(true);
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      setErr("Session expired. Please sign in again.");
      setBusy(false);
      return;
    }
    const { error } = await sb
      .from("profiles")
      .update({ name, phone: cleaned })
      .eq("id", user.id);
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
        <div className="smallcaps text-ink/60 mb-2">Almost there</div>
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Complete your profile</h1>

        <div className="hairline p-4 mb-6 text-sm">
          <div className="smallcaps text-ink/60 mb-1">Signed in as</div>
          <div className="font-mono">{email}</div>
          {campusName && (
            <>
              <div className="smallcaps text-ink/60 mt-3 mb-1">Campus</div>
              <div className="font-semibold">{campusName}</div>
            </>
          )}
        </div>

        {err && (
          <div className="hairline border-status-failed text-status-failed p-3 mb-4 text-sm">
            {err}
          </div>
        )}

        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Mobile (Indian)</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 9999999999"
            />
          </div>
          <Button type="submit" disabled={busy || !name} className="w-full">
            {busy ? "Saving…" : "Continue"}
          </Button>
        </form>
      </section>
    </main>
  );
}
