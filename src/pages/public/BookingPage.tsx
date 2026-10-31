import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarPlus, Check, Clock, MapPin, Phone, Smartphone, Sparkles, UserRound } from "lucide-react";
import { api, errorCode, errorMessage } from "../../lib/api";
import { addDays, fmtDateLong, fmtDateShort, fmtDay, fmtDayNum, fmtDuration, fmtClock12, money, todayStr } from "../../lib/format";
import { Button, Card, ErrorNote, Input, Spinner, Textarea, cx } from "../../components/ui";
import { track, usePageMeta } from "../../lib/track";
import PublicShell from "./PublicShell";
import { BranchStep, branchLabel, chooseBranch, type PublicBranch } from "./BranchPicker";
import { publicBranch, setPublicBranch } from "../../lib/branch";
import { OTHER, groupByCategory, orderedCategories } from "../../lib/categories";
import {
  downloadIcs,
  usePublicInfo,
  usePublicServices,
  usePublicSlots,
  usePublicStaff,
  type PublicService,
  type PublicStaff,
} from "./publicApi";
import type { Slot } from "../../lib/types";

type Step = "service" | "stylist" | "time" | "details" | "pay" | "done";
const STEP_LABEL: Record<string, string> = { service: "Service", stylist: "Stylist", time: "Time", details: "Details" };

interface CreateResponse {
  holdId: string;
  requiresPayment: boolean;
  depositAmount: number;
  expiresAt: string;
  manageToken?: string;
}
interface HoldStatus {
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "CONFLICT";
  failureReason: string | null;
  booking: { manageToken: string; startAt: string; serviceName: string; staffName: string } | null;
}

/* Remember progress so a refresh, a phone call, or switching to the M-Pesa app does not lose it. */
const STORE_KEY = 'booking-progress-v1';
const STORE_TTL_MS = 3 * 60 * 60 * 1000;
interface Saved {
  /** The branch the draft was made for; a draft for another branch is dropped. */
  branch?: string;
  at: number;
  step: Step;
  service: PublicService | null;
  stylist: PublicStaff | 'any';
  date: string;
  slot: Slot | null;
  form: { name: string; phone: string; allergies: string };
  hold: CreateResponse | null;
  confirmed: { manageToken: string; startAt: string; endAt: string; serviceName: string; staffName: string } | null;
}
function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved;
    if (Date.now() - s.at > STORE_TTL_MS) return null;
    if ((s.branch ?? "") !== (publicBranch() ?? "")) return null;
    // A slot or date in the past is no longer valid; keep the rest of their choices.
    if (s.date < todayStr()) return { ...s, date: todayStr(), slot: null, step: s.step === 'details' || s.step === 'time' ? 'time' : s.step };
    return s;
  } catch {
    return null;
  }
}

export default function BookingPage() {
  usePageMeta("Book an appointment", "Choose a service, pick a time and confirm your booking online.");
  const [saved] = useState(loadSaved);
  const [params] = useSearchParams();
  const [agreed, setAgreed] = useState(false);
  const { data: info } = usePublicInfo();
  const services = usePublicServices();
  const branchList = useQuery({ queryKey: ["public-branches"], queryFn: async () => (await api.get<{ current: string; branches: PublicBranch[] }>("/public/branches")).data, staleTime: 60_000 });
  const [catFilter, setCatFilter] = useState("");
  const cats = orderedCategories(services.data ?? []);
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>(saved?.step ?? "service");
  const [service, setService] = useState<PublicService | null>(saved?.service ?? null);
  const [stylist, setStylist] = useState<PublicStaff | "any">(saved?.stylist ?? "any");
  const [date, setDate] = useState(saved?.date ?? todayStr());
  const [slot, setSlot] = useState<Slot | null>(saved?.slot ?? null);
  const [form, setForm] = useState(saved?.form ?? { name: "", phone: "", allergies: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hold, setHold] = useState<CreateResponse | null>(saved?.hold ?? null);
  const [confirmed, setConfirmed] = useState<{ manageToken: string; startAt: string; endAt: string; serviceName: string; staffName: string } | null>(saved?.confirmed ?? null);

  const showStylists = Boolean(info?.showStylists);
  const staff = usePublicStaff(service?.id, showStylists);
  const STEP_ORDER: Step[] = showStylists ? ["service", "stylist", "time", "details"] : ["service", "time", "details"];

  // A saved "stylist" step is meaningless once the salon auto-assigns.
  useEffect(() => {
    if (step === "stylist" && info && !info.showStylists) {
      setStylist("any");
      setStep("time");
    }
  }, [step, info]);

  const stylistId = stylist === "any" ? "any" : stylist.id;
  const slots = usePublicSlots(service?.id, stylistId, step === "time" ? date : undefined);

  const dates = useMemo(() => {
    const max = Math.min(info?.maxAheadDays ?? 30, 60);
    return Array.from({ length: Math.min(max, 28) + 1 }, (_, i) => addDays(todayStr(), i));
  }, [info?.maxAheadDays]);

  const back = () => {
    setError("");
    const i = STEP_ORDER.indexOf(step);
    if (i > 0) setStep(STEP_ORDER[i - 1]!);
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ branch: publicBranch() ?? "", at: Date.now(), step, service, stylist, date, slot, form, hold, confirmed } satisfies Saved));
    } catch {
      /* private mode / storage full: the booking still works, it just will not survive a refresh */
    }
  }, [step, service, stylist, date, slot, form, hold, confirmed]);

  // Arriving from the landing page with ?service=... skips straight past the service list.
  const wanted = params.get("service");
  const services_ = services.data;
  const preselected = useMemo(() => services_?.find((x) => x.id === wanted) ?? null, [services_, wanted]);
  useEffect(() => {
    if (preselected && step === "service" && !service) {
      track("service_selected");
      setService(preselected);
      setStep(showStylists ? "stylist" : "time");
    }
  }, [preselected, step, service, showStylists]);

  useEffect(() => {
    if (step === "details") track("details_view");
  }, [step]);

  const reset = () => {
    try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
    setForm((f) => ({ ...f, allergies: '' }));
    setStep("service");
    setService(null);
    setSlot(null);
    setHold(null);
    setConfirmed(null);
    setError("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!service || !slot) return;
    setError("");
    setSubmitting(true);
    track("booking_submitted");
    try {
      const { data } = await api.post<CreateResponse>("/public/bookings", {
        serviceId: service.id,
        ...(stylist !== "any" ? { staffId: stylist.id } : {}),
        startAt: slot.startAt,
        name: form.name.trim(),
        phone: form.phone.trim(),
        ...(form.allergies.trim() ? { allergies: form.allergies.trim() } : {}),
      });
      setHold(data);
      if (data.requiresPayment) {
        setStep("pay");
      } else {
        await finish(data.holdId);
      }
    } catch (err) {
      if (errorCode(err) === "SLOT_TAKEN") {
        setSlot(null);
        void qc.invalidateQueries({ queryKey: ["public-slots"] });
        setStep("time");
      }
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const finish = async (holdId: string) => {
    const { data } = await api.get<HoldStatus>(`/public/holds/${holdId}`);
    if (data.status === "PAID" && data.booking && service && slot) {
      track("booking_confirmed");
      setConfirmed({ ...data.booking, endAt: new Date(new Date(slot.startAt).getTime() + service.durationMin * 60_000).toISOString() });
      setStep("done");
    }
  };

  // While the client approves the M-Pesa prompt, check every few seconds.
  const poll = useQuery({
    queryKey: ["hold", hold?.holdId],
    enabled: step === "pay" && Boolean(hold),
    queryFn: async () => (await api.get<HoldStatus>(`/public/holds/${hold!.holdId}`)).data,
    refetchInterval: (q) => (q.state.data && q.state.data.status !== "PENDING" ? false : 3000),
    gcTime: 0,
  });

  useEffect(() => {
    const d = poll.data;
    if (!d || !service || !slot) return;
    if (d.status === "PAID" && d.booking) {
      track("booking_confirmed");
      setConfirmed({ ...d.booking, endAt: new Date(new Date(slot.startAt).getTime() + service.durationMin * 60_000).toISOString() });
      setStep("done");
    }
  }, [poll.data, service, slot]);

  const payFailed = poll.data && ["FAILED", "EXPIRED", "CONFLICT"].includes(poll.data.status);
  const deposit = service && info?.depositRequired ? Math.min(info.depositAmount, service.price) : 0;
  const stepIndex = STEP_ORDER.indexOf(step);

  /* ── Which branch? Asked before anything else when there is more than one and none was chosen yet ── */
  const branches = branchList.data?.branches ?? [];
  if (step !== "done" && branches.length > 1 && !publicBranch()) {
    return (
      <PublicShell>
        <BranchStep branches={branches} onPick={(slug) => chooseBranch(slug, "/book" + window.location.search.replace(/[?&]branch=[^&]*/, ""))} />
      </PublicShell>
    );
  }
  const currentBranch = branches.find((b) => b.slug === branchList.data?.current);

  /* ── Done ───────────────────────────────────────────────────────── */
  if (step === "done" && confirmed) {
    return (
      <PublicShell>
        <Card className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Check className="size-7" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold text-ink">You're booked!</h1>
          <p className="mt-1 text-sm text-stone-500">A confirmation SMS is on its way to {form.phone}.</p>

          <dl className="mx-auto mt-6 max-w-sm space-y-3 rounded-xl bg-cream p-4 text-left text-sm">
            <Row label="Service" value={confirmed.serviceName} />
            <Row label="Your stylist" value={confirmed.staffName} />
            <Row label="When" value={`${fmtDateLong(date)} · ${fmtClock12(slot!.startTime)}`} />
            {deposit > 0 && <Row label={deposit >= (service?.price ?? 0) ? "Paid" : "Deposit paid"} value={money(deposit)} />}
            {deposit < (service?.price ?? 0) && <Row label="Balance at salon" value={money((service?.price ?? 0) - deposit)} />}
          </dl>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button variant="outline" icon={<CalendarPlus className="size-4" />} onClick={() => downloadIcs({ title: `${confirmed.serviceName} at ${info?.name ?? "the salon"}`, startAt: confirmed.startAt, endAt: confirmed.endAt, location: info?.address ?? null })}>
              Add to calendar
            </Button>
            <Link to={`/manage/${confirmed.manageToken}`}>
              <Button variant="gold" className="w-full">View or change booking</Button>
            </Link>
          </div>
          <button onClick={reset} className="mt-5 text-sm text-stone-500 underline hover:text-ink">Book another appointment</button>
        </Card>
      </PublicShell>
    );
  }

  /* ── Waiting for M-Pesa ─────────────────────────────────────────── */
  if (step === "pay" && hold) {
    return (
      <PublicShell>
        <Card className="text-center">
          {payFailed ? (
            <>
              <h1 className="text-xl font-semibold text-ink">Payment not completed</h1>
              <p className="mt-2 text-sm text-stone-600">
                {poll.data?.status === "CONFLICT"
                  ? "Your payment arrived but the time was taken. The salon will contact you to rebook or refund you."
                  : "We didn't receive the M-Pesa payment, so the time wasn't reserved. You haven't been charged."}
              </p>
              {poll.data?.status !== "CONFLICT" && (
                <Button className="mt-6" variant="gold" onClick={() => { setHold(null); setStep("details"); }}>Try again</Button>
              )}
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-gold-50 text-gold-600">
                <Smartphone className="size-7" aria-hidden />
              </div>
              <h1 className="text-xl font-semibold text-ink">Check your phone</h1>
              <p className="mt-2 text-sm text-stone-600">
                We sent an M-Pesa request for <strong>{money(hold.depositAmount)}</strong> to <strong>{form.phone}</strong>. Enter your PIN to secure your appointment.
              </p>
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-stone-500" role="status">
                <span className="size-2 animate-pulse rounded-full bg-gold-500" /> Waiting for payment…
              </div>
              <p className="mt-6 text-xs text-stone-400">Your time is held for a few minutes. Don't close this page.</p>
              <button onClick={() => { setHold(null); setStep("details"); }} className="mt-3 text-sm text-stone-500 underline">Cancel</button>
            </>
          )}
        </Card>
      </PublicShell>
    );
  }

  /* ── Wizard ─────────────────────────────────────────────────────── */
  return (
    <PublicShell wide>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="min-w-0">
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-3">
          {stepIndex > 0 && (
            <button onClick={back} aria-label="Back" className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100">
              <ArrowLeft className="size-5" />
            </button>
          )}
          <ol className="flex flex-1 items-center gap-2" aria-label="Progress">
            {STEP_ORDER.map((s, i) => (
              <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === stepIndex ? "step" : undefined}>
                <span className={cx("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", i < stepIndex ? "bg-gold-500 text-ink" : i === stepIndex ? "bg-ink text-white" : "bg-stone-200 text-stone-500")}>{i < stepIndex ? <Check className="size-4" aria-hidden /> : i + 1}</span>
                <span className={cx("hidden text-sm sm:block", i === stepIndex ? "font-semibold text-ink" : "text-stone-400")}>{STEP_LABEL[s]}</span>
                {i < STEP_ORDER.length - 1 && <span className={cx("h-0.5 flex-1 rounded-full", i < stepIndex ? "bg-gold-500" : "bg-stone-200")} aria-hidden />}
              </li>
            ))}
          </ol>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>

      {step === "service" && (
        <section>
          <h1 className="mb-1 text-2xl font-semibold text-ink sm:text-3xl">Choose your service</h1>
          <p className="mb-5 text-sm text-stone-500">Pick what you'd like to book. You'll choose a time next.</p>
          {services.isLoading ? <Spinner /> : services.isError ? <ErrorNote>We couldn't load the services. Please refresh.</ErrorNote> : (
            <div>
              {cats.length > 1 && (
                <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Service categories">
                  {["", ...cats].map((c) => (
                    <button key={c || "all"} type="button" onClick={() => setCatFilter(c)} aria-pressed={catFilter === c} className={`rounded-full border px-4 py-1.5 text-sm font-medium ${catFilter === c ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-700 hover:border-gold-400"}`}>{c || "All"}</button>
                  ))}
                </div>
              )}
              {groupByCategory((services.data ?? []).filter((x) => !catFilter || (x.category ?? OTHER) === catFilter)).map((g) => (
                <div key={g.name} className="mb-8 last:mb-0">
                  {(cats.length > 1) && <h2 className="mb-3 font-display text-xl font-semibold text-ink">{g.name}</h2>}
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {g.items.map((s) => (
                      <li key={s.id}>
                        <button
                          onClick={() => { track("service_selected"); setService(s); setSlot(null); setStylist("any"); setStep(showStylists ? "stylist" : "time"); }}
                          className={cx("group relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:border-gold-400 hover:shadow-md", service?.id === s.id ? "border-gold-500 ring-1 ring-gold-500" : "border-line")}
                        >
                          {s.wasPrice != null && <span className="absolute top-2.5 left-2.5 z-10 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">-{Math.round((1 - s.price / s.wasPrice) * 100)}%</span>}
                          {s.imageUrl && <img src={s.imageUrl.replace("/image/upload/", "/image/upload/c_fill,w_700,h_340,q_auto,f_auto/")} alt="" loading="lazy" className="aspect-[2/1] w-full object-cover" />}
                          <span className="flex flex-1 flex-col p-4">
                            <span className="flex items-start justify-between gap-3">
                              <span className="font-medium text-ink">{s.name}</span>
                              <span className="shrink-0 text-right font-semibold text-ink">{s.wasPrice != null && <span className="mr-1.5 text-xs font-normal text-stone-400 line-through">{money(s.wasPrice)}</span>}<span className={s.wasPrice != null ? "text-red-600" : ""}>{money(s.price)}</span></span>
                            </span>
                            {s.description && <span className="mt-1 line-clamp-2 text-sm text-stone-500">{s.description}</span>}
                            <span className="mt-auto flex items-center justify-between pt-3 text-xs text-stone-500">
                              <span className="flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{fmtDuration(s.durationMin)}</span>
                              <span className="font-medium text-gold-700 group-hover:underline">Select →</span>
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {step === "stylist" && service && (
        <section>
          <h1 className="mb-1 text-2xl font-semibold text-ink">Who would you like?</h1>
          <p className="mb-5 text-sm text-stone-500">{service.name} · {fmtDuration(service.durationMin)}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <StylistCard title="First available" subtitle="Fastest way to get a slot" icon={<Sparkles className="size-5" />} onClick={() => { setStylist("any"); setSlot(null); setStep("time"); }} />
            {staff.data?.map((s) => (
              <StylistCard key={s.id} title={s.name} subtitle={s.title ?? "Stylist"} icon={<UserRound className="size-5" />} onClick={() => { setStylist(s); setSlot(null); setStep("time"); }} />
            ))}
          </div>
        </section>
      )}

      {step === "time" && service && (
        <section>
          <h1 className="mb-1 text-2xl font-semibold text-ink">Pick a date and time</h1>
          <p className="mb-4 text-sm text-stone-500">{service.name}{stylist === "any" ? "" : ` with ${stylist.name}`}</p>

          <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-2" role="listbox" aria-label="Date">
            {dates.map((d) => (
              <button
                key={d}
                role="option"
                aria-selected={d === date}
                onClick={() => { setDate(d); setSlot(null); }}
                className={cx("flex w-16 shrink-0 flex-col items-center rounded-xl border py-2.5 transition", d === date ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-gold-400")}
              >
                <span className="text-xs opacity-70">{fmtDay(d)}</span>
                <span className="text-lg font-semibold">{fmtDayNum(d)}</span>
              </button>
            ))}
          </div>

          <h2 className="mb-3 font-sans text-sm font-medium text-stone-700">{fmtDateLong(date)}</h2>
          {slots.isLoading ? <Spinner label="Checking availability" /> : slots.isError ? <ErrorNote>Couldn't load times. Please try again.</ErrorNote> : slots.data && slots.data.length === 0 ? (
            <Card className="text-center text-sm text-stone-500">Nothing available on this day. Try another date.</Card>
          ) : (
            <SlotGrid slots={slots.data ?? []} selected={slot?.startAt} onSelect={(sl) => { track("slot_selected"); setSlot(sl); }} />
          )}

          <div className="sticky bottom-0 -mx-4 mt-6 border-t border-line bg-white/95 px-4 py-3 backdrop-blur">
            <Button size="lg" variant="gold" className="w-full" disabled={!slot} onClick={() => setStep("details")}>
              {slot ? `Continue · ${fmtDateShort(date)} at ${fmtClock12(slot.startTime)}` : "Select a time"}
            </Button>
          </div>
        </section>
      )}

      {step === "details" && service && slot && (
        <form onSubmit={submit}>
          <h1 className="mb-1 text-2xl font-semibold text-ink">Your details</h1>
          <p className="mb-5 text-sm text-stone-500">We'll text your confirmation to this number.</p>

          <Card className="mb-5 bg-cream">
            <div className="flex items-start justify-between gap-3 text-sm">
              <div>
                <p className="font-medium text-ink">{service.name}</p>
                <p className="text-stone-600">{fmtDateLong(date)} · {fmtClock12(slot.startTime)}</p>
                {stylist !== "any" && <p className="text-stone-600">with {stylist.name}</p>}
              </div>
              <p className="font-semibold">{money(service.price)}</p>
            </div>
          </Card>

          <div className="space-y-4">
            <Input label="Full name" required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Phone number (M-Pesa)" type="tel" inputMode="tel" required autoComplete="tel" placeholder="0712 345 678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Textarea
              label="Allergies or sensitivities"
              placeholder="e.g. latex, adhesive, fragrance (optional)"
              hint={service.requiresPatchTest ? "This service may need a patch test. Please tell us about any reactions." : undefined}
              value={form.allergies}
              onChange={(e) => setForm({ ...form, allergies: e.target.value })}
            />
          </div>

          <div className="mt-5 rounded-xl border border-line bg-white p-4 text-sm">
            {deposit > 0 && deposit >= service.price ? (
              <p>
                This service costs <strong>{money(service.price)}</strong>, paid in full now by M-Pesa. You'll get a prompt next, and nothing is left to pay at the salon.
              </p>
            ) : deposit > 0 ? (
              <p>
                A <strong>{money(deposit)}</strong> deposit secures your slot — you'll get an M-Pesa prompt next. The remaining <strong>{money(service.price - deposit)}</strong> is paid at the salon.
              </p>
            ) : (
              <p>No payment needed now. Pay <strong>{money(service.price)}</strong> at the salon.</p>
            )}
            <p className="mt-2 text-xs text-stone-500">
              Free changes up to {info?.cancelWindowHours ?? 24} hours before your appointment. Later cancellations forfeit the deposit.
            </p>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-stone-700">
            <input type="checkbox" required checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-gold-500" />
            <span>I agree to the <Link to="/terms" target="_blank" className="underline">terms of service</Link> and <Link to="/privacy" target="_blank" className="underline">privacy policy</Link>.</span>
          </label>

          <Button type="submit" size="lg" variant="gold" className="mt-5 w-full" loading={submitting}>
            {deposit > 0 ? (deposit >= service.price ? `Pay ${money(deposit)} & book` : `Pay ${money(deposit)} deposit & book`) : "Confirm booking"}
          </Button>
        </form>
      )}
      </div>

      <aside className="lg:sticky lg:top-6" aria-label="Your booking">
        <div className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-sm">
          {currentBranch ? (
            <div>
              <p className="text-xs font-semibold tracking-widest text-stone-400 uppercase">Your branch</p>
              <p className="mt-1 font-display text-xl font-semibold text-ink">{branchLabel(currentBranch)}</p>
              <ul className="mt-2 space-y-1.5 text-sm text-stone-600">
                {currentBranch.address && <li className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-gold-700" aria-hidden />{currentBranch.address}</li>}
                {currentBranch.phone && <li className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0 text-gold-700" aria-hidden /><a href={`tel:${currentBranch.phone.replace(/\s/g, "")}`} className="hover:underline">{currentBranch.phone}</a></li>}
                {currentBranch.hours && <li className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0 text-gold-700" aria-hidden /><span className="whitespace-pre-line">{currentBranch.hours}</span></li>}
              </ul>
              {branches.length > 1 && <button type="button" onClick={() => { setPublicBranch(null); try { localStorage.removeItem("booking-progress-v1"); } catch { /* ignore */ } window.location.reload(); }} className="mt-3 text-sm font-medium text-gold-700 underline">Change branch</button>}
            </div>
          ) : info ? (
            <div><p className="font-display text-xl font-semibold text-ink">{info.name}</p>{info.address && <p className="mt-1 text-sm text-stone-600">{info.address}</p>}{info.phone && <p className="text-sm text-stone-600">{info.phone}</p>}</div>
          ) : null}

          <div className="border-t border-line pt-4">
            <p className="text-xs font-semibold tracking-widest text-stone-400 uppercase">Your booking</p>
            {service ? (
              <dl className="mt-2 space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-stone-500">Service</dt><dd className="text-right font-medium text-ink">{service.name}</dd></div>
                {stylist !== "any" && <div className="flex justify-between gap-3"><dt className="text-stone-500">With</dt><dd className="text-right font-medium text-ink">{stylist.name}</dd></div>}
                {slot && <div className="flex justify-between gap-3"><dt className="text-stone-500">When</dt><dd className="text-right font-medium text-ink">{fmtDateShort(date)} · {fmtClock12(slot.startTime)}</dd></div>}
                <div className="flex justify-between gap-3"><dt className="text-stone-500">Duration</dt><dd className="text-right text-ink">{fmtDuration(service.durationMin)}</dd></div>
                <div className="flex justify-between gap-3 border-t border-line pt-2 text-base"><dt className="font-semibold">Price</dt><dd className="font-semibold tabular-nums">{money(service.price)}</dd></div>
                {deposit > 0 && deposit < service.price && <div className="flex justify-between gap-3 text-xs text-stone-500"><dt>Deposit to book</dt><dd>{money(deposit)}</dd></div>}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-stone-500">Choose a service to see your booking here.</p>
            )}
          </div>

          <ul className="space-y-2 border-t border-line pt-4 text-xs text-stone-600">
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />Instant confirmation by SMS</li>
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />Free changes up to {info?.cancelWindowHours ?? 24} hours before</li>
            {deposit > 0 && <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />Secure M-Pesa payment</li>}
          </ul>
        </div>
      </aside>
      </div>
    </PublicShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function StylistCard({ title, subtitle, icon, onClick }: { title: string; subtitle: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-4 rounded-xl border border-line bg-white p-4 text-left shadow-sm transition hover:border-gold-400 hover:shadow">
      <span className="flex size-11 items-center justify-center rounded-full bg-gold-50 text-gold-600">{icon}</span>
      <span>
        <span className="block font-medium text-ink">{title}</span>
        <span className="block text-sm text-stone-500">{subtitle}</span>
      </span>
    </button>
  );
}

export function SlotGrid({ slots, selected, onSelect }: { slots: Slot[]; selected: string | undefined; onSelect: (s: Slot) => void }) {
  const groups = [
    { label: "Morning", items: slots.filter((s) => s.startTime < "12:00") },
    { label: "Afternoon", items: slots.filter((s) => s.startTime >= "12:00" && s.startTime < "17:00") },
    { label: "Evening", items: slots.filter((s) => s.startTime >= "17:00") },
  ].filter((g) => g.items.length);

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-2 text-xs font-medium tracking-wide text-stone-500 uppercase">{g.label}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {g.items.map((s) => (
              <button
                key={s.startAt}
                onClick={() => onSelect(s)}
                aria-pressed={selected === s.startAt}
                className={cx("rounded-lg border py-2.5 text-sm font-medium transition", selected === s.startAt ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-gold-400")}
              >
                {fmtClock12(s.startTime)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
