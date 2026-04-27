"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useJobDraft } from "@/hooks/useJobDraft";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CMYKBar } from "@/components/CMYKBar";
import { Wordmark } from "@/components/Wordmark";
import { PriceDisplay } from "@/components/PriceDisplay";
import { formatSlotIST } from "@/lib/format";

interface OrderResponse {
  orderId: string;
  keyId: string;
  amount: number;
  breakdown: { label: string; calculation: string; paise: number }[];
}

interface RazorpayHandlerArgs {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayCtor {
  new (options: Record<string, unknown>): { open: () => void };
}

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

export default function NewJobReviewPage() {
  const router = useRouter();
  const draftId = useJobDraft((s) => s.draftId);
  const shopId = useJobDraft((s) => s.shopId);
  const shopName = useJobDraft((s) => s.shopName);
  const slotIso = useJobDraft((s) => s.slotIso);
  const files = useJobDraft((s) => s.files);
  const reset = useJobDraft((s) => s.reset);

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!shopId) router.push("/jobs/new/shop");
    else if (!slotIso) router.push("/jobs/new/slot");
    else if (files.length === 0) router.push("/jobs/new/files");
    else if (files.some((f) => !f.storagePath)) router.push("/jobs/new/files");
  }, [shopId, slotIso, files, router]);

  useEffect(() => {
    if (!shopId || !slotIso || files.length === 0) return;
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const r = await fetch("/api/payment/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobDraftId: draftId,
            shopId,
            slotTime: slotIso,
            files: files.map((f) => f.settings),
          }),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          if (!cancelled) setError(typeof body.error === "string" ? body.error : "Failed to create order.");
          return;
        }
        const j = (await r.json()) as OrderResponse;
        if (!cancelled) setOrder(j);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to create order.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [draftId, shopId, slotIso, files]);

  const onPay = async () => {
    if (!order || !window.Razorpay) {
      setError("Payment SDK not loaded yet. Please retry.");
      return;
    }
    setPaying(true);
    setError(null);

    const sb = createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    const userEmail = user?.email ?? "";

    const Rz = window.Razorpay;
    const rz = new Rz({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: "INR",
      name: "Printswipe",
      description: shopName ?? "Print job",
      prefill: { email: userEmail },
      theme: { color: "#EF3340" },
      handler: async (resp: RazorpayHandlerArgs) => {
        try {
          const verify = await fetch("/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...resp,
              jobDraftId: draftId,
              shopId,
              slotTime: slotIso,
              files: files.map((f) => ({
                ...f.settings,
                filename: f.filename,
                storagePath: f.storagePath,
              })),
              notes: null,
            }),
          });
          const j = await verify.json();
          if (!verify.ok) {
            setError(typeof j.error === "string" ? j.error : "Payment verification failed.");
            setPaying(false);
            return;
          }
          const token = j.token as string;
          reset();
          router.push(`/jobs/new/success?token=${encodeURIComponent(token)}&jobId=${encodeURIComponent(j.jobId)}`);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Verification failed.");
          setPaying(false);
        }
      },
      modal: {
        ondismiss: () => setPaying(false),
      },
    });
    rz.open();
  };

  return (
    <main className="min-h-[100dvh] pb-12">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <CMYKBar height={4} />
      <header className="container py-6 flex items-center justify-between">
        <Wordmark className="h-5 w-auto text-ink" />
        <Link href="/jobs/new/configure" className="smallcaps text-ink/60 hover:text-ink">
          ← Back
        </Link>
      </header>

      <section className="container py-4">
        <span className="smallcaps text-ink/60">Step 5 of 5</span>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2">Review & pay.</h1>
      </section>

      <section className="container py-4 grid gap-4 md:grid-cols-2 items-start">
        <Card>
          <CardHeader>
            <span className="smallcaps text-ink/60">Pickup</span>
          </CardHeader>
          <CardBody>
            <div className="font-bold">{shopName ?? "Shop"}</div>
            {slotIso && (
              <p className="font-mono text-sm num mt-1">{formatSlotIST(slotIso)}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <span className="smallcaps text-ink/60">Cover page preview</span>
          </CardHeader>
          <CardBody>
            <CoverMockup />
          </CardBody>
        </Card>
      </section>

      <section className="container py-4">
        <h2 className="smallcaps text-ink/70 mb-3">Files ({files.length})</h2>
        <ul className="grid gap-3">
          {files.map((f) => (
            <li key={f.id}>
              <Card>
                <CardBody>
                  <div className="font-mono text-sm font-bold truncate">{f.filename}</div>
                  <div className="font-mono text-xs text-ink/60 num mt-1">
                    {f.pageCount}p ·{" "}
                    {f.settings.paperType === "POSTER_GLOSSY" ? "Poster" : "Plain"}{" "}
                    {f.settings.paperSize} · {f.settings.colorMode.replace("_", " ")} ·{" "}
                    {f.settings.sides} · {f.settings.layout}-up · ×{f.settings.copies}
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="container py-4">
        <Card>
          <CardHeader>
            <span className="smallcaps text-ink/60">Price breakdown</span>
          </CardHeader>
          <CardBody>
            {loading && <p className="text-ink/60 font-mono text-sm">Calculating…</p>}
            {error && <p className="text-accent font-mono text-sm">{error}</p>}
            {order && (
              <ul className="grid gap-2 font-mono text-xs">
                {order.breakdown.map((line, i) => (
                  <li key={i} className="grid grid-cols-[1fr,auto] gap-3">
                    <span className="text-ink/70">{line.label}</span>
                    <span className="text-right num">₹{(line.paise / 100).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
          {order && (
            <CardFooter className="flex items-center justify-between">
              <span className="smallcaps text-ink/60">Total</span>
              <PriceDisplay paise={order.amount} size="md" />
            </CardFooter>
          )}
        </Card>
      </section>

      <section className="container py-6">
        <Button
          variant="accent"
          size="lg"
          className="w-full md:w-auto"
          disabled={!order || paying}
          onClick={onPay}
        >
          {paying ? "Opening checkout…" : order ? `Confirm & Pay ₹${(order.amount / 100).toFixed(2)}` : "Loading…"}
        </Button>
      </section>
    </main>
  );
}

function CoverMockup() {
  return (
    <svg viewBox="0 0 100 130" className="w-32 h-auto mx-auto" aria-hidden="true">
      <rect x="0" y="0" width="100" height="130" fill="#FAFAF7" stroke="#1A1A1A" strokeWidth="0.5" />
      {/* top band */}
      <rect x="0" y="0" width="100" height="12" fill="#0A0A0A" />
      {/* right band */}
      <rect x="88" y="0" width="12" height="130" fill="#0A0A0A" />
      {/* token placeholder */}
      <rect x="14" y="30" width="50" height="22" stroke="#1A1A1A" strokeWidth="0.5" fill="none" />
      <text x="39" y="46" textAnchor="middle" fontFamily="monospace" fontWeight="bold" fontSize="12" fill="#0A0A0A">
        A001
      </text>
      {/* QR placeholder */}
      <rect x="14" y="62" width="22" height="22" stroke="#1A1A1A" strokeWidth="0.5" fill="none" />
      <rect x="17" y="65" width="3" height="3" fill="#0A0A0A" />
      <rect x="30" y="65" width="3" height="3" fill="#0A0A0A" />
      <rect x="17" y="78" width="3" height="3" fill="#0A0A0A" />
      <rect x="22" y="70" width="3" height="3" fill="#0A0A0A" />
      <rect x="26" y="74" width="3" height="3" fill="#0A0A0A" />
      {/* bin badge */}
      <circle cx="76" cy="73" r="6" fill="#EF3340" />
      <text x="76" y="76" textAnchor="middle" fontFamily="monospace" fontWeight="bold" fontSize="6" fill="#FAFAF7">
        BIN
      </text>
      <text x="76" y="84" textAnchor="middle" fontFamily="monospace" fontWeight="bold" fontSize="5" fill="#0A0A0A">
        #03
      </text>
    </svg>
  );
}
