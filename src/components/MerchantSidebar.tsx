"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/merchant/dashboard", label: "Dashboard" },
  { href: "/merchant/lookup", label: "Token Lookup" },
  { href: "/merchant/reports", label: "Reports" },
  { href: "/merchant/settings", label: "Settings" },
];

export function MerchantSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:block w-56 shrink-0 hairline-r bg-paper">
      <div className="p-5 hairline-b">
        <div className="font-mono font-bold tracking-tight">PRINTSWIPE</div>
        <div className="smallcaps text-ink/50 mt-1">Merchant</div>
      </div>
      <nav className="p-3">
        <ul className="space-y-1">
          {ITEMS.map((i) => {
            const active = pathname.startsWith(i.href);
            return (
              <li key={i.href}>
                <Link
                  href={i.href}
                  className={cn(
                    "block px-3 py-2 text-sm transition-colors",
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
    </aside>
  );
}
