import { format as fmt, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";

/** Paise → rupees as ₹X.XX (always 2 decimals). */
export function paiseToRupees(p: number): string {
  const rupees = p / 100;
  return `₹${rupees.toFixed(2)}`;
}

/** Banker's rounding (half-to-even) to integer paise. */
export function roundPaise(n: number): number {
  const r = Math.round(n);
  if (Math.abs(n - Math.floor(n) - 0.5) < 1e-9) {
    return Math.floor(n) % 2 === 0 ? Math.floor(n) : Math.ceil(n);
  }
  return r;
}

export function formatSlotIST(iso: string | Date): string {
  const d = typeof iso === "string" ? parseISO(iso) : iso;
  return formatInTimeZone(d, IST, "h:mm a, EEE d MMM");
}

export function formatTimeIST(iso: string | Date): string {
  const d = typeof iso === "string" ? parseISO(iso) : iso;
  return formatInTimeZone(d, IST, "h:mm a");
}

export function formatDateIST(iso: string | Date): string {
  const d = typeof iso === "string" ? parseISO(iso) : iso;
  return formatInTimeZone(d, IST, "EEE d MMM yyyy");
}

export function formatLocalDate(iso: string | Date, tz = IST): string {
  const d = typeof iso === "string" ? parseISO(iso) : iso;
  return formatInTimeZone(d, tz, "yyyy-MM-dd");
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return "•".repeat(Math.max(0, digits.length - 4)) + digits.slice(-4);
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(local.length - 2)}@${domain}`;
}

export { fmt };
