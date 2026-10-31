import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import toast from "react-hot-toast";
import { money } from "../../lib/format";
import { useBag } from "../../lib/cart";
import { img, type Product } from "./shopApi";

export function Price({ p, large = false }: { p: Pick<Product, "price" | "wasPrice">; large?: boolean }) {
  return (
    <span className={large ? "text-xl" : "text-sm"}>
      <span className={`font-semibold ${p.wasPrice != null ? "text-red-600" : "text-ink"}`}>{money(p.price)}</span>
      {p.wasPrice != null && <span className={`ml-2 text-stone-400 line-through ${large ? "text-base" : "text-xs"}`}>{money(p.wasPrice)}</span>}
    </span>
  );
}

export function Badges({ p }: { p: Product }) {
  return (
    <span className="pointer-events-none absolute top-2.5 left-2.5 z-10 flex flex-col items-start gap-1.5">
      {p.discountPct != null && <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">-{p.discountPct}%</span>}
      {!p.inStock ? <span className="rounded-full bg-stone-800 px-2.5 py-0.5 text-xs font-bold text-white">Sold out</span> : p.left != null ? <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-ink">Only {p.left} left</span> : p.isNew ? <span className="rounded-full bg-gold-400 px-2.5 py-0.5 text-xs font-bold text-ink">New</span> : null}
    </span>
  );
}

export default function ProductCard({ p }: { p: Product }) {
  const bag = useBag();
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-white shadow-sm transition hover:shadow-md">
      <Badges p={p} />
      <Link to={`/shop/${p.id}`} className="block aspect-[4/5] overflow-hidden bg-stone-100" aria-label={p.name}>
        {p.images[0] ? <img src={img(p.images[0], 500)} alt="" loading="lazy" className={`size-full object-cover transition duration-300 group-hover:scale-105 ${p.inStock ? "" : "opacity-60"}`} /> : <span className="flex size-full items-center justify-center text-stone-300"><ShoppingBag className="size-10" aria-hidden /></span>}
      </Link>
      <div className="flex flex-1 flex-col p-3">
        {p.category && <span className="text-xs text-stone-500">{p.category}</span>}
        <Link to={`/shop/${p.id}`} className="mt-0.5 line-clamp-2 text-sm font-medium text-ink hover:underline">{p.name}</Link>
        <div className="mt-1.5"><Price p={p} /></div>
        <button
          type="button"
          disabled={!p.inStock}
          onClick={() => { bag.add(p.id); toast.success("Added to your bag"); }}
          className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
        >
          <ShoppingBag className="size-4" aria-hidden />{p.inStock ? "Add to bag" : "Sold out"}
        </button>
      </div>
    </li>
  );
}
