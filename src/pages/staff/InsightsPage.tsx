import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { fmtDateShort, money } from "../../lib/format";
import { Bars, Funnel } from "../../components/charts";
import { Card, PageHeader, Spinner, Stat, cx } from "../../components/ui";

interface Insights {
  days: number;
  traffic: {
    visitors: number;
    conversionRate: number | null;
    funnel: Array<{ label: string; count: number }>;
    sources: Array<{ name: string; visitors: number }>;
    devices: Array<{ name: string; visitors: number }>;
    dailyVisitors: Array<{ date: string; visitors: number }>;
  };
  business: {
    bookings: number;
    onlineShare: number | null;
    noShowRate: number | null;
    newClients: number;
    returningClients: number;
    byWeekday: Array<{ label: string; bookings: number }>;
    byHour: Array<{ label: string; bookings: number }>;
    byService: Array<{ name: string; count: number; revenue: number }>;
    byStylist: Array<{ name: string; count: number; revenue: number }>;
  };
}

const RANGES = [7, 30, 90] as const;
const pct = (n: number | null) => (n === null ? "—" : `${n}%`);

export default function InsightsPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const q = useQuery({ queryKey: ["insights", days], queryFn: async () => (await api.get<Insights>("/analytics", { params: { days } })).data });
  const d = q.data;

  return (
    <div>
      <PageHeader
        title="Insights"
        subtitle="How people find you, and how they book."
        actions={
          <div className="flex rounded-lg border border-line bg-white p-0.5" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button key={r} onClick={() => setDays(r)} aria-pressed={days === r} className={cx("rounded-md px-3.5 py-1.5 text-sm", days === r ? "bg-ink text-white" : "text-stone-600 hover:bg-stone-50")}>{r} days</button>
            ))}
          </div>
        }
      />

      {q.isLoading || !d ? <Spinner /> : (
        <div className="space-y-8">
          <section aria-labelledby="traffic-h">
            <h2 id="traffic-h" className="mb-3 text-xl font-semibold">Your website</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Visitors" value={d.traffic.visitors} hint="unique visits" />
              <Stat label="Booked online" value={d.traffic.funnel[5]?.count ?? 0} hint="confirmed bookings" />
              <Stat label="Conversion" value={pct(d.traffic.conversionRate)} hint="visitors who booked" />
              <Stat label="Online share" value={pct(d.business.onlineShare)} hint="of all bookings" />
            </div>

            {d.traffic.visitors === 0 ? (
              <Card className="mt-4 text-sm text-stone-600">No visits recorded yet. Share your booking link (Settings → Your booking website) on Instagram and WhatsApp, and numbers will appear here. Visits are counted without cookies or any personal data.</Card>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-5">
                <Card className="lg:col-span-3">
                  <h3 className="mb-3 font-sans text-base font-semibold">Visitors per day</h3>
                  <Bars label="Visitors per day" data={d.traffic.dailyVisitors.map((x) => ({ label: fmtDateShort(x.date).split(" ").slice(-2).join(" "), value: x.visitors }))} />
                </Card>
                <Card className="lg:col-span-2">
                  <h3 className="mb-3 font-sans text-base font-semibold">From booking page to confirmed</h3>
                  <Funnel steps={d.traffic.funnel} />
                </Card>
                <Card className="lg:col-span-3">
                  <h3 className="mb-3 font-sans text-base font-semibold">Where visitors come from</h3>
                  <ul className="space-y-2 text-sm">
                    {d.traffic.sources.map((s) => <li key={s.name} className="flex justify-between"><span>{s.name}</span><span className="tabular-nums text-stone-600">{s.visitors}</span></li>)}
                  </ul>
                </Card>
                <Card className="lg:col-span-2">
                  <h3 className="mb-3 font-sans text-base font-semibold">Devices</h3>
                  <ul className="space-y-2 text-sm">
                    {d.traffic.devices.map((s) => <li key={s.name} className="flex justify-between"><span className="capitalize">{s.name}</span><span className="tabular-nums text-stone-600">{s.visitors}</span></li>)}
                  </ul>
                </Card>
              </div>
            )}
          </section>

          <section aria-labelledby="biz-h">
            <h2 id="biz-h" className="mb-3 text-xl font-semibold">Your business</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Bookings" value={d.business.bookings} hint={`last ${d.days} days`} />
              <Stat label="No-show rate" value={pct(d.business.noShowRate)} hint="of finished appointments" tone={(d.business.noShowRate ?? 0) > 15 ? "bad" : undefined} />
              <Stat label="New clients" value={d.business.newClients} />
              <Stat label="Returning clients" value={d.business.returningClients} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card>
                <h3 className="mb-3 font-sans text-base font-semibold">Busiest days</h3>
                <Bars label="Bookings by day of week" data={d.business.byWeekday.map((x) => ({ label: x.label, value: x.bookings }))} color="#a9761c" />
              </Card>
              <Card>
                <h3 className="mb-3 font-sans text-base font-semibold">Busiest hours</h3>
                {d.business.byHour.length === 0 ? <p className="text-sm text-stone-500">No bookings in this period.</p> : <Bars label="Bookings by hour" data={d.business.byHour.map((x) => ({ label: x.label, value: x.bookings }))} color="#a9761c" />}
              </Card>
              <RankTable title="Income by service" rows={d.business.byService} />
              <RankTable title="Income by stylist" rows={d.business.byStylist} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function RankTable({ title, rows }: { title: string; rows: Array<{ name: string; count: number; revenue: number }> }) {
  return (
    <Card>
      <h3 className="mb-3 font-sans text-base font-semibold">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-stone-500">Nothing completed in this period yet.</p> : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-stone-500"><tr><th className="pb-2 font-medium">Name</th><th className="pb-2 text-right font-medium">Done</th><th className="pb-2 text-right font-medium">Income</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => <tr key={r.name}><td className="py-2">{r.name}</td><td className="py-2 text-right tabular-nums">{r.count}</td><td className="py-2 text-right font-medium tabular-nums">{money(r.revenue)}</td></tr>)}
          </tbody>
        </table>
      )}
    </Card>
  );
}
