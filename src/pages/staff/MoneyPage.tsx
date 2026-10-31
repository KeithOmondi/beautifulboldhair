import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Plus, Receipt, Smartphone, Undo2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAccess } from "../../lib/queries";
import { useAuth } from "../../auth/AuthContext";
import { api, errorMessage } from "../../lib/api";
import { addDays, fmtDateShort, fmtMonth, fmtTime, money, toDateStr, todayStr } from "../../lib/format";
import type { Booking, Payment } from "../../lib/types";
import { BookingDetails } from "./BookingDialogs";
import { RequestPaymentDialog } from "./RequestPaymentDialog";
import { Badge, Button, Card, Confirm, Empty, ErrorNote, Input, Modal, PageHeader, Select, Spinner, Tabs, Textarea } from "../../components/ui";

type Tab = "payments" | "owing" | "unmatched" | "cashup" | "expenses";

export default function MoneyPage() {
  const access = useAccess();
  const { user } = useAuth();
  const canSeeExpenses = user?.role === "OWNER" || user?.role === "MANAGER";
  const [tab, setTab] = useState<Tab>("payments");

  const pending = useQuery({ queryKey: ["pending-payments"], queryFn: async () => (await api.get<PendingPayment[]>("/payments/pending")).data });
  const owing = useOwing();

  const tabs: Array<{ id: Tab; label: string; badge?: number }> = [
    { id: "payments", label: "Payments" },
    { id: "owing", label: "Still owing", ...(owing.data?.length ? { badge: owing.data.length } : {}) },
    { id: "unmatched", label: "Needs matching", ...(pending.data?.length ? { badge: pending.data.length } : {}) },
    { id: "cashup", label: "Cash-up" },
    ...(canSeeExpenses ? [{ id: "expenses" as const, label: "Expenses" }] : []),
  ];

  return (
    <div>
      <PageHeader title="Money" subtitle="Payments, M-Pesa matching, end-of-day cash and expenses." />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === "payments" && <PaymentsTab />}
      {tab === "owing" && <OwingTab items={owing.data ?? []} loading={owing.isLoading} />}
      {tab === "unmatched" && <UnmatchedTab items={pending.data ?? []} loading={pending.isLoading} />}
      {tab === "cashup" && <CashUpTab canApprove={access.cashUp} />}
      {tab === "expenses" && canSeeExpenses && <ExpensesTab />}
    </div>
  );
}

/* ═══ Still owing ════════════════════════════════════════════════════ */

/** Appointments that have started (or passed) with money still to collect. */
function useOwing() {
  return useQuery({
    queryKey: ["bookings", "owing"],
    queryFn: async () => {
      const rows = (await api.get<Booking[]>("/bookings", { params: { from: addDays(todayStr(), -90), to: todayStr() } })).data;
      const now = Date.now();
      return rows
        .filter((b) => b.balance > 0 && (b.status === "CONFIRMED" || b.status === "PENDING" || b.status === "COMPLETED") && new Date(b.startAt).getTime() <= now)
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    },
    refetchInterval: 60_000,
  });
}

function OwingTab({ items, loading }: { items: Booking[]; loading: boolean }) {
  const [asking, setAsking] = useState<Booking | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const total = items.reduce((s, b) => s + b.balance, 0);

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-stone-600">Clients whose appointment has started but who still owe money. Send an M-Pesa prompt to their phone, or open the booking to take cash.</p>
      {items.length > 0 && <div className="mb-3"><Badge tone="red">{items.length} owing · {money(total)} in total</Badge></div>}
      <Card padded={false}>
        {loading ? <Spinner /> : items.length === 0 ? <Empty icon={<Banknote className="size-6" />} title="Nobody owes anything" hint="Every started appointment is paid in full." /> : (
          <ul className="divide-y divide-line">
            {items.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{b.client.name} · <span className="text-red-600">{money(b.balance)}</span></span>
                  <span className="block truncate text-xs text-stone-500">{b.service.name} · {fmtDateShort(toDateStr(b.startAt))} · paid {money(b.paidTotal)} of {money(b.amountDue)} · {b.client.phone}</span>
                </span>
                <Button size="sm" variant="gold" icon={<Smartphone className="size-4" />} onClick={() => setAsking(b)}>Ask to pay</Button>
                <Button size="sm" variant="outline" onClick={() => setPaying(b.id)}>Take cash</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {asking && <RequestPaymentDialog booking={{ id: asking.id, clientName: asking.client.name, phone: asking.client.phone, balance: asking.balance }} onClose={() => setAsking(null)} />}
      <BookingDetails bookingId={paying} canEdit onClose={() => setPaying(null)} />
    </div>
  );
}

/* ═══ Payments ═══════════════════════════════════════════════════════ */

type PaymentRow = Payment & { booking: { id: string; price: number; discount: number; client: { name: string }; service: { name: string } } | null; notes: string | null };

function PaymentsTab() {
  const access = useAccess();
  const qc = useQueryClient();
  const [date, setDate] = useState(todayStr());
  const [refunding, setRefunding] = useState<PaymentRow | null>(null);
  const q = useQuery({ queryKey: ["payments", date], queryFn: async () => (await api.get<PaymentRow[]>("/payments", { params: { date } })).data });

  const refund = useMutation({
    mutationFn: async (id: string) => (await api.post(`/payments/${id}/refund`)).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["payments"] }); void qc.invalidateQueries({ queryKey: ["dashboard"] }); void qc.invalidateQueries({ queryKey: ["bookings"] }); toast.success("Refund recorded"); setRefunding(null); },
    onError: (e) => { toast.error(errorMessage(e)); setRefunding(null); },
  });

  const rows = q.data ?? [];
  const sum = (m: string) => rows.filter((r) => r.method === m).reduce((s, r) => s + r.amount, 0);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const refundedIds = new Set(rows.filter((r) => r.kind === "REFUND").map((r) => r.notes?.replace("Refund for payment ", "")));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input type="date" aria-label="Date" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-10 rounded-lg border border-line bg-white px-3 text-sm" />
        <Button variant="outline" onClick={() => setDate(addDays(date, -1))}>Previous day</Button>
        <div className="ml-auto flex flex-wrap gap-2 text-sm">
          <Badge tone="gold">Total {money(total)}</Badge>
          <Badge>Cash {money(sum("CASH"))}</Badge>
          <Badge>M-Pesa {money(sum("MPESA"))}</Badge>
          {sum("CARD") !== 0 && <Badge>Card {money(sum("CARD"))}</Badge>}
        </div>
      </div>
      <Card padded={false}>
        {q.isLoading ? <Spinner /> : rows.length === 0 ? <Empty icon={<Receipt className="size-6" />} title="No payments on this day" /> : (
          <ul className="divide-y divide-line">
            {rows.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="w-12 text-sm tabular-nums text-stone-500">{fmtTime(p.createdAt)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.booking?.client.name ?? "Unlinked payment"}</span>
                  <span className="block truncate text-xs text-stone-500">
                    {p.booking?.service.name ?? "—"} · {p.kind === "DEPOSIT" && (!p.booking || p.amount < p.booking.price - p.booking.discount) ? "Deposit" : p.kind === "DEPOSIT" ? "Paid in full" : p.kind === "REFUND" ? "Refund" : "Payment"} · {p.method === "MPESA" ? `M-Pesa ${p.mpesaReceipt ?? ""}` : p.method === "CASH" ? "Cash" : "Card"}
                  </span>
                </span>
                <span className={`text-sm font-semibold tabular-nums ${p.amount < 0 ? "text-red-600" : ""}`}>{money(p.amount)}</span>
                {p.kind !== "REFUND" && !refundedIds.has(p.id) && access.refunds && (
                  <button aria-label="Refund this payment" title="Refund" onClick={() => setRefunding(p)} className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-red-600"><Undo2 className="size-4" /></button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Confirm
        open={Boolean(refunding)}
        onClose={() => setRefunding(null)}
        title="Refund this payment?"
        danger
        confirmLabel="Record refund"
        loading={refund.isPending}
        onConfirm={() => refunding && refund.mutate(refunding.id)}
        body={<>This records a refund of <strong>{refunding ? money(refunding.amount) : ""}</strong> in your books. Remember to send the money back to the client yourself (M-Pesa or cash).</>}
      />
    </div>
  );
}

/* ═══ Unmatched M-Pesa ═══════════════════════════════════════════════ */

interface PendingPayment { id: string; amount: number; mpesaReceipt: string; phone: string; accountRef: string | null; createdAt: string }

function UnmatchedTab({ items, loading }: { items: PendingPayment[]; loading: boolean }) {
  const access = useAccess();
  const qc = useQueryClient();
  const [assigning, setAssigning] = useState<PendingPayment | null>(null);
  const dismiss = useMutation({
    mutationFn: async (id: string) => (await api.post(`/payments/pending/${id}/dismiss`)).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["pending-payments"] }); void qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Marked as handled"); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-stone-600">These M-Pesa payments arrived but couldn't be matched to a booking automatically (for example a deposit paid for a slot that was taken). Match each to a booking, or mark it handled once you've refunded the client.</p>
      <Card padded={false}>
        {loading ? <Spinner /> : items.length === 0 ? <Empty icon={<Banknote className="size-6" />} title="All caught up" hint="Every M-Pesa payment is matched to a booking." /> : (
          <ul className="divide-y divide-line">
            {items.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{money(p.amount)} from {p.phone}</span>
                  <span className="block text-xs text-stone-500">Receipt {p.mpesaReceipt} · {fmtDateShort(toDateStr(p.createdAt))} {fmtTime(p.createdAt)}{p.accountRef ? ` · ${p.accountRef}` : ""}</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => setAssigning(p)}>Match to booking</Button>
                <Button size="sm" variant="ghost" loading={dismiss.isPending && dismiss.variables === p.id} onClick={() => dismiss.mutate(p.id)} disabled={!access.refunds} title={access.refunds ? undefined : "Only the owner can mark this handled"}>Mark handled</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {assigning && <AssignDialog payment={assigning} onClose={() => setAssigning(null)} />}
    </div>
  );
}

function AssignDialog({ payment, onClose }: { payment: PendingPayment; onClose: () => void }) {
  const qc = useQueryClient();
  const [bookingId, setBookingId] = useState("");
  const q = useQuery({
    queryKey: ["bookings", "unpaid"],
    queryFn: async () => (await api.get<Booking[]>("/bookings", { params: { from: addDays(todayStr(), -30), to: addDays(todayStr(), 30) } })).data.filter((b) => b.balance > 0 && b.status !== "CANCELLED" && b.status !== "NO_SHOW"),
  });
  const assign = useMutation({
    mutationFn: async () => (await api.post("/payments/pending/assign", { pendingId: payment.id, bookingId })).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["pending-payments"] }); void qc.invalidateQueries({ queryKey: ["bookings"] }); void qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Payment matched"); onClose(); },
  });
  return (
    <Modal open onClose={onClose} title="Match payment to a booking" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="gold" disabled={!bookingId} loading={assign.isPending} onClick={() => assign.mutate()}>Match {money(payment.amount)}</Button></>}>
      {assign.isError && <div className="mb-3"><ErrorNote>{errorMessage(assign.error)}</ErrorNote></div>}
      {q.isLoading ? <Spinner /> : (
        <Select label="Booking with a balance" value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
          <option value="">Choose a booking…</option>
          {q.data?.map((b) => <option key={b.id} value={b.id}>{fmtDateShort(toDateStr(b.startAt))} · {b.client.name} · {b.service.name} · owes {money(b.balance)}</option>)}
        </Select>
      )}
    </Modal>
  );
}

/* ═══ Cash-up ════════════════════════════════════════════════════════ */

interface CashUp { id: string; businessDate: string; expectedCash: number; countedCash: number; difference: number; locked: boolean; notes: string | null }

function CashUpTab({ canApprove }: { canApprove: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cash-ups"], queryFn: async () => (await api.get<CashUp[]>("/cash-up")).data });
  const [date, setDate] = useState(todayStr());
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => (await api.post("/cash-up", { businessDate: date, countedCash: Number(counted), ...(notes.trim() ? { notes: notes.trim() } : {}) })).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["cash-ups"] }); void qc.invalidateQueries({ queryKey: ["dashboard"] }); setCounted(""); setNotes(""); toast.success("Cash-up saved"); },
  });
  const approve = useMutation({
    mutationFn: async (id: string) => (await api.post(`/cash-up/${id}/approve`)).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["cash-ups"] }); void qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Approved and locked"); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2 lg:self-start">
        <h2 className="mb-1 text-lg font-semibold">Count the till</h2>
        <p className="mb-4 text-sm text-stone-500">Count the cash in the drawer and enter the total. We compare it with the cash payments recorded for that day.</p>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
          {create.isError && <ErrorNote>{errorMessage(create.error)}</ErrorNote>}
          <Input label="Day" type="date" max={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Cash counted (KES)" type="number" min={0} required value={counted} onChange={(e) => setCounted(e.target.value)} />
          <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button type="submit" variant="gold" className="w-full" loading={create.isPending}>Save cash-up</Button>
        </form>
      </Card>

      <Card padded={false} className="lg:col-span-3">
        {q.isLoading ? <Spinner /> : q.data?.length === 0 ? <Empty icon={<Banknote className="size-6" />} title="No cash-ups yet" /> : (
          <ul className="divide-y divide-line">
            {q.data?.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{fmtDateShort(toDateStr(c.businessDate))}</span>
                  <span className="block text-xs text-stone-500">Expected {money(c.expectedCash)} · Counted {money(c.countedCash)}</span>
                </span>
                <Badge tone={c.difference === 0 ? "green" : c.difference < 0 ? "red" : "amber"}>{c.difference === 0 ? "Balanced" : `${c.difference > 0 ? "Over" : "Short"} ${money(Math.abs(c.difference))}`}</Badge>
                {c.locked ? <Badge tone="gray">Locked</Badge> : canApprove ? <Button size="sm" variant="outline" loading={approve.isPending && approve.variables === c.id} onClick={() => approve.mutate(c.id)}>Approve</Button> : <Badge tone="amber">Awaiting approval</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ═══ Expenses ═══════════════════════════════════════════════════════ */

interface Expense { id: string; category: string; amount: number; note: string | null; spentAt: string }
const CATEGORIES = ["Supplies", "Rent", "Utilities", "Marketing", "Equipment", "Transport", "Other"];

function ExpensesTab() {
  const access = useAccess();
  const qc = useQueryClient();
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["expenses", month], queryFn: async () => (await api.get<Expense[]>("/expenses", { params: { month } })).data });
  const total = (q.data ?? []).reduce((s, e) => s + e.amount, 0);

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/expenses/${id}`)).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["expenses"] }); void qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input type="month" aria-label="Month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-10 rounded-lg border border-line bg-white px-3 text-sm" />
        <Badge tone="gold">{fmtMonth(month)}: {money(total)}</Badge>
        <Button className="ml-auto" variant="gold" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Add expense</Button>
      </div>
      <Card padded={false}>
        {q.isLoading ? <Spinner /> : q.data?.length === 0 ? <Empty icon={<Receipt className="size-6" />} title="No expenses recorded" hint="Track rent, supplies and more to see your real profit on the dashboard." /> : (
          <ul className="divide-y divide-line">
            {q.data?.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{e.category}</span><span className="block truncate text-xs text-stone-500">{fmtDateShort(toDateStr(e.spentAt))}{e.note ? ` · ${e.note}` : ""}</span></span>
                <span className="text-sm font-semibold tabular-nums">{money(e.amount)}</span>
                {access.refunds && <button onClick={() => remove.mutate(e.id)} className="text-xs text-stone-400 hover:text-red-600">Delete</button>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {open && <AddExpenseDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function AddExpenseDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ category: "Supplies", amount: "", note: "", spentOn: todayStr() });
  const m = useMutation({
    mutationFn: async () => (await api.post("/expenses", { category: f.category, amount: Number(f.amount), spentOn: f.spentOn, ...(f.note.trim() ? { note: f.note.trim() } : {}) })).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["expenses"] }); void qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Expense added"); onClose(); },
  });
  return (
    <Modal open onClose={onClose} title="Add expense" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="gold" loading={m.isPending} onClick={() => m.mutate()}>Add</Button></>}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
        {m.isError && <ErrorNote>{errorMessage(m.error)}</ErrorNote>}
        <Select label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Amount (KES)" type="number" min={1} required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <Input label="Date" type="date" max={todayStr()} value={f.spentOn} onChange={(e) => setF({ ...f, spentOn: e.target.value })} />
        </div>
        <Input label="Note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </form>
    </Modal>
  );
}
