"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/Wordmark";
import { CMYKBar } from "@/components/CMYKBar";

interface Campus {
  id: string;
  name: string;
  city: string;
  allowed_email_domains: string[];
}

export function LoginClient({ campuses }: { campuses: Campus[] }) {
  const router = useRouter();
  const sb = createClient();
  const [step, setStep] = useState<"campus" | "email" | "otp" | "profile">("campus");
  const [campus, setCampus] = useState<Campus | null>(null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = campuses.filter(
    (c) => `${c.name} ${c.city}`.toLowerCase().includes(search.toLowerCase())
  );

  function pickCampus(c: Campus) {
    setCampus(c);
    setErr(null);
    setStep("email");
  }

  async function sendOtp() {
    setErr(null);
    if (!campus) return;
    const lower = email.trim().toLowerCase();
    const domain = lower.split("@")[1];
    if (!domain || !campus.allowed_email_domains.includes(domain)) {
      setErr(
        `This email isn't recognized for ${campus.name}. Please use one of: ${campus.allowed_email_domains.join(", ")}`
      );
      return;
    }
    setBusy(true);
    const { error } = await sb.auth.signInWithOtp({ email: lower, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setStep("otp");
  }

  async function verifyOtp() {
    setErr(null);
    setBusy(true);
    const { data, error } = await sb.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp.trim(),
      type: "email",
    });
    setBusy(false);
    if (error || !data.user) {
      setErr(error?.message ?? "Invalid code");
      return;
    }
    // Check profile completeness
    const { data: prof } = await sb.from("profiles").select("name, phone, campus_id").eq("id", data.user.id).single();
    if (!prof?.name || !prof?.phone || !prof?.campus_id) {
      setStep("profile");
      return;
    }
    router.push("/home");
  }

  async function saveProfile() {
    setErr(null);
    if (!/^(\+91)?[6-9]\d{9}$/.test(phone.replace(/\s/g, ""))) {
      setErr("Enter a 10-digit Indian mobile.");
      return;
    }
    if (!campus) return;
    setBusy(true);
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      setErr("Session expired. Please retry.");
      setBusy(false);
      return;
    }
    await sb.from("profiles").update({ name, phone, campus_id: campus.id }).eq("id", user.id);
    setBusy(false);
    router.push("/home");
  }

  return (
    <main className="min-h-[100dvh] flex flex-col">
      <CMYKBar height={4} />
      <header className="container py-6">
        <Wordmark className="h-6 w-auto text-ink" />
      </header>
      <section className="container flex-1 flex flex-col justify-center max-w-md mx-auto w-full pb-20">
        {err && (
          <div className="hairline border-status-failed text-status-failed p-3 mb-4 text-sm">{err}</div>
        )}

        {step === "campus" && (
          <>
            <div className="smallcaps text-ink/60 mb-2">Step 1 of 3</div>
            <h2 className="text-3xl font-bold mb-4">Pick your campus</h2>
            <Input
              placeholder="Search campuses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-3"
            />
            <ul className="space-y-2">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => pickCampus(c)}
                    className="hairline w-full text-left p-4 hover:bg-ink hover:text-paper transition-colors"
                  >
                    <div className="font-bold">{c.name}</div>
                    <div className="text-xs opacity-70">{c.city}</div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {step === "email" && campus && (
          <>
            <div className="smallcaps text-ink/60 mb-2">Step 2 of 3 · {campus.name}</div>
            <h2 className="text-3xl font-bold mb-4">Your campus email</h2>
            <p className="text-sm text-ink/70 mb-4">
              We'll send a 6-digit code. Allowed: {campus.allowed_email_domains.join(", ")}
            </p>
            <div className="space-y-2 mb-4">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`you@${campus.allowed_email_domains[0]}`}
              />
            </div>
            <Button onClick={sendOtp} disabled={busy}>
              {busy ? "Sending…" : "Send code"}
            </Button>
            <Button variant="ghost" onClick={() => setStep("campus")} className="ml-2">
              Back
            </Button>
          </>
        )}

        {step === "otp" && (
          <>
            <div className="smallcaps text-ink/60 mb-2">Verify</div>
            <h2 className="text-3xl font-bold mb-4">Enter the 6-digit code</h2>
            <p className="text-sm text-ink/70 mb-4">Sent to {email}</p>
            <div className="space-y-2 mb-4">
              <Label>Code</Label>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="text-center text-2xl tracking-[0.5em]"
              />
            </div>
            <Button onClick={verifyOtp} disabled={busy || otp.length < 6}>
              {busy ? "Verifying…" : "Verify"}
            </Button>
            <Button variant="ghost" onClick={() => setStep("email")} className="ml-2">
              Use a different email
            </Button>
          </>
        )}

        {step === "profile" && (
          <>
            <div className="smallcaps text-ink/60 mb-2">Step 3 of 3</div>
            <h2 className="text-3xl font-bold mb-4">Complete your profile</h2>
            <div className="space-y-3 mb-4">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
              </div>
              <div>
                <Label>Mobile (Indian)</Label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9999999999"
                />
              </div>
            </div>
            <Button onClick={saveProfile} disabled={busy || !name}>
              {busy ? "Saving…" : "Continue"}
            </Button>
          </>
        )}
      </section>
    </main>
  );
}
