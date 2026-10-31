import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Banknote, Smartphone, Store, Truck } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { useBag } from "../../lib/cart";
import { money } from "../../lib/format";
import { usePageMeta } from "../../lib/track";
import { Button, ErrorNote, Input, Select, Spinner, Textarea, cx } from "../../components/ui";
import { useBagDetails } from "./BagPage";
import ShopLayout from "./ShopLayout";
import { img, useShopConfig } from "./shopApi";

const AREAS = ["Nairobi CBD", "Westlands / Parklands", "Eastlands", "South B / South C", "Kilimani / Lavington", "Karen / Langata", "Thika Road", "Other (we'll confirm the delivery cost)"];

export default function CheckoutPage() {
  usePageMeta("Checkout");
  const nav = useNavigate();
  const bag = useBag();
  const cfg = useShopConfig();
  const { rows, subtotal, problems, loading } = useBagDetails();
  const [f, setF] = useState({ name: "", phone: "", email: "", fulfilment: "DELIVERY" as "DELIVERY" | "PICKUP", address: "", area: AREAS[0]!, notes: "", payMethod: "MPESA" as "MPESA" | "ON_DELIVERY", mpesaPhone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const c = cfg.data;
  const delivery = !c || f.fulfilment === "PICKUP" ? 0 : c.freeOver != null && subtotal >= c.freeOver ? 0 : c.deliveryFee;
  const total = subtotal + delivery;
  // If M-Pesa isn't set up or cash isn't allowed, offer only what works.
  const canMpesa = c?.mpesaEnabled ?? true;
  const canCash = c?.codAllowed ?? true;
  const method = f.payMethod === "MPESA" && !canMpesa ? "ON_DELIVERY" : f.payMethod === "ON_DELIVERY" && !canCash ? "MPESA" : f.payMethod;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.post<{ token: string }>("/public/shop/checkout", {
        items: bag.lines.map((l) => ({ id: l.id, qty: l.qty })),
        name: f.name.trim(),
        phone: f.phone.trim(),
        ...(f.email.trim() ? { email: f.email.trim() } : {}),
        fulfilment: f.fulfilment,
        ...(f.fulfilment === "DELIVERY" ? { address: f.address.trim(), area: f.area } : {}),
        ...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
        payMethod: method,
        ...(method === "MPESA" && f.mpesaPhone.trim() ? { mpesaPhone: f.mpesaPhone.trim() } : {}),
      });
      bag.clear();
      nav(`/order/${res.data.token}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (bag.lines.length === 0) {
    return <ShopLayout><div className="mx-auto max-w-md px-4 py-20 text-center"><h1 className="text-2xl font-semibold text-ink">Your bag is empty</h1><Link to="/shop" className="mt-5 inline-flex h-11 items-center rounded-lg bg-ink px-6 text-sm font-medium text-white">Go to the shop</Link></div></ShopLayout>;
  }
  if (loading) return <ShopLayout><Spinner /></ShopLayout>;
  if (problems.length > 0) {
    return <ShopLayout><div className="mx-auto max-w-md px-4 py-20 text-center"><h1 className="text-2xl font-semibold text-ink">Please review your bag</h1><p className="mt-2 text-sm text-stone-500">Some items changed or sold out.</p><Link to="/bag" className="mt-5 inline-flex h-11 items-center rounded-lg bg-ink px-6 text-sm font-medium text-white">Back to your bag</Link></div></ShopLayout>;
  }

  const choice = (active: boolean) => cx("flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm", active ? "border-gold-500 bg-gold-50" : "border-line bg-white");

  return (
    <ShopLayout>
      <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <h1 className="text-3xl font-semibold text-ink">Checkout</h1>
          {error && <ErrorNote>{error}</ErrorNote>}

          <section className="space-y-4 rounded-xl border border-line bg-white p-5">
            <h2 className="font-semibold text-ink">Your details</h2>
            <Input label="Full name" required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Phone number" type="tel" required autoComplete="tel" placeholder="0712 345 678" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} hint="We text your order updates here." />
              <Input label="Email (optional)" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-line bg-white p-5">
            <h2 className="font-semibold text-ink">How would you like to get it?</h2>
            <label className={choice(f.fulfilment === "DELIVERY")}><input type="radio" name="ful" className="mt-1 accent-gold-500" checked={f.fulfilment === "DELIVERY"} onChange={() => setF({ ...f, fulfilment: "DELIVERY" })} /><Truck className="size-5 shrink-0 text-gold-700" aria-hidden /><span><span className="block font-medium text-ink">Delivery</span><span className="text-stone-500">{c && c.deliveryFee === 0 ? "Free delivery" : c ? `${money(c.deliveryFee)}${c.freeOver != null ? `, free over ${money(c.freeOver)}` : ""}` : " "}</span></span></label>
            <label className={choice(f.fulfilment === "PICKUP")}><input type="radio" name="ful" className="mt-1 accent-gold-500" checked={f.fulfilment === "PICKUP"} onChange={() => setF({ ...f, fulfilment: "PICKUP" })} /><Store className="size-5 shrink-0 text-gold-700" aria-hidden /><span><span className="block font-medium text-ink">Collect from the salon</span><span className="text-stone-500">{c?.address ?? "Free"}. We'll text you when it's ready.</span></span></label>
            {f.fulfilment === "DELIVERY" && (
              <div className="space-y-4 pt-2">
                <Select label="Area" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}>{AREAS.map((a) => <option key={a}>{a}</option>)}</Select>
                <Input label="Delivery address" required minLength={5} placeholder="Building, street, landmark" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
              </div>
            )}
            <Textarea label="Note for us (optional)" rows={2} maxLength={300} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </section>

          <section className="space-y-3 rounded-xl border border-line bg-white p-5">
            <h2 className="font-semibold text-ink">Payment</h2>
            {canMpesa && (
              <label className={choice(method === "MPESA")}><input type="radio" name="pay" className="mt-1 accent-gold-500" checked={method === "MPESA"} onChange={() => setF({ ...f, payMethod: "MPESA" })} /><Smartphone className="size-5 shrink-0 text-gold-700" aria-hidden /><span><span className="block font-medium text-ink">Pay now with M-Pesa</span><span className="text-stone-500">You'll get a prompt on your phone. Enter your PIN to pay.</span></span></label>
            )}
            {canCash && (
              <label className={choice(method === "ON_DELIVERY")}><input type="radio" name="pay" className="mt-1 accent-gold-500" checked={method === "ON_DELIVERY"} onChange={() => setF({ ...f, payMethod: "ON_DELIVERY" })} /><Banknote className="size-5 shrink-0 text-gold-700" aria-hidden /><span><span className="block font-medium text-ink">{f.fulfilment === "DELIVERY" ? "Pay on delivery" : "Pay when you collect"}</span><span className="text-stone-500">Cash or M-Pesa to our team.</span></span></label>
            )}
            {!canMpesa && !canCash && <ErrorNote>Online ordering is not available right now. Please call us.</ErrorNote>}
            {method === "MPESA" && <Input label="M-Pesa number (if different)" type="tel" placeholder={f.phone || "0712 345 678"} value={f.mpesaPhone} onChange={(e) => setF({ ...f, mpesaPhone: e.target.value })} />}
          </section>
        </div>

        <aside className="h-fit rounded-xl border border-line bg-white p-5 md:sticky md:top-24">
          <h2 className="text-lg font-semibold text-ink">Order summary</h2>
          <ul className="mt-3 space-y-3">
            {rows.map(({ line, product }) => product && (
              <li key={line.id} className="flex gap-3 text-sm">
                {product.images[0] ? <img src={img(product.images[0], 120)} alt="" className="size-14 shrink-0 rounded-lg object-cover" /> : <span className="size-14 shrink-0 rounded-lg bg-stone-100" />}
                <span className="min-w-0 flex-1"><span className="line-clamp-2 font-medium text-ink">{product.name}</span><span className="text-xs text-stone-500">{money(product.price)} × {line.qty}</span></span>
                <span className="tabular-nums">{money(product.price * line.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-stone-600">Subtotal</dt><dd className="tabular-nums">{money(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-600">{f.fulfilment === "PICKUP" ? "Collection" : "Delivery"}</dt><dd className="tabular-nums">{delivery === 0 ? "Free" : money(delivery)}</dd></div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(total)}</dd></div>
          </dl>
          <Button type="submit" size="lg" variant="gold" className="mt-5 w-full" loading={busy} disabled={!canMpesa && !canCash}>{method === "MPESA" ? `Pay ${money(total)} with M-Pesa` : "Place order"}</Button>
          <p className="mt-3 text-center text-xs text-stone-500">By ordering you agree to our <Link to="/terms" className="underline">terms</Link> and <Link to="/privacy" className="underline">privacy policy</Link>.</p>
        </aside>
      </form>
    </ShopLayout>
  );
}
