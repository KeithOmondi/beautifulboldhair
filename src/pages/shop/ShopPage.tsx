import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PackageSearch, SlidersHorizontal } from "lucide-react";
import { usePageMeta } from "../../lib/track";
import { Empty, Spinner, cx } from "../../components/ui";
import ProductCard from "./ProductCard";
import ShopLayout from "./ShopLayout";
import { useShopProducts } from "./shopApi";

export default function ShopPage() {
  usePageMeta("Shop wigs and hair");
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? "";
  const q = params.get("q") ?? "";
  const sale = params.get("sale") === "1";
  const sort = (params.get("sort") ?? "new") as "new" | "price_asc" | "price_desc";
  const [showFilters, setShowFilters] = useState(false);
  const list = useShopProducts({ ...(category ? { category } : {}), ...(q ? { q } : {}), sale, sort });

  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const chip = (active: boolean) => cx("rounded-full border px-4 py-1.5 text-sm", active ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-700 hover:border-gold-400");

  return (
    <ShopLayout>
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{q ? `Results for “${q}”` : category || (sale ? "On offer" : "Shop")}</h1>
          <p className="mt-1 text-sm text-stone-500">{list.data ? `${list.data.total} product${list.data.total === 1 ? "" : "s"}` : " "}</p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => set("category", null)} aria-pressed={!category} className={chip(!category)}>All</button>
          {list.data?.categories.map((c) => (
            <button key={c.name} type="button" onClick={() => set("category", category === c.name ? null : c.name)} aria-pressed={category === c.name} className={chip(category === c.name)}>{c.name}</button>
          ))}
          <button type="button" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters} className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-1.5 text-sm"><SlidersHorizontal className="size-4" aria-hidden />Filter & sort</button>
        </div>
        {showFilters && (
          <div className="mb-5 flex flex-wrap items-center gap-5 rounded-xl border border-line bg-white p-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-gold-500" checked={sale} onChange={(e) => set("sale", e.target.checked ? "1" : null)} />Show only products on offer</label>
            <label className="flex items-center gap-2">Sort by
              <select value={sort} onChange={(e) => set("sort", e.target.value === "new" ? null : e.target.value)} className="h-9 rounded-lg border border-line bg-white px-2">
                <option value="new">Newest</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </select>
            </label>
            {q && <button type="button" onClick={() => set("q", null)} className="text-gold-700 underline">Clear search</button>}
          </div>
        )}

        {list.isLoading ? <Spinner /> : list.isError ? (
          <p className="py-16 text-center text-sm text-stone-500">We couldn't load the shop. Please refresh.</p>
        ) : list.data && list.data.products.length === 0 ? (
          <Empty icon={<PackageSearch className="size-6" />} title="Nothing here yet" hint={q || category || sale ? "Try clearing the filters." : "New products are coming soon."} />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{list.data?.products.map((p) => <ProductCard key={p.id} p={p} />)}</ul>
        )}
      </div>
    </ShopLayout>
  );
}
