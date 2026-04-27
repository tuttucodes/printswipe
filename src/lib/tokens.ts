import { formatInTimeZone } from "date-fns-tz";
import { createAdminClient } from "./supabase/admin";

const IST = "Asia/Kolkata";

/** Letter rotation: ((day_of_month - 1) % 26) → A..Z. */
export function letterForDate(d: Date, tz = IST): string {
  const dom = Number(formatInTimeZone(d, tz, "d")); // 1..31
  const offset = ((dom - 1) % 26 + 26) % 26;
  return String.fromCharCode(65 + offset);
}

export function localDateString(d: Date, tz = IST): string {
  return formatInTimeZone(d, tz, "yyyy-MM-dd");
}

export function formatToken(letter: string, n: number): string {
  return `${letter}${String(n).padStart(3, "0")}`;
}

/**
 * Atomic token assignment via Postgres next_token RPC.
 * Letter from slotTime in shop's timezone; counter resets per (shop, date).
 */
export async function nextToken(shopId: string, slotTime: Date, tz = IST): Promise<string> {
  const sb = createAdminClient();
  const localDate = localDateString(slotTime, tz);
  const { data, error } = await sb.rpc("next_token", { p_shop_id: shopId, p_local_date: localDate });
  if (error) throw error;
  const n = Number(data);
  return formatToken(letterForDate(slotTime, tz), n);
}
