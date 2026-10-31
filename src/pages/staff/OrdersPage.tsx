import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, MapPin, Package, Phone, Search, Smartphone, Store, Truck } from "lucide-react";
import toast from "react-hot-toast";
import { api, errorMessage } from "../../lib/api";
import { fmtDateTime, money, telHref } from "../../lib/format";
import { Badge, Button, Card, Empty, ErrorNote, Input, Modal, PageHeader, Spinner, Tabs } from "../../components/ui";
import { img } from "../shop/shopApi";

type Status = "PENDING_PAYMENT" | "CONFIRMED" | "READY" | "COMPLETED" | "CANCELLED";
interface Order {
  id: string; label: string; status: Status; paymentStatus: "UNPAID" | "PAID" | "FAILED"; payMethod: "MPESA" | "ON_DELIVERY";
  fulfilment: "DELIVERY" | "PICKUP"; name: string; phone: string; email: string | null; address: string | null; area: string | null; notes: string | null;
  subtotal: number; deliveryFee: number; total: number; createdAt: string; cancelReason: string | null;
  items: Array<{ id: string; name: string; unitPrice: number; quantity: number; image: string | null }>;
  payments: Array<{ id: string; amount: number; method: "CASH" | "MPESA" | "CARD"; mpesaReceipt: string | null; paidAt: string }>;
}

const STATUS: Record<Status, { label: (o: Order) => string; tone: "amber" | "gold" | "green" | "gray" | "red" }> = {
  PENDING_PAYMENT: { label: () => "Awaiting M-Pesa", tone: "amber" },
  CONFIRMED: { label: () => "New", tone: "gold" },
  READY: { label: (o) => (o.fulfilment === "DELIVERY" ? "Out for delivery" : "Ready to collect"), tone: "green" },
  COMPLETED: { label: (o) => (o.fulfilment === "DELIVERY" ? "Delivered" : "Collected"), tone: "gray" },
  CANCELLED: { label: () => "Cancelled", tone: "red" },
};

type Tab = "CONFIRMED" | "READY" | "PENDING_PAYMENT" | "COMPLETED" | "CANCELLED" | "ALL";

export default function OrdersPage() {
  const [tab, setTab] = useState<Tab>("CONFIRMED");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["shop-orders"], queryFn: async () => (await api.get<Order[]>("/shop/orders")).data, refetchInterval: 30_000 });
  const all = q.data ?? [];
  const count = (s: Status) => all.filter((o) => o.status === s).length;
  const shown = all
    .filter((o) => tab === "ALL" || o.status === tab)
    .filter((o) => !search.trim() || `${o.label} ${o.name} ${o.phone}`.toLowerCase().includes(search.trim().toLowerCase()));
  const current = all.find((o) => o.id === open) ?? null;

  return (
    <div>
      <PageHeader title="Online orders" subtitle="What customers have bought from your website. New orders are texted to your phone." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "CONFIRMED", label: "New", ...(count("CONFIRMED") ? { badge: count("CONFIRMED") } : {}) },
        { id: "READY", label: "Ready / out", ...(count("READY") ? { badge: count("READY") } : {}) },
        { id: "PENDING_PAYMENT", label: "Awaiting payment" },
        { id: "COMPLETED", label: "Completed" },
        { id: "CANCELLED", label: "Cancelled" },
        { id: "ALL", label: "All" },
      ]} />
      <div className="relative my-4 max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order number, name or phone" aria-label="Search orders" className="h-10 w-full rounded-lg border border-line bg-white pr-3 pl-9 text-sm" />
      </div>

      {q.isLoading ? <Spinner /> : q.isError ? <ErrorNote>{errorMessage(q.error)}</ErrorNote> : shown.length === 0 ? (
        <Card><Empty icon={<Package className="size-6" />} title="No orders here" hint={all.length === 0 ? "When someone buys from your website, it shows up here." : "Try another tab or search."} /></Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {shown.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => setOpen(o.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cream/60 sm:px-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-700">{o.fulfilment === "DELIVERY" ? <Truck className="size-5" aria-hidden /> : <Store className="size-5" aria-hidden />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{o.label} · {o.name}</span>
                    <span className="block truncate text-xs text-stone-500">{fmtDateTime(o.createdAt)} · {o.items.reduce((n, i) => n + i.quantity, 0)} item{o.items.reduce((n, i) => n + i.quantity, 0) === 1 ? "" : "s"} · {o.paymentStatus === "PAID" ? "Paid" : o.payMethod === "ON_DELIVERY" ? "Pay on " + (o.fulfilment === "DELIVERY" ? "delivery" : "collection") : "Unpaid"}</span>
                  </span>
                  <Badge tone={STATUS[o.status].tone}>{STATUS[o.status].label(o)}</Badge>
                  <span className="w-24 text-right text-sm font-semibold tabular-nums">{money(o.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {current && <OrderDialog order={current} onClose={() => setOpen(null)} />}
    </div>
  );
}

function OrderDialog({ order: o, onClose }: { order: Order; onClose: () => void }) {
  const qc = useQueryClient();
  const [paying, setPaying] = useState<"CASH" | "MPESA" | null>(null);
  const [code, setCode] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  const done = (msg: string) => {
    for (const k of ["shop-orders", "shop-order-summary", "payments", "ledger", "dashboard", "shop-inventory"]) void qc.invalidateQueries({ queryKey: [k] });
    toast.success(msg);
  };
  const move = useMutation({
    mutationFn: async (status: "READY" | "COMPLETED") => (await api.patch(`/shop/orders/${o.id}/status`, { status })).data,
    onSuccess: () => done("Order updated"),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const pay = useMutation({
    mutationFn: async () => (await api.post(`/shop/orders/${o.id}/mark-paid`, { method: paying, ...(paying === "MPESA" ? { receipt: code.trim() } : {}) })).data,
    onSuccess: () => { done("Payment recorded"); setPaying(null); setCode(""); },
  });
  const cancel = useMutation({
    mutationFn: async () => (await api.post<{ message: string }>(`/shop/orders/${o.id}/cancel`, { reason: reason.trim() })).data,
    onSuccess: (d) => { done(d.message); setCancelling(false); onClose(); },
  });

  const open = o.status === "CONFIRMED" || o.status === "READY";
  // Closed by the system because M-Pesa never confirmed: staff can still record the payment if the customer shows they paid.
  const reopenable = o.status === "CANCELLED" && o.paymentStatus === "FAILED";
  const unpaid = o.paymentStatus !== "PAID";

  return (
    <Modal open onClose={onClose} title={`Order ${o.label}`} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2"><Badge tone={STATUS[o.status].tone}>{STATUS[o.status].label(o)}</Badge><Badge tone={o.paymentStatus === "PAID" ? "green" : "amber"}>{o.paymentStatus === "PAID" ? "Paid" : o.payMethod === "ON_DELIVERY" ? "To be paid in person" : o.paymentStatus === "FAILED" ? "Payment failed" : "Unpaid"}</Badge></div>

        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="font-medium text-ink">{o.name}</p>
            <a href={telHref(o.phone)} className="mt-0.5 inline-flex items-center gap-1.5 text-gold-700 hover:underline"><Phone className="size-3.5" aria-hidden />{o.phone}</a>
            {o.email && <p className="text-stone-500">{o.email}</p>}
          </div>
          <div>
            <p className="inline-flex items-center gap-1.5 font-medium text-ink">{o.fulfilment === "DELIVERY" ? <><Truck className="size-4" aria-hidden />Delivery</> : <><Store className="size-4" aria-hidden />Collect from salon</>}</p>
            {o.fulfilment === "DELIVERY" && <p className="mt-0.5 flex gap-1.5 text-stone-600"><MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />{o.address}{o.area ? `, ${o.area}` : ""}</p>}
          </div>
        </div>
        {o.notes && <p className="rounded-lg bg-cream px-3 py-2 text-sm text-stone-700"><strong>Customer note:</strong> {o.notes}</p>}

        <ul className="divide-y divide-line rounded-lg border border-line">
          {o.items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              {i.image ? <img src={img(i.image, 100)} alt="" className="size-12 shrink-0 rounded-lg object-cover" /> : <span className="size-12 shrink-0 rounded-lg bg-stone-100" />}
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{i.name}</span><span className="text-xs text-stone-500">{money(i.unitPrice)} × {i.quantity}</span></span>
              <span className="tabular-nums">{money(i.unitPrice * i.quantity)}</span>
            </li>
          ))}
          <li className="flex justify-between px-3 py-2 text-sm text-stone-600"><span>{o.fulfilment === "DELIVERY" ? "Delivery" : "Collection"}</span><span className="tabular-nums">{o.deliveryFee ? money(o.deliveryFee) : "Free"}</span></li>
          <li className="flex justify-between px-3 py-2.5 font-semibold"><span>Total</span><span className="tabular-nums">{money(o.total)}</span></li>
        </ul>

        {o.payments.length > 0 && (
          <ul className="space-y-1 text-xs text-stone-600">
            {o.payments.map((p) => <li key={p.id} className="flex justify-between"><span>{fmtDateTime(p.paidAt)} · {p.method === "MPESA" ? `M-Pesa ${p.mpesaReceipt ?? ""}` : "Cash"}</span><span className="tabular-nums">{money(p.amount)}</span></li>)}
          </ul>
        )}
        {o.status === "CANCELLED" && o.cancelReason && <p className="text-sm text-red-700">Cancelled: {o.cancelReason}{o.paymentStatus === "PAID" ? ". Refund the customer." : ""}</p>}

        {(move.isError || pay.isError || cancel.isError) && <ErrorNote>{errorMessage(move.error ?? pay.error ?? cancel.error)}</ErrorNote>}

        {(open || reopenable) && unpaid && !paying && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="mb-2 text-sm font-medium text-amber-900">{reopenable ? `Closed because M-Pesa never confirmed it. If the customer paid ${money(o.total)}, record it to reopen the order.` : `${money(o.total)} still to collect`}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="gold" icon={<Banknote className="size-4" />} onClick={() => setPaying("CASH")}>Took cash</Button>
              <Button size="sm" variant="outline" icon={<Smartphone className="size-4" />} onClick={() => setPaying("MPESA")}>Paid by M-Pesa</Button>
            </div>
          </div>
        )}
        {paying && (
          <div className="space-y-3 rounded-lg border border-line p-3">
            <p className="text-sm font-medium">{paying === "CASH" ? `Confirm you received ${money(o.total)} in cash` : "Enter the M-Pesa code from the customer's message"}</p>
            {paying === "MPESA" && <Input label="M-Pesa code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. UJV7C02CTC" />}
            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setPaying(null)}>Back</Button><Button size="sm" variant="gold" loading={pay.isPending} disabled={paying === "MPESA" && code.trim().length < 6} onClick={() => pay.mutate()}>Record payment</Button></div>
          </div>
        )}

        {cancelling && (
          <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <Input label="Why is it being cancelled?" value={reason} onChange={(e) => setReason(e.target.value)} />
            <p className="text-xs text-red-700">The items go back into stock{o.paymentStatus === "PAID" ? ", and you'll need to refund the customer yourself" : ""}.</p>
            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setCancelling(false)}>Back</Button><Button size="sm" variant="gold" loading={cancel.isPending} disabled={reason.trim().length < 3} onClick={() => cancel.mutate()}>Cancel order</Button></div>
          </div>
        )}

        {open && !paying && !cancelling && (
          <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
            <Button variant="outline" className="text-red-600" onClick={() => setCancelling(true)}>Cancel order</Button>
            <div className="flex gap-2">
              {o.status === "CONFIRMED" && <Button variant="gold" loading={move.isPending} onClick={() => move.mutate("READY")}>{o.fulfilment === "DELIVERY" ? "Out for delivery" : "Ready to collect"}</Button>}
              {o.status === "READY" && <Button variant="gold" disabled={unpaid} loading={move.isPending} onClick={() => move.mutate("COMPLETED")}>{o.fulfilment === "DELIVERY" ? "Mark delivered" : "Mark collected"}</Button>}
            </div>
          </div>
        )}
        {o.status === "READY" && unpaid && <p className="text-xs text-stone-500">Record the payment first, then you can complete the order.</p>}
      </div>
    </Modal>
  );
}
