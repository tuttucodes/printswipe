"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CMYKBar } from "@/components/CMYKBar";
import { Wordmark } from "@/components/Wordmark";

interface CachedJob {
  id: string;
  token: string | null;
  shopName: string | null;
  slotIso: string;
}

export default function OfflinePage() {
  const [cached, setCached] = useState<CachedJob[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("printswipe-cached-jobs");
      if (raw) {
        const parsed = JSON.parse(raw) as CachedJob[];
        if (Array.isArray(parsed)) setCached(parsed);
      }
    } catch {
      // ignore — corrupt cache
    }
  }, []);

  const onRetry = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  return (
    <main className="min-h-[100dvh] flex flex-col">
      <CMYKBar height={4} />
      <header className="container py-6">
        <Wordmark className="h-5 w-auto text-ink" />
      </header>

      <section className="container flex-1 py-12">
        <div className="max-w-md">
          <span className="smallcaps text-ink/50">Offline</span>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2">
            You're offline.
          </h1>
          <p className="text-sm text-ink/60 mt-3">
            Reconnect to book new jobs. Past jobs cached on this device are listed below.
          </p>
          <div className="mt-6 flex gap-3">
            <Button variant="primary" onClick={onRetry}>
              Retry
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">Home</Link>
            </Button>
          </div>
        </div>

        {cached.length > 0 && (
          <div className="mt-12">
            <h2 className="smallcaps text-ink/70 mb-3">Cached jobs</h2>
            <ul className="grid gap-3">
              {cached.map((j) => (
                <li key={j.id}>
                  <Card>
                    <CardHeader>
                      <div className="font-mono font-bold">{j.token ?? "—"}</div>
                    </CardHeader>
                    <CardBody>
                      <div className="font-mono text-xs text-ink/60">
                        {j.shopName ?? "Shop"} · {j.slotIso}
                      </div>
                    </CardBody>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <footer className="container py-8 hairline-t mt-auto smallcaps text-ink/50">
        printswipe.in
      </footer>
    </main>
  );
}
