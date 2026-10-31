import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../lib/api";
import { fmtDateShort, fmtMonth, fmtTime, money, moneyShort, todayStr } from "../../lib/format";
import type { Dashboard } from "../../lib/types";
import { Badge, Card, Empty, PageHeader, Spinner, Stat, statusLabel, statusTone } from "../../components/ui";

export default function DashboardPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const q = useQuery({
    queryKey: ["dashboard", month],
    queryFn: async () => (await api.get<Dashboard>("/dashboard", { params: { month } })).data,
    refetchInterval: 60_000,
  });

  if (q.isLoading || !q.data) return <Spinner />;
  const d = q.data;
  const alerts = [
    d.alerts.openComplaints > 0 && { text: `${d.alerts.openComplaints} complaint${d.alerts.openComplaints > 1 ? "s" : ""} waiting for a reply`, to: "/app/feedback" },
    d.alerts.refundsDue > 0 && { text: `${d.alerts.refundsDue} deposit refund${d.alerts.refundsDue > 1 ? "s" : ""} to send`, to: "/app/calendar" },
    d.alerts.unassignedPayments > 0 && { text: `${d.alerts.unassignedPayments} M-Pesa payment${d.alerts.unassignedPayments > 1 ? "s" : ""} need matching`, to: "/app/money" },
    d.alerts.openCashUps > 0 && { text: `${d.alerts.openCashUps} cash-up${d.alerts.openCashUps > 1 ? "s" : ""} waiting for approval`, to: "/app/money" },
  ].filter(Boolean) as Array<{ text: string; to: string }>;

  const isCurrentMonth = month === todayStr().slice(0, 7);

  return (
    <div>
      <PageHeader
        title={`Hello, ${user?.name.split(" ")[0] ?? ""}`}
        subtitle="Here's how the salon is doing."
        actions={<input type="month" aria-label="Month" value={month} max={todayStr().slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-10 rounded-lg border border-line bg-white px-3 text-sm" />}
      />

      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map((a) => (
            <Link key={a.text} to={a.to} className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100">
              <span className="flex items-center gap-2"><AlertCircle className="size-4" aria-hidden /> {a.text}</span>
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Today's income" value={money(d.today.revenue)} hint={`${d.today.completedCount} completed`} />
        <Stat label="Today's bookings" value={d.today.bookingCount} hint={`${d.today.upcomingCount} still to come`} />
        <Stat label={`${fmtMonth(d.month).split(" ")[0]} income`} value={money(d.monthSummary.revenue)} hint={`${d.monthSummary.bookingCount} bookings`} />
        <Stat label={`${fmtMonth(d.month).split(" ")[0]} profit`} value={money(d.monthSummary.profit)} tone={d.monthSummary.profit < 0 ? "bad" : undefined} hint={`after ${money(d.monthSummary.expenses)} expenses`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="mb-1 text-lg font-semibold">Income, last 14 days</h2>
          <p className="mb-4 text-xs text-stone-500">Payments received per day (refunds deducted)</p>
          <BarChart data={d.trend} />
        </Card>

        <Card className="lg:col-span-2" padded={false}>
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="text-lg font-semibold">{isCurrentMonth ? "Coming up today" : "Today"}</h2>
            <Link to="/app/calendar" className="text-sm text-gold-700 hover:underline">Open calendar</Link>
          </div>
          {d.agenda.length === 0 ? (
            <Empty title="Nothing left today" hint="New bookings will appear here." />
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {d.agenda.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-12 text-sm font-semibold tabular-nums text-ink">{fmtTime(a.startAt)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.clientName}</span>
                    <span className="block truncate text-xs text-stone-500">{a.serviceName} · {a.staffName}</span>
                  </span>
                  <Badge tone={a.isPast ? "amber" : statusTone(a.status)}>{a.isPast ? "Overdue" : statusLabel(a.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <RankCard title="Top services" rows={d.topServices} />
        <RankCard title="Top stylists" rows={d.topStaff} />
        <Card>
          <h2 className="mb-3 text-lg font-semibold">How clients paid</h2>
          <ul className="space-y-2.5 text-sm">
            {(["MPESA", "CASH", "CARD"] as const).map((m) => (
              <li key={m} className="flex justify-between"><span className="text-stone-600">{m === "MPESA" ? "M-Pesa" : m === "CASH" ? "Cash" : "Card"}</span><span className="font-medium tabular-nums">{money(d.monthSummary.byMethod[m] ?? 0)}</span></li>
            ))}
            <li className="flex justify-between border-t border-line pt-2.5"><span className="text-stone-600">Commission owed</span><span className="font-medium tabular-nums">{money(d.monthSummary.commissionOwed)}</span></li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function RankCard({ title, rows }: { title: string; rows: Array<{ name: string; count: number; revenue: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-stone-500">No completed work yet this month.</p> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.name}>
              <div className="flex justify-between text-sm"><span className="truncate pr-2 font-medium">{r.name}</span><span className="tabular-nums text-stone-600">{money(r.revenue)}</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-stone-100"><div className="h-full rounded-full bg-gold-400" style={{ width: `${(r.revenue / max) * 100}%` }} /></div>
              <p className="mt-0.5 text-xs text-stone-500">{r.count} booking{r.count === 1 ? "" : "s"}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Minimal accessible bar chart: one series, labelled axis, hover/focus tooltips via <title>. */
function BarChart({ data }: { data: Array<{ date: string; revenue: number }> }) {
  const W = 640;
  const H = 200;
  const pad = { l: 40, r: 8, t: 8, b: 28 };
  const max = Math.max(1000, ...data.map((d) => d.revenue));
  const nice = Math.ceil(max / 1000) * 1000;
  const bw = (W - pad.l - pad.r) / data.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / nice);
  const ticks = [0, nice / 2, nice];
  const total = data.reduce((s, d) => s + d.revenue, 0);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Income per day, last 14 days. Total ${money(total)}.`} className="w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e9e1d0" strokeDasharray={t === 0 ? undefined : "3 3"} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#78716c">{moneyShort(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * bw + bw * 0.18;
          const h = Math.max(0, y(0) - y(d.revenue));
          return (
            <g key={d.date}>
              <rect x={x} y={y(d.revenue)} width={bw * 0.64} height={h} rx={3} fill={d.date === todayStr() ? "#a9761c" : "#d9a93c"}>
                <title>{`${fmtDateShort(d.date)}: ${money(d.revenue)}`}</title>
              </rect>
              {(i % 2 === 0 || data.length < 8) && <text x={x + bw * 0.32} y={H - 10} textAnchor="middle" fontSize="11" fill="#78716c">{fmtDateShort(d.date).split(" ").slice(-2).join(" ")}</text>}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
