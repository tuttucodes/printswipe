"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useJobDraft } from "@/hooks/useJobDraft";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CMYKBar } from "@/components/CMYKBar";
import { Wordmark } from "@/components/Wordmark";

interface ShopOption {
  id: string;
  name: string;
  location_desc: string | null;
}

export default function NewJobShopPage() {
  return (
    <Suspense fallback={null}>
      <NewJobShopInner />
    </Suspense>
  );
}

function NewJobShopInner() {
  const [shops, setShops] = useState<ShopOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const setShop = useJobDraft((s) => s.setShop);
  const reset = useJobDraft((s) => s.reset);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await sb
        .from("profiles")
        .select("campus_id")
        .eq("id", user.id)
        .single();
      if (!profile?.campus_id) {
        if (!cancelled) setError("No campus on profile. Please complete onboarding.");
        return;
      }
      const { data, error: shopErr } = await sb
        .from("shops")
        .select("id, name, location_desc")
        .eq("campus_id", profile.campus_id)
        .eq("is_active", true)
        .order("name");
      if (cancelled) return;
      if (shopErr) {
        setError(shopErr.message);
        return;
      }
      setShops(data ?? []);

      const presetId = searchParams.get("shopId");
      if (presetId && data) {
        const match = data.find((s) => s.id === presetId);
        if (match) {
          // Reset draft for a fresh flow when navigating from home with shopId
          reset();
          setShop(match.id, match.name);
          router.push("/jobs/new/slot");
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPick = (s: ShopOption) => {
    reset();
    setShop(s.id, s.name);
    router.push("/jobs/new/slot");
  };

  return (
    <main className="min-h-[100dvh] pb-12">
      <CMYKBar height={4} />
      <header className="container py-6 flex items-center justify-between">
        <Wordmark className="h-5 w-auto text-ink" />
        <Link href="/home" className="smallcaps text-ink/60 hover:text-ink">
          Cancel
        </Link>
      </header>

      <section className="container py-4">
        <span className="smallcaps text-ink/60">Step 1 of 5</span>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2">Pick a shop.</h1>
      </section>

      <section className="container py-6">
        {error && (
          <Card>
            <CardBody>
              <p className="text-accent font-mono text-sm">{error}</p>
            </CardBody>
          </Card>
        )}
        {!shops && !error && (
          <Card>
            <CardBody className="text-center text-ink/60 py-8">Loading shops…</CardBody>
          </Card>
        )}
        {shops && shops.length === 0 && !error && (
          <Card>
            <CardBody className="text-center text-ink/60 py-8">
              No active shops on your campus.
            </CardBody>
          </Card>
        )}
        {shops && shops.length > 0 && (
          <ul className="grid gap-3">
            {shops.map((s) => (
              <li key={s.id}>
                <button onClick={() => onPick(s)} className="block w-full text-left">
                  <Card className="hover:bg-ink/[0.02] transition-colors">
                    <CardHeader>
                      <h3 className="text-xl font-bold tracking-tight">{s.name}</h3>
                    </CardHeader>
                    <CardBody>
                      {s.location_desc && (
                        <p className="text-sm text-ink/60">{s.location_desc}</p>
                      )}
                    </CardBody>
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
