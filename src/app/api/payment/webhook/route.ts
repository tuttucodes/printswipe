import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/razorpay";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ ok: false, reason: "bad signature" }, { status: 400 });
  }

  const admin = createAdminClient();
  const event = JSON.parse(raw);
  const eventId = event?.payload?.payment?.entity?.id ?? event?.payload?.refund?.entity?.id;
  const eventType = event.event;

  // Idempotency
  if (eventId) {
    const { data: prior } = await admin
      .from("payment_audit")
      .select("id")
      .eq("event_type", `WEBHOOK_${eventType.toUpperCase()}`)
      .contains("payload_json", { entityId: eventId })
      .maybeSingle();
    if (prior) return NextResponse.json({ ok: true, deduped: true });
  }

  await admin.from("payment_audit").insert({
    event_type: `WEBHOOK_${eventType.toUpperCase()}`,
    payload_json: { ...event, entityId: eventId },
  });

  // Side effects
  try {
    if (eventType === "payment.failed") {
      const orderId = event?.payload?.payment?.entity?.order_id;
      if (orderId) {
        await admin.from("jobs").update({ status: "FAILED" }).eq("razorpay_order_id", orderId);
      }
    } else if (eventType === "refund.processed") {
      const paymentId = event?.payload?.refund?.entity?.payment_id;
      if (paymentId) {
        await admin.from("jobs").update({ status: "REFUNDED" }).eq("razorpay_payment_id", paymentId);
      }
    }
  } catch (e) {
    // Audit captured the event; surface error to ourselves but ack to Razorpay.
    console.error("webhook handler error", e);
  }

  return NextResponse.json({ ok: true });
}
