import { MerchantSidebar } from "./MerchantSidebar";

export function MerchantShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] bg-paper">
      <MerchantSidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
