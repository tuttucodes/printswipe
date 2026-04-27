import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MerchantShell } from "@/components/MerchantShell";
import { SettingsClient } from "./SettingsClient";
import type { PrinterConfig, PricingConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MerchantSettingsPage() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/merchant/login");

  const { data: merchant } = await sb
    .from("merchants")
    .select(
      "shop_id, shops(id, name, hours_json, slot_duration_min, max_per_slot, bin_count, pricing_json, printer_config_json, premium_percent, gst_enabled, gst_number)"
    )
    .eq("profile_id", user.id)
    .single();

  if (!merchant) {
    return (
      <MerchantShell>
        <div className="container py-12">
          <div className="hairline p-6 bg-paper">
            <div className="smallcaps text-ink/60 mb-2">No shop linked</div>
            <h1 className="text-2xl font-bold">
              This account is not linked to any shop yet.
            </h1>
          </div>
        </div>
      </MerchantShell>
    );
  }

  const shop = merchant.shops as unknown as {
    id: string;
    name: string;
    hours_json: Record<string, unknown>;
    slot_duration_min: number;
    max_per_slot: number;
    bin_count: number;
    pricing_json: PricingConfig;
    printer_config_json: PrinterConfig;
    premium_percent: number;
    gst_enabled: boolean;
    gst_number: string | null;
  };

  return (
    <MerchantShell>
      <SettingsClient
        shopId={shop.id}
        shopName={shop.name}
        initial={{
          hours: shop.hours_json,
          slotDurationMin: shop.slot_duration_min,
          maxPerSlot: shop.max_per_slot,
          binCount: shop.bin_count,
          pricing: shop.pricing_json,
          printerConfig: shop.printer_config_json,
          premiumPercent: Number(shop.premium_percent),
          gstEnabled: shop.gst_enabled,
          gstNumber: shop.gst_number ?? "",
        }}
      />
    </MerchantShell>
  );
}
