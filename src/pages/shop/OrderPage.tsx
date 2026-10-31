import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, Package, Smartphone, Store, Truck, XCircle } from "lucide-react";
import { api } from "../../lib/api";
import { fmtDateTime, money } from "../../lib/format";
import { usePageMeta } from "../../lib/track";
import { Spinner, cx } from "../../components/ui";
import ShopLayout from "./ShopLayout";
import { img, type ShopConfig } from "./shopApi";

interface OrderView {
  label: string;
  status: "PENDING_PAYMENT" | "CONFIRMED" | "READY" | "COMPLETED" | "CANCELLED";
  paymentStatus: "UNPAID" | "PAID" | "FAILED";
  payMethod: "MPESA" | "ON_DELIVERY";
  fulfilment: "DELIVERY" | "PICKUP";
  address: string | null;
  area: string | null;
  name: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  cancelReason: string | null;
  items: Array<{ id: string; name: string; unitPrice: number; quantity: number; image: string | null }>;
  config: ShopConfig;
}

const STEPS = (o: OrderView) => [
  { key: "CONFIRMED", label: "Order received", icon: Package },
  { key: "READY", label: o.fulfilment === "DELIVERY" ? "On its way" : "Ready to collect", icon: o.fulfilment === "DELIVERY" ? Truck : Store },
  { key: "COMPLETED", label: o.fulfilment === "DELIVERY" ? "Delivered" : "Collected", icon: Check },
];
const RANK = { PENDING_PAYMENT: -1, CONFIRMED: 0, READY: 1, COMPLETED: 2, CANCELLED: -1 } as const;

export default function OrderPage() {
  usePageMeta("Your order");
  const { token } = useParams();
  const q = useQuery({
    queryKey: ["shop-order", token],
    retry: false,
    queryFn: async () => (await api.get<OrderView>(`/public/shop/orders/${token}`)).data,
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return false;
      if (d.status === "PENDING_PAYMENT") return 3000;
      // An order we gave up on can still be confirmed if the customer's M-Pesa payment turns up late, so keep looking for a while.
      if (d.status === "CANCELLED" && d.paymentStatus === "FAILED" && Date.now() - new Date(d.createdAt).getTime() < 30 * 60_000) return 5000;
      return d.status !== "COMPLETED" && d.status !== "CANCELLED" ? 30_000 : false;
    },
  });
  const o = q.data;

  if (q.isLoading) return <ShopLayout><Spinner /></ShopLayout>;
  if (q.isError || !o) {
    return <ShopLayout><div className="mx-auto max-w-md px-4 py-20 text-center"><h1 className="text-2xl font-semibold text-ink">Order not found</h1><p className="mt-2 text-sm text-stone-500">Please check the link in your SMS.</p></div></ShopLayout>;
  }

  const waiting = o.status === "PENDING_PAYMENT";
  const failed = o.status === "CANCELLED";

  return (
    <ShopLayout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        {waiting ? (
          <div className="rounded-2xl border border-line bg-white p-8 text-center">
            <Spinner label="Waiting for your M-Pesa payment" />
            <h1 className="mt-2 text-2xl font-semibold text-ink">Check your phone</h1>
            <p className="mt-2 text-sm text-stone-600"><Smartphone className="mr-1 inline size-4 align-text-bottom" aria-hidden />Enter your M-Pesa PIN to pay <strong>{money(o.total)}</strong>. This page updates by itself.</p>
          </div>
        ) : failed ? (
          <div className="rounded-2xl border border-line bg-white p-8 text-center">
            <XCircle className="mx-auto size-12 text-red-600" aria-hidden />
            <h1 className="mt-3 text-2xl font-semibold text-ink">Order {o.label} was not completed</h1>
            <p className="mt-2 text-sm text-stone-600">{o.paymentStatus === "FAILED" ? "We haven't received your M-Pesa payment yet, so we released the items for now." : (o.cancelReason ?? "This order was cancelled.")}{o.paymentStatus === "PAID" ? " Your payment will be refunded." : ""}</p>
            {o.paymentStatus === "FAILED" && <p className="mx-auto mt-4 max-w-md rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">If you did enter your PIN and received an M-Pesa message, <strong>please don't pay again</strong>. Your payment is matched to this order automatically, usually within a minute or two. This page updates by itself, or call us and quote {o.label}.</p>}
            <Link to="/shop" className="mt-5 inline-flex h-11 items-center rounded-lg bg-ink px-6 text-sm font-medium text-white">Back to the shop</Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-white p-6 sm:p-8">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check className="size-7" aria-hidden /></div>
            <h1 className="text-center text-2xl font-semibold text-ink">Thank you, {o.name.split(" ")[0]}!</h1>
            <p className="mt-1 text-center text-sm text-stone-600">Order <strong>{o.label}</strong> · {fmtDateTime(o.createdAt)}</p>
            <ol className="mt-6 grid grid-cols-3 gap-2 text-center text-xs">
              {STEPS(o).map((s, i) => {
                const done = RANK[o.status] >= i;
                const Icon = s.icon;
                return (
                  <li key={s.key} className={cx("flex flex-col items-center gap-1.5", done ? "text-ink" : "text-stone-400")}>
                    <span className={cx("flex size-10 items-center justify-center rounded-full border-2", done ? "border-gold-500 bg-gold-50 text-gold-700" : "border-line")}><Icon className="size-5" aria-hidden /></span>
                    {s.label}
                  </li>
                );
              })}
            </ol>
            <p className="mt-5 rounded-lg bg-cream px-4 py-3 text-center text-sm text-stone-700">
              {o.paymentStatus === "PAID" ? "Paid. " : o.payMethod === "ON_DELIVERY" ? (o.fulfilment === "DELIVERY" ? "Please pay on delivery. " : "Please pay when you collect. ") : ""}
              {o.fulfilment === "DELIVERY" ? `We'll deliver to ${o.address}${o.area ? `, ${o.area}` : ""}.` : `Collect from ${o.config.address ?? "the salon"}. We'll text you when it's ready.`}
            </p>
          </div>
        )}

        <section className="mt-6 rounded-xl border border-line bg-white p-5" aria-label="Order details">
          <h2 className="font-semibold text-ink">Your items</h2>
          <ul className="mt-3 divide-y divide-line">
            {o.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-3 text-sm">
                {i.image ? <img src={img(i.image, 120)} alt="" className="size-14 shrink-0 rounded-lg object-cover" /> : <span className="size-14 shrink-0 rounded-lg bg-stone-100" />}
                <span className="min-w-0 flex-1"><span className="line-clamp-2 font-medium text-ink">{i.name}</span><span className="text-xs text-stone-500">{money(i.unitPrice)} × {i.quantity}</span></span>
                <span className="tabular-nums">{money(i.unitPrice * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-1.5 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-stone-600">Subtotal</dt><dd className="tabular-nums">{money(o.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-600">{o.fulfilment === "PICKUP" ? "Collection" : "Delivery"}</dt><dd className="tabular-nums">{o.deliveryFee === 0 ? "Free" : money(o.deliveryFee)}</dd></div>
            <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(o.total)}</dd></div>
          </dl>
        </section>
        <p className="mt-6 text-center text-sm text-stone-500">Questions? Call {o.config.phone ?? "us"}{o.config.whatsapp ? " or message us on WhatsApp" : ""}. <Link to="/shop" className="underline">Keep shopping</Link></p>
      </div>
    </ShopLayout>
  );
}
