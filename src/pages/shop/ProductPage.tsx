import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Minus, Plus, ShoppingBag } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { useBag } from "../../lib/cart";
import { usePageMeta } from "../../lib/track";
import { Spinner } from "../../components/ui";
import ProductCard, { Badges, Price } from "./ProductCard";
import ShopLayout from "./ShopLayout";
import { img, type Product } from "./shopApi";

export default function ProductPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const bag = useBag();
  const q = useQuery({ queryKey: ["shop-product", id], retry: false, queryFn: async () => (await api.get<{ product: Product; related: Product[] }>(`/public/shop/products/${id}`)).data });
  const [pic, setPic] = useState(0);
  const [qty, setQty] = useState(1);
  const p = q.data?.product;
  usePageMeta(p ? `${p.name} | Shop` : "Product", p?.description ?? undefined);
  useEffect(() => { setPic(0); setQty(1); }, [id]);

  if (q.isLoading) return <ShopLayout><Spinner /></ShopLayout>;
  if (q.isError || !p) {
    return (
      <ShopLayout>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="text-2xl font-semibold text-ink">Product not found</h1>
          <p className="mt-2 text-sm text-stone-500">It may have sold out or been removed.</p>
          <Link to="/shop" className="mt-5 inline-flex h-11 items-center rounded-lg bg-ink px-6 text-sm font-medium text-white">Back to the shop</Link>
        </div>
      </ShopLayout>
    );
  }
  const maxQty = p.left ?? 10;

  return (
    <ShopLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-stone-500"><Link to="/shop" className="hover:underline">Shop</Link>{p.category && <> / <Link to={`/shop?category=${encodeURIComponent(p.category)}`} className="hover:underline">{p.category}</Link></>}</nav>
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-stone-100">
              <Badges p={p} />
              {p.images[pic] && <img src={img(p.images[pic], 900)} alt={p.name} className={`size-full object-cover ${p.inStock ? "" : "opacity-60"}`} />}
            </div>
            {p.images.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {p.images.map((u, i) => (
                  <button key={u} type="button" onClick={() => setPic(i)} aria-label={`Photo ${i + 1}`} aria-pressed={i === pic} className={`aspect-square overflow-hidden rounded-lg border-2 ${i === pic ? "border-gold-500" : "border-transparent"}`}><img src={img(u, 200)} alt="" loading="lazy" className="size-full object-cover" /></button>
                ))}
              </div>
            )}
          </div>

          <div>
            {p.category && <p className="text-sm text-stone-500">{p.category}</p>}
            <h1 className="mt-1 text-3xl font-semibold text-ink">{p.name}</h1>
            <div className="mt-3"><Price p={p} large /></div>
            {p.discountPct != null && <p className="mt-1 text-sm font-medium text-red-600">You save {p.discountPct}%</p>}
            <p className={`mt-3 text-sm font-medium ${p.inStock ? "text-emerald-700" : "text-red-600"}`}>{!p.inStock ? "Sold out" : p.left != null ? `Only ${p.left} left` : "In stock"}</p>

            {p.description && <p className="mt-5 whitespace-pre-line leading-relaxed text-stone-700">{p.description}</p>}

            {p.inStock && (
              <div className="mt-6 flex items-center gap-3">
                <div className="inline-flex h-12 items-center rounded-lg border border-line bg-white">
                  <button type="button" aria-label="Fewer" onClick={() => setQty(Math.max(1, qty - 1))} className="size-12 hover:bg-stone-50"><Minus className="mx-auto size-4" /></button>
                  <span className="w-8 text-center font-medium tabular-nums" aria-live="polite">{qty}</span>
                  <button type="button" aria-label="More" onClick={() => setQty(Math.min(maxQty, qty + 1))} className="size-12 hover:bg-stone-50"><Plus className="mx-auto size-4" /></button>
                </div>
                <button type="button" onClick={() => { bag.add(p.id, qty); toast.success("Added to your bag"); }} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-ink font-medium text-ink hover:bg-stone-50"><ShoppingBag className="size-5" aria-hidden />Add to bag</button>
              </div>
            )}
            {p.inStock && <button type="button" onClick={() => { bag.add(p.id, qty); nav("/bag"); }} className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-lg bg-gold-400 font-semibold text-ink hover:bg-gold-300">Buy now</button>}

            <div className="mt-6 flex gap-3 rounded-xl border border-line bg-white p-4 text-sm">
              <CalendarCheck className="mt-0.5 size-5 shrink-0 text-gold-700" aria-hidden />
              <p className="text-stone-600">Want it fitted? <Link to="/book" className="font-medium text-gold-700 underline">Book an install or styling appointment</Link> and our team will take care of it.</p>
            </div>
          </div>
        </div>

        {q.data && q.data.related.length > 0 && (
          <section className="mt-14" aria-label="You may also like">
            <h2 className="mb-4 text-2xl font-semibold text-ink">You may also like</h2>
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">{q.data.related.map((r) => <ProductCard key={r.id} p={r} />)}</ul>
          </section>
        )}
      </div>
    </ShopLayout>
  );
}
