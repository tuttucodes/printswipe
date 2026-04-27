"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MerchantSidebar } from "./MerchantSidebar";
import { Wordmark } from "./Wordmark";

export function MerchantShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on route change
  useEffect(() => setOpen(false), [pathname]);

  // Lock body scroll while drawer open
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex min-h-[100dvh] bg-paper">
      {/* Desktop / wide tablet: pinned sidebar */}
      <div className="hidden lg:block">
        <MerchantSidebar />
      </div>

      {/* Mobile + narrow tablet: drawer */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="absolute inset-0 bg-ink/40 cursor-default"
        />
        <aside
          role="dialog"
          aria-label="Merchant menu"
          className={`absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-paper hairline-r transition-transform duration-200 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <MerchantSidebar variant="drawer" />
        </aside>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar — mobile + narrow tablet only */}
        <header className="lg:hidden hairline-b bg-paper sticky top-0 z-30 flex items-center justify-between px-4 h-14 pt-[env(safe-area-inset-top)]">
          <button
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="min-h-11 min-w-11 -ml-3 flex items-center justify-center"
          >
            <HamburgerIcon />
          </button>
          <Wordmark className="h-5 w-auto text-ink" />
          <div className="w-11" aria-hidden />
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

function HamburgerIcon() {
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true">
      <line x1="0" y1="1.5"  x2="22" y2="1.5"  stroke="currentColor" strokeWidth="1.5" />
      <line x1="0" y1="7"    x2="22" y2="7"    stroke="currentColor" strokeWidth="1.5" />
      <line x1="0" y1="12.5" x2="22" y2="12.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
