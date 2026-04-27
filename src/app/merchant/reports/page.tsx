import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MerchantShell } from "@/components/MerchantShell";
import { ReportsClient, type ReportData } from "./ReportsClient";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";
const REVENUE_DAYS = 30;

export const dynamic = "force-dynamic";

export default async function MerchantReportsPage() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/merchant/login");

  const { data: merchant } = await sb
    .from("merchants")
    .select("shop_id, shops(name)")
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

  const shopId = merchant.shop_id as string;
  const shopName = (merchant.shops as unknown as { name: string }).name;

  // Last 30 days of jobs (in IST)
  const todayIst = formatInTimeZone(new Date(), IST, "yyyy-MM-dd");
  const startDate = new Date(`${todayIst}T00:00:00+05:30`);
  startDate.setUTCDate(startDate.getUTCDate() - (REVENUE_DAYS - 1));
  const fromIso = startDate.toISOString();
  const toIso = new Date(`${todayIst}T23:59:59+05:30`).toISOString();

  const { data: rows } = await sb
    .from("jobs")
    .select(
      "id, slot_time, status, total_amount_paise, total_pages_color, total_pages_bw, total_pages_poster, job_files(paper_type, paper_size, page_count, copies)"
    )
    .eq("shop_id", shopId)
    .gte("slot_time", fromIso)
    .lte("slot_time", toIso)
    .limit(2000);

  const data = buildReport(rows ?? [], todayIst);

  return (
    <MerchantShell>
      <ReportsClient shopName={shopName} data={data} />
    </MerchantShell>
  );
}

interface RawJobRow {
  id: string;
  slot_time: string;
  status: string;
  total_amount_paise: number;
  total_pages_color: number;
  total_pages_bw: number;
  total_pages_poster: number;
  job_files: Array<{
    paper_type: string;
    paper_size: string;
    page_count: number;
    copies: number;
  }> | null;
}

function buildReport(rows: RawJobRow[], todayIstYyyyMmDd: string): ReportData {
  const today = new Date(`${todayIstYyyyMmDd}T00:00:00+05:30`).getTime();
  const sevenAgo = today - 6 * 24 * 60 * 60 * 1000;
  const thirtyAgo = today - 29 * 24 * 60 * 60 * 1000;

  let revenueToday = 0;
  let revenueWeek = 0;
  let revenueMonth = 0;
  const dayBuckets = new Map<string, number>();
  const statusBuckets = new Map<string, number>();
  const paperBuckets = new Map<string, number>();
  const hourBuckets = new Map<number, number>();
  const todayDateStr = todayIstYyyyMmDd;

  for (const r of rows) {
    const t = new Date(r.slot_time).getTime();
    revenueMonth += r.total_amount_paise;
    if (t >= sevenAgo) revenueWeek += r.total_amount_paise;
    const dateStr = formatInTimeZone(new Date(r.slot_time), IST, "yyyy-MM-dd");
    if (dateStr === todayDateStr) revenueToday += r.total_amount_paise;
    dayBuckets.set(dateStr, (dayBuckets.get(dateStr) ?? 0) + r.total_amount_paise);

    if (dateStr === todayDateStr) {
      statusBuckets.set(r.status, (statusBuckets.get(r.status) ?? 0) + 1);
    }

    for (const f of r.job_files ?? []) {
      const key = `${f.paper_type} ${f.paper_size}`;
      paperBuckets.set(key, (paperBuckets.get(key) ?? 0) + f.page_count * f.copies);
    }

    const hour = Number(formatInTimeZone(new Date(r.slot_time), IST, "H"));
    hourBuckets.set(hour, (hourBuckets.get(hour) ?? 0) + 1);
  }

  // Build a 30-day series (fill gaps)
  const dailyRevenue: Array<{ date: string; paise: number }> = [];
  for (let i = 0; i < REVENUE_DAYS; i++) {
    const d = new Date(thirtyAgo + i * 24 * 60 * 60 * 1000);
    const dStr = formatInTimeZone(d, IST, "yyyy-MM-dd");
    dailyRevenue.push({ date: dStr.slice(5), paise: dayBuckets.get(dStr) ?? 0 });
  }

  const statusToday = [...statusBuckets.entries()].map(([status, count]) => ({
    status,
    count,
  }));

  const paperTypes = [...paperBuckets.entries()]
    .map(([label, pages]) => ({ label, pages }))
    .sort((a, b) => b.pages - a.pages)
    .slice(0, 8);

  const peakHours: Array<{ hour: number; count: number }> = [];
  for (let h = 7; h < 22; h++) {
    peakHours.push({ hour: h, count: hourBuckets.get(h) ?? 0 });
  }

  return {
    revenueTodayPaise: revenueToday,
    revenueWeekPaise: revenueWeek,
    revenueMonthPaise: revenueMonth,
    dailyRevenue,
    statusToday,
    paperTypes,
    peakHours,
  };
}
