import crypto from "node:crypto";

let _client: any = null;
export async function getRazorpay() {
  if (_client) return _client;
  const Razorpay = (await import("razorpay")).default;
  _client = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
  return _client;
}

/** Verify Razorpay checkout signature: HMAC-SHA256(orderId|paymentId, secret) */
export function verifyCheckoutSignature(opts: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${opts.orderId}|${opts.paymentId}`)
    .digest("hex");
  return safeEqual(expected, opts.signature);
}

/** Verify Razorpay webhook signature against raw body. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");
  return safeEqual(expected, signature);
}

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a, "utf8");
  const B = Buffer.from(b, "utf8");
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}
