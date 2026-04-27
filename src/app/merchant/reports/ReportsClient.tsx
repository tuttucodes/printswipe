"use client";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CMYKBar } from "@/components/CMYKBar";
import { PriceDisplay } from "@/components/PriceDisplay";

export interface ReportData {
  revenueTodayPaise: number;
  revenueWeekPaise: number;
  revenueMonthPaise: number;
  dailyRevenue: Array<{ date: string; paise: number }>;
  statusToday: Array<{ status: string; count: number }>;
  paperTypes: Array<{ label: string; pages: number }>;
  peakHours: Array<{ hour: number; count: number }>;
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "#3B82A0",
  BUNDLED: "#B8860B",
  PRINTED: "#5B21B6",
  READY: "#15803D",
  COLLECTED: "#525252",
  EXPIRED: "#7F1D1D",
  FAILED: "#7F1D1D",
  REFUNDED: "#525252",
  PENDING_PAYMENT: "#A3A3A3",
};

export function ReportsClient({
  shopName,
  data,
}: {
  shopName: string;
  data: ReportData;
}) {
  const dailyChart = data.dailyRevenue.map((d) => ({
    date: d.date,
    rupees: Math.round(d.paise / 100),
  }));
  const hasAnyRevenue = dailyChart.some((d) => d.rupees > 0);
  const hasStatus = data.statusToday.length > 0;
  const hasPaper = data.paperTypes.length > 0;
  const hasHours = data.peakHours.some((h) => h.count > 0);

  return (
    <div>
      <CMYKBar height={4} />
      <header className="container py-6 hairline-b">
        <div className="smallcaps text-ink/60">{shopName}</div>
        <h1 className="text-3xl font-bold">Reports</h1>
      </header>

      <div className="container py-6 space-y-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Stat label="Revenue today" paise={data.revenueTodayPaise} />
          <Stat label="Revenue this week" paise={data.revenueWeekPaise} />
          <Stat label="Revenue this month" paise={data.revenueMonthPaise} />
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Revenue · last 30 days</h2>
          </CardHeader>
          <CardBody>
            {hasAnyRevenue ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyChart}>
                    <CartesianGrid stroke="#1A1A1A" strokeOpacity={0.1} vertical={false} />
                    <XAxis dataKey="date" stroke="#0A0A0A" fontSize={11} fontFamily="JetBrains Mono" />
                    <YAxis stroke="#0A0A0A" fontSize={11} fontFamily="JetBrains Mono" tickFormatter={(v) => `₹${v}`} />
                    <Tooltip formatter={(v: number) => `₹${v}`} />
                    <Line type="monotone" dataKey="rupees" stroke="#0A0A0A" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="No revenue in the last 30 days." />
            )}
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-bold">Today by status</h2>
            </CardHeader>
            <CardBody>
              {hasStatus ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.statusToday}
                        dataKey="count"
                        nameKey="status"
                        innerRadius={50}
                        outerRadius={90}
                        stroke="#FAFAF7"
                      >
                        {data.statusToday.map((s) => (
                          <Cell
                            key={s.status}
                            fill={STATUS_COLORS[s.status] ?? "#525252"}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState text="No jobs today yet." />
              )}
              {hasStatus && (
                <ul className="mt-4 space-y-1 text-xs">
                  {data.statusToday.map((s) => (
                    <li key={s.status} className="flex items-center justify-between font-mono">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3"
                          style={{ background: STATUS_COLORS[s.status] ?? "#525252" }}
                        />
                        {s.status}
                      </span>
                      <span className="num">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-xl font-bold">Most printed paper types</h2>
            </CardHeader>
            <CardBody>
              {hasPaper ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.paperTypes} layout="vertical" margin={{ left: 60 }}>
                      <CartesianGrid stroke="#1A1A1A" strokeOpacity={0.1} horizontal={false} />
                      <XAxis type="number" stroke="#0A0A0A" fontSize={11} fontFamily="JetBrains Mono" />
                      <YAxis
                        dataKey="label"
                        type="category"
                        stroke="#0A0A0A"
                        fontSize={11}
                        fontFamily="JetBrains Mono"
                        width={90}
                      />
                      <Tooltip />
                      <Bar dataKey="pages" fill="#0A0A0A" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState text="No file data in this window." />
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Peak slot times</h2>
            <p className="text-sm text-ink/60 mt-1">Jobs by hour of day across last 30 days.</p>
          </CardHeader>
          <CardBody>
            {hasHours ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.peakHours}>
                    <CartesianGrid stroke="#1A1A1A" strokeOpacity={0.1} vertical={false} />
                    <XAxis
                      dataKey="hour"
                      stroke="#0A0A0A"
                      fontSize={11}
                      fontFamily="JetBrains Mono"
                      tickFormatter={(h) => `${h}h`}
                    />
                    <YAxis stroke="#0A0A0A" fontSize={11} fontFamily="JetBrains Mono" />
                    <Tooltip />
                    <Bar dataKey="count" fill="#EF3340" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="No slot data yet." />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, paise }: { label: string; paise: number }) {
  return (
    <div className="hairline bg-paper p-4">
      <div className="smallcaps text-ink/60">{label}</div>
      <div className="mt-2">
        <PriceDisplay paise={paise} size="md" />
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-10 text-ink/60 text-sm">
      <div className="smallcaps mb-1">Empty</div>
      <p>{text}</p>
    </div>
  );
}
