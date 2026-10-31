import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { api, errorMessage } from "../../lib/api";
import { useSettings } from "../../lib/queries";
import { useAuth } from "../../auth/AuthContext";
import type { Settings } from "../../lib/types";
import { Button, Card, ErrorNote, Input, PageHeader, Spinner, Textarea, Toggle } from "../../components/ui";

export default function SettingsPage() {
  const q = useSettings();
  if (q.isLoading || !q.data) return <Spinner />;
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" subtitle="Your business details and booking rules." />
      <div className="space-y-6">
        <BookingLink />
        <OpeningHoursCard initial={q.data.openingHours} />
        <SettingsForm initial={q.data} />
        <Card>
          <h2 className="text-lg font-semibold">Your account</h2>
          <p className="mt-1 text-sm text-stone-500">Change your own sign-in password.</p>
          <Link to="/change-password" className="mt-3 inline-block"><Button variant="outline">Change password</Button></Link>
        </Card>
      </div>
    </div>
  );
}

function BookingLink() {
  const url = window.location.origin;
  return (
    <Card>
      <h2 className="text-lg font-semibold">Your booking website</h2>
      <p className="mt-1 text-sm text-stone-500">Share this link on Instagram, WhatsApp and Google so clients can book 24/7.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-cream px-3 py-2 text-sm">{url}</code>
        <Button variant="outline" icon={<Copy className="size-4" />} onClick={() => { void navigator.clipboard.writeText(url); toast.success("Link copied"); }}>Copy</Button>
        <a href={url} target="_blank" rel="noreferrer"><Button variant="outline" icon={<ExternalLink className="size-4" />}>Open</Button></a>
      </div>
    </Card>
  );
}

// Opening hours are saved by their own card; never send a possibly stale copy from this form.
const withoutHours = ({ openingHours: _omit, ...rest }: Settings) => rest;
// What managers may do is the owner's to change; anyone else sending it would be refused, so it is left out.
const withoutPermissions = ({ mgrReports: _a, mgrRefunds: _b, mgrCashUp: _c, mgrStaffPay: _d, ...rest }: Omit<Settings, "openingHours">) => rest;

function SettingsForm({ initial }: { initial: Settings }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [f, setF] = useState(initial);
  useEffect(() => setF(initial), [initial]);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setF({ ...f, [k]: v });
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) as never);

  const save = useMutation({
    mutationFn: async () => (await api.patch<Settings>("/settings", { ...(user?.role === "OWNER" ? withoutHours(f) : withoutPermissions(withoutHours(f))), phone: f.phone || null, address: f.address || null, tagline: f.tagline || null, about: f.about || null, instagram: f.instagram || null, whatsapp: f.whatsapp || null, hoursText: f.hoursText || null, announcement: f.announcement || null })).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["settings"] });
      void qc.invalidateQueries({ queryKey: ["access"] });
      void qc.invalidateQueries({ queryKey: ["public-info"] });
      void qc.invalidateQueries({ queryKey: ["public-info-full"] });
      void qc.invalidateQueries({ queryKey: ["public-staff"] });
      void qc.invalidateQueries({ queryKey: ["landing"] });
      toast.success("Settings saved");
    },
  });

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="space-y-6">
      {save.isError && <ErrorNote>{errorMessage(save.error)}</ErrorNote>}

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Business</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Business name" required value={f.name} onChange={(e) => set("name", e.target.value)} />
          <Input label="Phone" type="tel" value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} hint="Shown on the booking site and SMS." />
          <div className="sm:col-span-2"><Input label="Address" value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} /></div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-semibold">Your website</h2>
        <p className="mb-4 text-sm text-stone-500">What visitors read on your home page.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Input label="Announcement bar (optional)" maxLength={140} placeholder="e.g. Weekend offer: 10% off wig installs" value={f.announcement ?? ""} onChange={(e) => set("announcement", e.target.value)} hint="Shown in a gold bar at the very top of your website. Leave empty for none." /></div>
          <div className="sm:col-span-2"><Input label="Headline" maxLength={140} placeholder="Beautiful, bold and made for you" value={f.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} /></div>
          <div className="sm:col-span-2"><Textarea label="About your business" rows={4} maxLength={1200} placeholder="A few sentences about you, your team and what makes your work special." value={f.about ?? ""} onChange={(e) => set("about", e.target.value)} /></div>
          <div className="sm:col-span-2"><Textarea label="Opening hours note (optional)" rows={2} maxLength={300} placeholder="e.g. Closed on public holidays" value={f.hoursText ?? ""} onChange={(e) => set("hoursText", e.target.value)} hint="Shown on your website only when no opening days are set above." /></div>
          <Input label="Instagram username" placeholder="yoursalon" value={f.instagram ?? ""} onChange={(e) => set("instagram", e.target.value)} />
          <Input label="WhatsApp number" type="tel" placeholder="0712 345 678" value={f.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-semibold">Stylists</h2>
        <p className="mb-3 text-sm text-stone-500">By default clients pick a service and a time, and we assign a qualified, available stylist fairly. Turn this on if clients ask for people by name.</p>
        <Toggle checked={f.showStylists} onChange={(v) => set("showStylists", v)} label="Let clients choose their stylist" hint="Shows your team's names on the booking site." />
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-semibold">Deposits</h2>
        <p className="mb-3 text-sm text-stone-500">Ask for an M-Pesa deposit when clients book online. It reduces no-shows.</p>
        <Toggle checked={f.depositRequired} onChange={(v) => set("depositRequired", v)} label="Require a deposit to book online" />
        {f.depositRequired && (
          <div className="mt-3 max-w-xs"><Input label="Deposit amount (KES)" type="number" min={0} value={f.depositAmount} onChange={num("depositAmount")} hint="Capped at the service price. Needs M-Pesa to be set up." /></div>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Booking rules</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Minimum notice (hours)" type="number" min={0} value={f.minNoticeHours} onChange={num("minNoticeHours")} hint="How soon before the appointment clients can still book." />
          <Input label="Book ahead up to (days)" type="number" min={1} max={365} value={f.maxAheadDays} onChange={num("maxAheadDays")} />
          <Input label="Gap between appointments (min)" type="number" min={0} step={5} value={f.bufferMinutes} onChange={num("bufferMinutes")} hint="Time to reset between clients." />
          <Input label="Free cancellation until (hours before)" type="number" min={0} value={f.cancelWindowHours} onChange={num("cancelWindowHours")} hint="After this, the deposit is kept." />
          <Input label="Max bookings per client per day" type="number" min={1} max={10} value={f.maxBookingsPerDay} onChange={num("maxBookingsPerDay")} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-semibold">Online shop</h2>
        <p className="mb-4 text-sm text-stone-500">How customers pay and get what they order.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Delivery charge (KES)" type="number" min={0} value={f.shopDeliveryFee} onChange={num("shopDeliveryFee")} hint="0 means delivery is free." />
          <Input label="Free delivery above (KES, optional)" type="number" min={0} value={f.shopFreeOver ?? ""} onChange={(e) => set("shopFreeOver", e.target.value === "" ? null : Number(e.target.value))} hint="Leave empty to always charge delivery." />
        </div>
        <div className="mt-4"><Toggle checked={f.shopCodAllowed} onChange={(v) => set("shopCodAllowed", v)} label="Allow pay on delivery or collection" hint="Off means customers must pay with M-Pesa when they order." /></div>
      </Card>

      {user?.role === "OWNER" && (
        <Card>
          <h2 className="mb-1 text-lg font-semibold">What managers can do</h2>
          <p className="mb-4 text-sm text-stone-500">Managers always run the day: bookings, clients, services, orders and their team's rota. Money and pay stay with you unless you switch them on here. Receptionists and stylists can never do these.</p>
          <div className="space-y-1 rounded-xl border border-line p-4">
            <Toggle checked={f.mgrReports} onChange={(v) => set("mgrReports", v)} label="See sales reports and the dashboard" hint="Revenue, profit, expenses and how the business is doing." />
            <Toggle checked={f.mgrCashUp} onChange={(v) => set("mgrCashUp", v)} label="Approve the end-of-day cash count" hint="Locks the day's cash-up once counted." />
            <Toggle checked={f.mgrRefunds} onChange={(v) => set("mgrRefunds", v)} label="Refund payments and correct the books" hint="Refunds, marking unmatched M-Pesa payments as handled, and deleting expenses. Switch on only for managers you fully trust." />
            <Toggle checked={f.mgrStaffPay} onChange={(v) => set("mgrStaffPay", v)} label="See and change staff pay" hint="Salaries and commission rates. Payroll itself is always owner-only." />
          </div>
          <p className="mt-3 text-xs text-stone-500">Applies to managers of this branch only. Managers can never create, change or reset other managers or owners.</p>
        </Card>
      )}

      <div className="flex justify-end"><Button type="submit" variant="gold" size="lg" loading={save.isPending}>Save settings</Button></div>
    </form>
  );
}

const DAYS = [
  { n: 1, label: "Monday" }, { n: 2, label: "Tuesday" }, { n: 3, label: "Wednesday" }, { n: 4, label: "Thursday" },
  { n: 5, label: "Friday" }, { n: 6, label: "Saturday" }, { n: 0, label: "Sunday" },
];
type Hours = Record<string, { start: string; end: string } | null>;
const PRESETS: Array<{ label: string; days: number[] }> = [
  { label: "Monday to Friday", days: [1, 2, 3, 4, 5] },
  { label: "Monday to Saturday", days: [1, 2, 3, 4, 5, 6] },
  { label: "Every day (Monday to Sunday)", days: [1, 2, 3, 4, 5, 6, 0] },
];

/** The owner decides which days the salon is open and from when to when. Nobody can be booked outside these hours. */
function OpeningHoursCard({ initial }: { initial: Settings["openingHours"] }) {
  const qc = useQueryClient();
  const blank = (): Hours => Object.fromEntries(DAYS.map((d) => [String(d.n), initial?.[String(d.n)] ? { ...initial[String(d.n)]! } : null]));
  const [hours, setHours] = useState<Hours>(blank);
  const [unset, setUnset] = useState(!initial);
  useEffect(() => { setHours(blank()); setUnset(!initial); }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps

  const anyOpen = Object.values(hours).some(Boolean);
  const bad = Object.values(hours).some((h) => h && h.end <= h.start);

  const firstOpen = hours[String(DAYS.find((d) => hours[String(d.n)])?.n ?? 1)];
  const apply = (days: number[]) => {
    const base = firstOpen ?? { start: "09:00", end: "18:00" };
    setUnset(false);
    setHours(Object.fromEntries(DAYS.map((d) => [String(d.n), days.includes(d.n) ? { ...(hours[String(d.n)] ?? base) } : null])));
  };
  const setDay = (n: number, v: { start: string; end: string } | null) => { setUnset(false); setHours({ ...hours, [String(n)]: v }); };
  const copyToOpen = () => {
    if (!firstOpen) return;
    setHours(Object.fromEntries(DAYS.map((d) => [String(d.n), hours[String(d.n)] ? { ...firstOpen } : null])));
  };

  const save = useMutation({
    mutationFn: async (clear: boolean) => (await api.patch<Settings>("/settings", { openingHours: clear ? null : hours })).data,
    onSuccess: () => {
      for (const k of ["settings", "landing", "public-info", "public-info-full", "public-slots"]) void qc.invalidateQueries({ queryKey: [k] });
      toast.success(save.variables ? "Opening hours removed" : "Opening hours saved");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">Opening days & hours</h2>
      <p className="mb-4 text-sm text-stone-500">Choose the days the salon is open and the hours. Clients can only book inside these times, whatever an individual stylist's schedule says. Your website shows them automatically.</p>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Quick choices">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => apply(p.days)} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm hover:border-gold-400">{p.label}</button>
        ))}
      </div>

      <ul className="divide-y divide-line rounded-lg border border-line">
        {DAYS.map((d) => {
          const h = hours[String(d.n)];
          return (
            <li key={d.n} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <label className="flex w-36 items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="size-4 accent-gold-500" checked={Boolean(h)} onChange={(e) => setDay(d.n, e.target.checked ? (firstOpen ? { ...firstOpen } : { start: "09:00", end: "18:00" }) : null)} />
                {d.label}
              </label>
              {h ? (
                <div className="flex items-center gap-2 text-sm">
                  <input type="time" aria-label={`${d.label} opens`} value={h.start} onChange={(e) => setDay(d.n, { ...h, start: e.target.value })} className="rounded-lg border border-line px-2 py-1.5" />
                  <span className="text-stone-500">to</span>
                  <input type="time" aria-label={`${d.label} closes`} value={h.end} onChange={(e) => setDay(d.n, { ...h, end: e.target.value })} className={`rounded-lg border px-2 py-1.5 ${h.end <= h.start ? "border-red-400" : "border-line"}`} />
                </div>
              ) : <span className="text-sm text-stone-400">Closed</span>}
            </li>
          );
        })}
      </ul>
      {bad && <div className="mt-3"><ErrorNote>A closing time must be later than its opening time.</ErrorNote></div>}
      {!anyOpen && !unset && <div className="mt-3"><ErrorNote>Open at least one day.</ErrorNote></div>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3 text-sm">
          <button type="button" onClick={copyToOpen} disabled={!firstOpen} className="text-gold-700 underline disabled:opacity-40">Use the first open day's hours for all open days</button>
          {initial && <button type="button" onClick={() => { setUnset(true); save.mutate(true); }} className="text-stone-500 underline">Remove limits</button>}
        </div>
        <Button variant="gold" disabled={bad || !anyOpen} loading={save.isPending} onClick={() => { setUnset(false); save.mutate(false); }}>Save opening hours</Button>
      </div>
      {unset && <p className="mt-2 text-xs text-stone-500">No salon-wide hours are set, so each stylist's own schedule decides when they can be booked.</p>}
    </Card>
  );
}
