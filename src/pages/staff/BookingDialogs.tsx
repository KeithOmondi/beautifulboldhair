import { useDeferredValue, useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Phone, Smartphone } from "lucide-react";
import toast from "react-hot-toast";
import { api, errorMessage } from "../../lib/api";
import { fmtClock12, fmtDateLong, fmtDateTime, fmtTime, money, telHref, toDateStr, todayPrice, todayStr } from "../../lib/format";
import { useServices, useStaffList } from "../../lib/queries";
import type { Booking, Client, PaymentMethod, Slot } from "../../lib/types";
import { Badge, Button, ErrorNote, Input, Modal, Select, Spinner, Textarea, Toggle, cx, statusLabel, statusTone } from "../../components/ui";
import { SlotGrid } from "../public/BookingPage";
import { RequestPaymentDialog } from "./RequestPaymentDialog";

const refreshBookingData = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: ["bookings"] });
  void qc.invalidateQueries({ queryKey: ["booking"] });
  void qc.invalidateQueries({ queryKey: ["dashboard"] });
  void qc.invalidateQueries({ queryKey: ["payments"] });
  void qc.invalidateQueries({ queryKey: ["clients"] });
};

/* ═══ Booking details + actions ═══════════════════════════════════════ */

type Mode = "view" | "pay" | "move" | "cancel";

export function BookingDetails({ bookingId, canEdit, onClose }: { bookingId: string | null; canEdit: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("view");
  const [asking, setAsking] = useState(false);

  useEffect(() => { setMode("view"); setAsking(false); }, [bookingId]);

  const q = useQuery({
    queryKey: ["booking", bookingId],
    enabled: Boolean(bookingId),
    queryFn: async () => (await api.get<Booking>(`/bookings/${bookingId}`)).data,
  });

  const noShow = useMutation({
    mutationFn: async () => (await api.patch<Booking>(`/bookings/${bookingId}/status`, { status: "NO_SHOW" })).data,
    onSuccess: () => { refreshBookingData(qc); toast.success("Marked as no-show"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const restore = useMutation({
    mutationFn: async () => (await api.patch<Booking>(`/bookings/${bookingId}/status`, { status: "CONFIRMED" })).data,
    onSuccess: () => { refreshBookingData(qc); toast.success("Booking restored"); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const b = q.data;
  const open = Boolean(bookingId);
  const live = b && (b.status === "CONFIRMED" || b.status === "PENDING");

  return (
    <Modal open={open} onClose={onClose} title={mode === "view" ? "Appointment" : mode === "pay" ? "Take payment" : mode === "move" ? "Reschedule" : "Cancel appointment"} wide={mode === "move"}>
      {q.isLoading || !b ? (
        <Spinner />
      ) : mode === "pay" ? (
        <CheckoutForm booking={b} onBack={() => setMode("view")} onDone={() => { refreshBookingData(qc); setMode("view"); }} />
      ) : mode === "move" ? (
        <RescheduleForm booking={b} onBack={() => setMode("view")} onDone={() => { refreshBookingData(qc); setMode("view"); }} />
      ) : mode === "cancel" ? (
        <CancelForm booking={b} onBack={() => setMode("view")} onDone={() => { refreshBookingData(qc); onClose(); }} />
      ) : (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-ink">{b.service.name}</p>
              <p className="text-sm text-stone-600">{fmtDateTime(b.startAt)} – {fmtTime(b.endAt)}</p>
              <p className="text-sm text-stone-600">with {b.staff.name}</p>
            </div>
            <Badge tone={statusTone(b.status)}>{statusLabel(b.status)}</Badge>
          </div>

          <div className="rounded-xl bg-cream p-4">
            <p className="font-medium text-ink">{b.client.name}</p>
            <a href={telHref(b.client.phone)} className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-gold-700 hover:underline">
              <Phone className="size-3.5" aria-hidden /> {b.client.phone}
            </a>
            {(b.allergies || b.client.allergies) && (
              <p className="mt-2 flex items-start gap-1.5 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> Allergies: {b.allergies ?? b.client.allergies}
              </p>
            )}
            {b.notes && <p className="mt-2 text-sm text-stone-600">Note: {b.notes}</p>}
            <p className="mt-2 text-xs text-stone-500">Booked via {b.source === "ONLINE" ? "the website" : b.source === "PHONE" ? "phone" : "walk-in"}</p>
          </div>

          <div>
            <h3 className="mb-2 font-sans text-sm font-semibold text-stone-700">Payment</h3>
            <dl className="space-y-1.5 text-sm">
              <Line label="Price" value={money(b.price)} />
              {b.discount > 0 && <Line label="Discount" value={`− ${money(b.discount)}`} />}
              <Line label="Paid so far" value={money(b.paidTotal)} />
              <Line label="Balance due" value={money(b.balance)} strong tone={b.balance > 0 && b.status !== "CANCELLED" ? "text-red-600" : "text-emerald-600"} />
            </dl>
            {b.payments.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-stone-500">
                {b.payments.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span>{p.kind === "DEPOSIT" && p.amount < b.price - b.discount ? "Deposit" : p.kind === "DEPOSIT" ? "Paid in full" : p.kind === "REFUND" ? "Refund" : "Payment"} · {p.method === "MPESA" ? `M-Pesa ${p.mpesaReceipt ?? ""}` : p.method === "CASH" ? "Cash" : "Card"}</span>
                    <span>{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            {b.depositRefundDue && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Deposit of {money(b.depositPaid)} needs to be refunded to the client (M-Pesa {b.client.phone}).
              </p>
            )}
          </div>

          {canEdit && (
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              {live && <Button variant="gold" onClick={() => setMode("pay")}>{b.balance > 0 ? "Take payment" : "Complete"}</Button>}
              {live && b.balance > 0 && <Button variant="outline" icon={<Smartphone className="size-4" />} onClick={() => setAsking(true)}>Ask to pay</Button>}
              {live && <Button variant="outline" onClick={() => setMode("move")}>Reschedule</Button>}
              {live && <Button variant="outline" loading={noShow.isPending} onClick={() => noShow.mutate()}>No-show</Button>}
              {b.status === "NO_SHOW" && <Button variant="outline" loading={restore.isPending} onClick={() => restore.mutate()}>Restore</Button>}
              {live && <Button variant="ghost" className="text-red-600" onClick={() => setMode("cancel")}>Cancel</Button>}
            </div>
          )}
        </div>
      )}
      {asking && b && <RequestPaymentDialog booking={{ id: b.id, clientName: b.client.name, phone: b.client.phone, balance: b.balance }} onClose={() => { setAsking(false); refreshBookingData(qc); }} />}
    </Modal>
  );
}

function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-stone-500">{label}</dt>
      <dd className={cx(strong && "font-semibold", tone)}>{value}</dd>
    </div>
  );
}

function CheckoutForm({ booking, onBack, onDone }: { booking: Booking; onBack: () => void; onDone: () => void }) {
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [discount, setDiscount] = useState(String(booking.discount || ""));
  const [receipt, setReceipt] = useState("");
  const [amountText, setAmountText] = useState(""); // empty = the whole balance
  const [given, setGiven] = useState(""); // cash the client handed over, to work out change
  const [asking, setAsking] = useState(false);

  const discountNum = Math.min(Number(discount) || 0, booking.price);
  const balance = Math.max(0, booking.price - discountNum - booking.paidTotal);
  const amount = amountText.trim() === "" ? balance : Math.round(Number(amountText) || 0);
  const amountOk = balance === 0 || (amount >= 1 && amount <= balance);
  const part = balance > 0 && amountOk && amount < balance;
  const givenNum = Math.round(Number(given) || 0);
  const change = method === "CASH" && givenNum > amount ? givenNum - amount : 0;
  const short = method === "CASH" && given.trim() !== "" && givenNum < amount;

  const pay = useMutation({
    mutationFn: async () =>
      (await api.post(`/bookings/${booking.id}/checkout`, {
        method,
        discount: discountNum,
        ...(balance > 0 ? { amount } : {}),
        ...(method === "MPESA" && balance > 0 ? { mpesaReceipt: receipt.trim().toUpperCase() } : {}),
        // Leaves a trail for the end-of-day cash count.
        ...(method === "CASH" && givenNum > amount ? { notes: `Cash given ${givenNum}, change ${change}` } : {}),
      })).data,
    onSuccess: () => { toast.success(part ? "Part payment recorded" : "Payment recorded"); onDone(); },
  });

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (amountOk && !short) pay.mutate(); }} className="space-y-4">
      {pay.isError && <ErrorNote>{errorMessage(pay.error)}</ErrorNote>}
      <div className="rounded-xl bg-cream p-4 text-sm">
        <Line label="Price" value={money(booking.price)} />
        <Line label="Already paid" value={money(booking.paidTotal)} />
        <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2">
          <span className="font-medium">To collect now</span>
          <span className="text-2xl font-semibold text-ink">{money(balance)}</span>
        </div>
      </div>
      <Input label="Discount (KES)" type="number" min={0} max={booking.price} value={discount} onChange={(e) => setDiscount(e.target.value)} hint="Discounts are recorded in the audit log." />
      {balance > 0 && (
        <>
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-stone-700">Paid with</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["CASH", "MPESA"] as const).map((m) => (
                <button type="button" key={m} onClick={() => setMethod(m)} aria-pressed={method === m} className={cx("rounded-lg border py-2.5 text-sm font-medium", method === m ? "border-ink bg-ink text-white" : "border-line bg-white")}>
                  {m === "MPESA" ? "M-Pesa" : "Cash"}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-stone-500">Card payments are coming soon.</p>
          </fieldset>

          <Input label="Amount received (KES)" type="number" min={1} max={balance} placeholder={String(balance)} value={amountText} onChange={(e) => setAmountText(e.target.value)} error={!amountOk ? `Enter between 1 and ${balance}` : undefined} hint="Leave empty for the full balance, or enter less for a part payment." />
          {part && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Part payment: {money(balance - amount)} will still be owed and the appointment stays open.</p>}

          {method === "CASH" && (
            <div>
              <Input label="Cash given by client (optional)" type="number" min={0} value={given} onChange={(e) => setGiven(e.target.value)} hint="Type what they handed over to see the change." />
              {change > 0 && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-lg font-semibold text-emerald-700">Give back {money(change)}</p>}
              {short && <p className="mt-2 text-sm text-red-600">That is {money(amount - givenNum)} short of {money(amount)}.</p>}
            </div>
          )}

          {method === "MPESA" && (
            <div className="space-y-3 rounded-xl border border-line p-3">
              <Button type="button" variant="outline" className="w-full" icon={<Smartphone className="size-4" />} disabled={!amountOk || balance === 0} onClick={() => setAsking(true)}>
                Send M-Pesa request to {booking.client.phone}
              </Button>
              <p className="text-center text-xs text-stone-500">or, if they already paid, enter the code from their M-Pesa SMS</p>
              <Input label="M-Pesa confirmation code" required maxLength={10} placeholder="e.g. SJK3L9QWER" value={receipt} onChange={(e) => setReceipt(e.target.value.toUpperCase())} hint="10 letters and numbers" />
            </div>
          )}
        </>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="submit" variant="gold" loading={pay.isPending} disabled={!amountOk || short}>{balance > 0 ? (part ? `Record ${money(amount)} part payment` : `Record ${money(balance)}`) : "Complete appointment"}</Button>
      </div>
      {asking && <RequestPaymentDialog booking={{ id: booking.id, clientName: booking.client.name, phone: booking.client.phone, balance: amount }} onClose={() => { setAsking(false); onDone(); }} />}
    </form>
  );
}

function CancelForm({ booking, onBack, onDone }: { booking: Booking; onBack: () => void; onDone: () => void }) {
  const [keep, setKeep] = useState(false);
  const cancel = useMutation({
    mutationFn: async () => (await api.post(`/bookings/${booking.id}/cancel`, { keepDeposit: keep })).data,
    onSuccess: () => { toast.success("Appointment cancelled"); onDone(); },
  });
  return (
    <div className="space-y-4">
      {cancel.isError && <ErrorNote>{errorMessage(cancel.error)}</ErrorNote>}
      <p className="text-sm text-stone-600">Cancel {booking.client.name}'s {booking.service.name} on {fmtDateTime(booking.startAt)}? They'll be notified by SMS.</p>
      {booking.depositPaid > 0 && (
        <Toggle checked={keep} onChange={setKeep} label={`Keep the ${money(booking.depositPaid)} deposit`} hint={keep ? "Client cancelled late. No refund." : "Otherwise a refund will be flagged for you to send."} />
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>Cancel appointment</Button>
      </div>
    </div>
  );
}

function RescheduleForm({ booking, onBack, onDone }: { booking: Booking; onBack: () => void; onDone: () => void }) {
  const [date, setDate] = useState(toDateStr(booking.startAt));
  const [slot, setSlot] = useState<Slot | null>(null);
  const slots = useQuery({
    queryKey: ["slots", booking.staff.id, booking.service.id, date],
    queryFn: async () => (await api.get<{ availableSlots: Slot[] }>("/availability", { params: { staffId: booking.staff.id, serviceId: booking.service.id, date } })).data.availableSlots,
  });
  const move = useMutation({
    mutationFn: async () => (await api.patch(`/bookings/${booking.id}/reschedule`, { newStartAt: slot!.startAt })).data,
    onSuccess: () => { toast.success("Appointment moved"); onDone(); },
  });
  return (
    <div className="space-y-4">
      {move.isError && <ErrorNote>{errorMessage(move.error)}</ErrorNote>}
      <Input label="New date" type="date" min={todayStr()} value={date} onChange={(e) => { setDate(e.target.value); setSlot(null); }} />
      {slots.isLoading ? <Spinner /> : slots.data?.length ? <SlotGrid slots={slots.data} selected={slot?.startAt} onSelect={setSlot} /> : <p className="py-4 text-center text-sm text-stone-500">{booking.staff.name} has no free times on this day.</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button variant="gold" disabled={!slot} loading={move.isPending} onClick={() => move.mutate()}>{slot ? `Move to ${fmtClock12(slot.startTime)}` : "Pick a time"}</Button>
      </div>
    </div>
  );
}

/* ═══ New booking ═════════════════════════════════════════════════════ */

export function NewBookingDialog({ initial, date: initialDate, onClose, onCreated }: { initial: { staffId?: string; time?: string }; date: string; onClose: () => void; onCreated: (date: string) => void }) {
  const qc = useQueryClient();
  const staff = useStaffList();
  const services = useServices();

  const [staffId, setStaffId] = useState(initial.staffId ?? "");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(initialDate);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [client, setClient] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState({ name: "", phone: "" });
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState<"WALKIN" | "PHONE">("WALKIN");

  const deferred = useDeferredValue(search.trim());
  const found = useQuery({
    queryKey: ["clients", "search", deferred],
    enabled: mode === "existing" && deferred.length >= 2,
    queryFn: async () => (await api.get<Client[]>("/clients", { params: { search: deferred } })).data.slice(0, 5),
  });

  const stylists = (staff.data ?? []).filter((s) => s.isActive && s.isBookable && (!serviceId || s.serviceIds.length === 0 || s.serviceIds.includes(serviceId)));
  const slots = useQuery({
    queryKey: ["slots", staffId, serviceId, date],
    enabled: Boolean(staffId && serviceId),
    queryFn: async () => (await api.get<{ availableSlots: Slot[] }>("/availability", { params: { staffId, serviceId, date } })).data.availableSlots,
  });

  // Pre-select the time that was clicked in the calendar.
  useEffect(() => {
    if (initial.time && slots.data && !slot) {
      const match = slots.data.find((s) => s.startTime === initial.time);
      if (match) setSlot(match);
    }
  }, [slots.data, initial.time, slot]);

  const create = useMutation({
    mutationFn: async () =>
      (await api.post("/bookings", {
        staffId,
        serviceId,
        startAt: slot!.startAt,
        source,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(mode === "existing" ? { clientId: client!.id } : { clientName: newClient.name.trim(), clientPhone: newClient.phone.trim() }),
      })).data,
    onSuccess: () => { refreshBookingData(qc); toast.success("Booking created"); onCreated(date); },
  });

  const clientReady = mode === "existing" ? Boolean(client) : newClient.name.trim().length >= 2 && newClient.phone.trim().length >= 9;
  const service = services.data?.find((s) => s.id === serviceId);

  return (
    <Modal
      open
      onClose={onClose}
      title="New booking"
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="gold" disabled={!slot || !clientReady} loading={create.isPending} onClick={() => create.mutate()}>
            {service && slot ? `Book · ${money(todayPrice(service))}` : "Book"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {create.isError && <ErrorNote>{errorMessage(create.error)}</ErrorNote>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Service" value={serviceId} onChange={(e) => { setServiceId(e.target.value); setSlot(null); setStaffId(""); }}>
            <option value="">Choose…</option>
            {services.data?.map((s) => <option key={s.id} value={s.id}>{s.name} · {money(todayPrice(s))}</option>)}
          </Select>
          <Select label="Stylist" value={staffId} onChange={(e) => { setStaffId(e.target.value); setSlot(null); }}>
            <option value="">Choose…</option>
            {stylists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Input label="Date" type="date" value={date} min={todayStr()} onChange={(e) => { setDate(e.target.value); setSlot(null); }} />
          <Select label="Booked via" value={source} onChange={(e) => setSource(e.target.value as "WALKIN" | "PHONE")}>
            <option value="WALKIN">Walk-in</option>
            <option value="PHONE">Phone call</option>
          </Select>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-stone-700">Time</p>
          {!staffId || !serviceId ? <p className="text-sm text-stone-500">Choose a service and stylist to see free times.</p> : slots.isLoading ? <Spinner /> : slots.data?.length ? <SlotGrid slots={slots.data} selected={slot?.startAt} onSelect={setSlot} /> : <p className="text-sm text-stone-500">No free times on {fmtDateLong(date)}. Try another day or stylist.</p>}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-stone-700">Client</p>
            <button type="button" className="text-sm text-gold-700 hover:underline" onClick={() => { setMode(mode === "existing" ? "new" : "existing"); setClient(null); }}>
              {mode === "existing" ? "New client instead" : "Find existing client"}
            </button>
          </div>
          {mode === "existing" ? (
            client ? (
              <div className="flex items-center justify-between rounded-lg border border-line bg-cream px-3 py-2 text-sm">
                <span><strong>{client.name}</strong> · {client.phone}</span>
                <button type="button" className="text-gold-700 hover:underline" onClick={() => setClient(null)}>Change</button>
              </div>
            ) : (
              <div>
                <input aria-label="Search clients" placeholder="Search by name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 w-full rounded-lg border border-line px-3" />
                {deferred.length >= 2 && (
                  <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-white">
                    {found.data?.map((c) => (
                      <li key={c.id}><button type="button" onClick={() => setClient(c)} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-stone-50"><span>{c.name}</span><span className="text-stone-500">{c.phone}</span></button></li>
                    ))}
                    {found.data?.length === 0 && <li className="px-3 py-2 text-sm text-stone-500">No match. Use “New client instead”.</li>}
                  </ul>
                )}
              </div>
            )
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Name" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
              <Input label="Phone" type="tel" placeholder="0712 345 678" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
            </div>
          )}
        </div>

        <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}
