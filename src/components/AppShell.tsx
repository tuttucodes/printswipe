"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "./Wordmark";
import { CMYKBar } from "./CMYKBar";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/home", label: "Home" },
  { href: "/jobs", label: "My Jobs" },
  { href: "/profile", label: "Profile" },
];

export function AppShell({
  children,
  hideTopBarOnDesktop = false,
}: {
  children: React.ReactNode;
  hideTopBarOnDesktop?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  useEffect(() => {
    function k(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    if (open) window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  async function logout() {
    const sb = createClient();
    await sb.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-paper">
      <CMYKBar height={4} />

      {/* Top bar — sticky, hamburger left, wordmark center */}
      <header
        className={cn(
          "hairline-b bg-paper sticky top-0 z-30 flex items-center justify-between px-4 h-14 pt-[env(safe-area-inset-top)]",
          hideTopBarOnDesktop && "lg:hidden"
        )}
      >
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="min-h-11 min-w-11 -ml-3 flex items-center justify-center"
        >
          <Hamburger />
        </button>
        <Wordmark className="h-5 w-auto text-ink" href="/home" />
        <div className="w-11" aria-hidden />
      </header>

      <main className="flex-1 min-w-0">{children}</main>

      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        aria-hidden={!open}
      >
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="absolute inset-0 bg-ink/40 cursor-default"
        />
        <aside
          role="dialog"
          aria-label="Main menu"
          className={cn(
            "absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-paper hairline-r flex flex-col transition-transform duration-200",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="p-5 hairline-b flex items-center justify-between">
            <Wordmark className="h-6 w-auto text-ink" href={null} />
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="min-h-11 min-w-11 -mr-2 flex items-center justify-center text-ink/60 hover:text-ink"
            >
              <Close />
            </button>
          </div>

          {/* Big primary CTA inside drawer */}
          <Link
            href="/jobs/new/shop"
            className="mx-4 mt-4 bg-ink text-paper hairline px-4 min-h-14 flex items-center justify-between font-mono group"
          >
            <span className="font-bold">Print something</span>
            <Arrow />
          </Link>

          <nav aria-label="Primary" className="p-3 flex-1 mt-2">
            <ul className="space-y-1">
              {ITEMS.map((i) => {
                const active = pathname.startsWith(i.href);
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "px-3 py-2 text-base font-medium transition-colors min-h-11 flex items-center",
                        active ? "bg-ink text-paper" : "hover:bg-ink/5"
                      )}
                    >
                      {i.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="p-3 hairline-t space-y-1">
            <Link
              href="/contact"
              className="block px-3 py-2 text-sm transition-colors min-h-11 flex items-center hover:bg-ink/5"
            >
              Help & contact
            </Link>
            <button
              onClick={logout}
              className="w-full text-left px-3 py-2 text-sm smallcaps text-ink/60 hover:text-accent transition-colors min-h-11"
            >
              Sign out
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Hamburger() {
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true">
      <line x1="0" y1="1.5" x2="22" y2="1.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="0" y1="7" x2="22" y2="7" stroke="currentColor" strokeWidth="1.5" />
      <line x1="0" y1="12.5" x2="22" y2="12.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Close() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" />
      <line x1="14" y1="2" x2="2" y2="14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
      <line x1="0" y1="7" x2="18" y2="7" stroke="currentColor" strokeWidth="1.5" />
      <polyline points="13,2 18,7 13,12" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
