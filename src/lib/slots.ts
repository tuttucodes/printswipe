import { addMinutes, parse, startOfDay } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export interface ShopHours {
  [day: string]: { open: string; close: string } | { closed: true };
}

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export interface SlotInfo {
  slotTime: Date;     // UTC instant
  iso: string;
  label: string;      // local time label
  capacity: number;
  used: number;
  isPast: boolean;
  isBlocked: boolean;
  isFull: boolean;
}

export function buildSlotsForDate(opts: {
  hours: ShopHours;
  date: Date;             // any date in target day
  slotDurationMin: number;
  tz: string;
}): { slotTime: Date; iso: string; label: string }[] {
  const { hours, date, slotDurationMin, tz } = opts;
  const dayKey = DAYS[Number(formatInTimeZone(date, tz, "i")) % 7]; // 1=mon..7=sun → adjust to sun=0..sat=6
  // Recompute via local weekday name (avoids ambiguity):
  const wname = formatInTimeZone(date, tz, "EEE").toLowerCase().slice(0, 3); // mon, tue,...
  const cfg = hours[wname] ?? hours[dayKey];
  if (!cfg || ("closed" in cfg && cfg.closed)) return [];

  const open = (cfg as any).open as string; // "09:00"
  const close = (cfg as any).close as string;

  const dateLocal = formatInTimeZone(date, tz, "yyyy-MM-dd");
  const openLocal = parse(`${dateLocal} ${open}`, "yyyy-MM-dd HH:mm", new Date());
  const closeLocal = parse(`${dateLocal} ${close}`, "yyyy-MM-dd HH:mm", new Date());

  const out: { slotTime: Date; iso: string; label: string }[] = [];
  let t = openLocal;
  while (t < closeLocal) {
    const utc = fromZonedTime(t, tz);
    out.push({
      slotTime: utc,
      iso: utc.toISOString(),
      label: formatInTimeZone(utc, tz, "h:mm a"),
    });
    t = addMinutes(t, slotDurationMin);
  }
  return out;
}

/**
 * Compose availability: combine raw slots with usage counts and blocks.
 */
export function composeAvailability(opts: {
  slots: { slotTime: Date; iso: string; label: string }[];
  capacity: number;
  usageBySlotIso: Record<string, number>;
  blockedSlotIsos: Set<string>;
  now: Date;
}): SlotInfo[] {
  return opts.slots.map((s) => {
    const used = opts.usageBySlotIso[s.iso] ?? 0;
    const isPast = s.slotTime.getTime() <= opts.now.getTime();
    const isBlocked = opts.blockedSlotIsos.has(s.iso);
    const isFull = used >= opts.capacity;
    return { ...s, capacity: opts.capacity, used, isPast, isBlocked, isFull };
  });
}
