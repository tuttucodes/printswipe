"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/merchant/dashboard", label: "Dashboard" },
  { href: "/merchant/lookup", label: "Token Lookup" },
  { href: "/merchant/reports", label: "Reports" },
  { href: "/merchant/settings", label: "Settings" },
];

export function MerchantSidebar({ variant = "fixed" }: { variant?: "fixed" | "drawer" }) {
  const pathname = usePathname();
  const router = useRouter();
  const widthClass = variant === "drawer" ? "w-full h-full" : "w-56 shrink-0";

  async function logout() {
    const sb = createClient();
    await sb.auth.signOut();
    router.push("/merchant/login");
    router.refresh();
  }

  return (
    <aside className={cn("flex flex-col bg-paper hairline-r", widthClass)}>
      <div className="p-5 hairline-b">
        <div className="font-mono font-bold tracking-tight">PRINTSWIPE</div>
        <div className="smallcaps text-ink/60 mt-1">Merchant</div>
      </div>
      <nav aria-label="Merchant" className="p-3 flex-1">
        <ul className="space-y-1">
          {ITEMS.map((i) => {
            const active = pathname.startsWith(i.href);
            return (
              <li key={i.href}>
                <Link
                  href={i.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "px-3 py-2 text-sm transition-colors min-h-11 flex items-center",
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
      <div className="p-3 hairline-t">
        <button
          onClick={logout}
          className="w-full text-left px-3 py-2 text-sm smallcaps text-ink/60 hover:text-accent transition-colors min-h-11"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
