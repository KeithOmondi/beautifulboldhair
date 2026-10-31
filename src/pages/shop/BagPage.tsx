import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { useBag } from "../../lib/cart";
import { money } from "../../lib/format";
import { usePageMeta } from "../../lib/track";
import { Empty, Spinner } from "../../components/ui";
import { Price } from "./ProductCard";
import ShopLayout from "./ShopLayout";
import { img, useShopConfig, type BagProduct } from "./shopApi";

/** Prices the bag from the server, so a changed price or a sold-out item is never a surprise at checkout. */
export function useBagDetails() {
  const bag = useBag();
  const ids = bag.lines.map((l) => l.id);
  const q = useQuery({
    queryKey: ["shop-bag", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => (await api.post<{ products: BagProduct[] }>("/public/shop/bag", { ids })).data.products,
    staleTime: 10_000,
  });
  const byId = new Map((q.data ?? []).map((p) => [p.id, p]));
  const rows = bag.lines.map((l) => ({ line: l, product: byId.get(l.id) ?? null }));
  const available = rows.filter((r) => r.product?.inStock);
  const subtotal = available.reduce((n, r) => n + r.product!.price * Math.min(r.line.qty, r.product!.max), 0);
  const problems = rows.filter((r) => !r.product || !r.product.inStock || r.line.qty > r.product.max);
  return { rows, subtotal, problems, loading: ids.length > 0 && q.isLoading };
}

export default function BagPage() {
  usePageMeta("Your bag");
  const bag = useBag();
  const cfg = useShopConfig();
  const { rows, subtotal, problems, loading } = useBagDetails();
  const freeLeft = cfg.data?.freeOver != null ? Math.max(0, cfg.data.freeOver - subtotal) : null;

  return (
    <ShopLayout>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-semibold text-ink">Your bag</h1>
        {bag.lines.length === 0 ? (
          <Empty icon={<ShoppingBag className="size-6" />} title="Your bag is empty" hint="Find something you love in the shop." action={<Link to="/shop" className="inline-flex h-11 items-center rounded-lg bg-ink px-6 text-sm font-medium text-white">Start shopping</Link>} />
        ) : loading ? <Spinner /> : (
          <div className="grid gap-6 md:grid-cols-[1fr_320px]">
            <ul className="space-y-3">
              {rows.map(({ line, product }) => (
                <li key={line.id} className="flex gap-3 rounded-xl border border-line bg-white p-3">
                  {product?.images[0] ? <img src={img(product.images[0], 200)} alt="" className="size-24 shrink-0 rounded-lg object-cover" /> : <span className="size-24 shrink-0 rounded-lg bg-stone-100" />}
                  <div className="flex min-w-0 flex-1 flex-col">
                    {product ? <Link to={`/shop/${product.id}`} className="line-clamp-2 text-sm font-medium text-ink hover:underline">{product.name}</Link> : <span className="text-sm font-medium text-stone-500">This product is no longer available</span>}
                    {product && <div className="mt-1"><Price p={product} /></div>}
                    {product && !product.inStock && <p className="mt-1 text-xs font-medium text-red-600">Sold out. Remove it to continue.</p>}
                    {product && product.inStock && line.qty > product.max && <p className="mt-1 text-xs font-medium text-red-600">Only {product.max} available.</p>}
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="inline-flex h-9 items-center rounded-lg border border-line">
                        <button type="button" aria-label="Fewer" onClick={() => bag.setQty(line.id, line.qty - 1)} className="size-9 hover:bg-stone-50"><Minus className="mx-auto size-4" /></button>
                        <span className="w-7 text-center text-sm tabular-nums">{line.qty}</span>
                        <button type="button" aria-label="More" disabled={product ? line.qty >= product.max : true} onClick={() => bag.setQty(line.id, line.qty + 1)} className="size-9 hover:bg-stone-50 disabled:opacity-40"><Plus className="mx-auto size-4" /></button>
                      </div>
                      <button type="button" aria-label="Remove" onClick={() => bag.remove(line.id)} className="rounded p-2 text-stone-400 hover:bg-stone-100 hover:text-red-600"><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <aside className="h-fit rounded-xl border border-line bg-white p-5">
              <h2 className="text-lg font-semibold text-ink">Summary</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-stone-600">Subtotal</dt><dd className="font-medium tabular-nums">{money(subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-stone-600">Delivery</dt><dd className="text-stone-500">Worked out at checkout</dd></div>
              </dl>
              {freeLeft != null && freeLeft > 0 && subtotal > 0 && <p className="mt-3 rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-800">Add {money(freeLeft)} more for free delivery.</p>}
              {problems.length > 0 ? (
                <p className="mt-4 text-sm text-red-600">Please fix the items marked above to continue.</p>
              ) : (
                <Link to="/checkout" className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-lg bg-gold-400 font-semibold text-ink hover:bg-gold-300">Checkout</Link>
              )}
              <Link to="/shop" className="mt-3 block text-center text-sm text-stone-500 underline">Continue shopping</Link>
            </aside>
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
