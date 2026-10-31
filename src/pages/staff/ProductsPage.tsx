import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ImagePlus, Loader2, PackagePlus, Plus, Search, Star, X } from "lucide-react";
import toast from "react-hot-toast";
import { api, errorMessage } from "../../lib/api";
import { fmtDateTime, money } from "../../lib/format";
import { uploadPhoto } from "../../lib/upload";
import { Badge, Button, Card, Empty, ErrorNote, Input, Modal, PageHeader, Spinner, Stat, Tabs, Textarea, Toggle, cx } from "../../components/ui";
import { img } from "../shop/shopApi";

interface Item {
  id: string; name: string; sku: string | null; description: string | null; category: string | null; images: string[];
  quantity: number; reorderAt: number; costPrice: number; salePrice: number; compareAtPrice: number | null;
  isPublished: boolean; isFeatured: boolean; isArchived: boolean;
}
type Filter = "all" | "low" | "hidden" | "offer" | "archived";

const isLow = (i: Item) => i.quantity <= i.reorderAt;

export default function ProductsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [adjusting, setAdjusting] = useState<Item | null>(null);
  const q = useQuery({
    queryKey: ["shop-inventory", filter === "archived"],
    queryFn: async () => (await api.get<Item[]>("/shop/products", { params: filter === "archived" ? { archived: "1" } : {} })).data,
  });

  const all = q.data ?? [];
  const shown = all
    .filter((i) => (filter === "low" ? isLow(i) : filter === "hidden" ? !i.isPublished : filter === "offer" ? i.compareAtPrice != null : true))
    .filter((i) => !search.trim() || `${i.name} ${i.category ?? ""} ${i.sku ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const units = all.reduce((n, i) => n + i.quantity, 0);
  const value = all.reduce((n, i) => n + i.quantity * i.costPrice, 0);
  const retail = all.reduce((n, i) => n + i.quantity * i.salePrice, 0);
  const lowCount = all.filter(isLow).length;

  return (
    <div>
      <PageHeader title="Products & stock" subtitle="Your wigs, hair and tools. Publish them to sell on your website." actions={<Button variant="gold" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>Add product</Button>} />

      {filter !== "archived" && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Products" value={all.length} />
          <Stat label="Units in stock" value={units.toLocaleString("en-KE")} />
          <Stat label="Stock at cost" value={money(value)} hint={`Worth ${money(retail)} at selling price`} />
          <Stat label="Running low" value={lowCount} {...(lowCount > 0 ? { tone: "bad" as const } : {})} />
        </div>
      )}

      <Tabs value={filter} onChange={setFilter} tabs={[{ id: "all", label: "All" }, { id: "low", label: "Running low", ...(lowCount ? { badge: lowCount } : {}) }, { id: "hidden", label: "Not on website" }, { id: "offer", label: "On offer" }, { id: "archived", label: "Archived" }]} />
      <div className="relative my-4 max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products" aria-label="Search products" className="h-10 w-full rounded-lg border border-line bg-white pr-3 pl-9 text-sm" />
      </div>

      {q.isLoading ? <Spinner /> : shown.length === 0 ? (
        <Card><Empty icon={<PackagePlus className="size-6" />} title={all.length === 0 ? "No products yet" : "Nothing matches"} hint={all.length === 0 ? "Add your first wig or hair product, then publish it to your online shop." : "Try another filter or search."} action={all.length === 0 ? <Button variant="gold" onClick={() => setEditing("new")}>Add product</Button> : undefined} /></Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {shown.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                {i.images[0] ? <img src={img(i.images[0], 120)} alt="" className="size-14 shrink-0 rounded-lg object-cover" /> : <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-300"><PackagePlus className="size-6" aria-hidden /></span>}
                <button type="button" onClick={() => setEditing(i)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium text-ink">{i.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                    {i.category && <Badge tone="gold">{i.category}</Badge>}
                    {i.isPublished ? <Badge tone="green">On website</Badge> : <Badge>Not on website</Badge>}
                    {i.isFeatured && <span className="inline-flex items-center gap-0.5"><Star className="size-3 fill-gold-400 text-gold-400" aria-hidden />Featured</span>}
                    {i.compareAtPrice != null && <Badge tone="red">Offer</Badge>}
                  </span>
                </button>
                <div className="text-right text-sm tabular-nums">
                  <p className="font-semibold">{i.compareAtPrice != null && <span className="mr-1.5 text-xs font-normal text-stone-400 line-through">{money(i.compareAtPrice)}</span>}{money(i.salePrice)}</p>
                  <p className="text-xs text-stone-500">Cost {money(i.costPrice)}</p>
                </div>
                <button type="button" onClick={() => setAdjusting(i)} className={cx("min-w-24 rounded-lg border px-3 py-2 text-center text-sm hover:bg-stone-50", isLow(i) ? "border-red-300 bg-red-50 text-red-700" : "border-line")} aria-label={`Adjust stock for ${i.name}`}>
                  <span className="block text-base font-semibold tabular-nums">{i.quantity}</span>
                  <span className="flex items-center justify-center gap-1 text-xs">{isLow(i) && <AlertTriangle className="size-3" aria-hidden />}{i.quantity === 0 ? "Sold out" : isLow(i) ? "Low" : "in stock"}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {editing && <ProductDialog item={editing === "new" ? null : editing} categories={[...new Set(all.map((i) => i.category).filter((c): c is string => Boolean(c)))]} onClose={() => setEditing(null)} />}
      {adjusting && <StockDialog item={adjusting} onClose={() => setAdjusting(null)} />}
    </div>
  );
}

function ProductDialog({ item, categories, onClose }: { item: Item | null; categories: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: item?.name ?? "",
    category: item?.category ?? "",
    description: item?.description ?? "",
    salePrice: item ? String(item.salePrice) : "",
    compareAtPrice: item?.compareAtPrice != null ? String(item.compareAtPrice) : "",
    costPrice: item ? String(item.costPrice) : "",
    quantity: "0",
    reorderAt: String(item?.reorderAt ?? 2),
    sku: item?.sku ?? "",
    images: item?.images ?? [],
    isPublished: item?.isPublished ?? false,
    isFeatured: item?.isFeatured ?? false,
  });
  const [uploading, setUploading] = useState(0);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["shop-inventory"] });
    void qc.invalidateQueries({ queryKey: ["shop-products"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const sale = Number(f.salePrice);
  const compare = f.compareAtPrice.trim() === "" ? null : Number(f.compareAtPrice);
  const offerBad = compare != null && compare <= sale;

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: f.name.trim(),
        category: f.category.trim() || null,
        description: f.description.trim() || null,
        salePrice: sale,
        compareAtPrice: compare,
        costPrice: Number(f.costPrice || 0),
        reorderAt: Number(f.reorderAt || 0),
        sku: f.sku.trim() || null,
        images: f.images,
        isPublished: f.isPublished,
        isFeatured: f.isFeatured,
      };
      return item ? (await api.patch(`/shop/products/${item.id}`, body)).data : (await api.post("/shop/products", { ...body, quantity: Number(f.quantity || 0) })).data;
    },
    onSuccess: () => { refresh(); toast.success(item ? "Product saved" : "Product added"); onClose(); },
  });
  const remove = useMutation({
    mutationFn: async () => (await api.delete<{ message: string }>(`/shop/products/${item!.id}`)).data,
    onSuccess: (d) => { refresh(); toast.success(d.message); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const restore = useMutation({
    mutationFn: async () => (await api.post(`/shop/products/${item!.id}/restore`)).data,
    onSuccess: () => { refresh(); toast.success("Restored"); onClose(); },
  });

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files).slice(0, 6 - f.images.length)) {
      setUploading((n) => n + 1);
      try {
        const url = await uploadPhoto(file);
        setF((cur) => ({ ...cur, images: [...cur.images, url].slice(0, 6) }));
      } catch (e) {
        toast.error(e instanceof Error && !("response" in e) ? e.message : errorMessage(e));
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  return (
    <Modal open onClose={onClose} title={item ? "Edit product" : "New product"} wide footer={<>
      {item && !item.isArchived && <Button variant="outline" className="mr-auto text-red-600" loading={remove.isPending} onClick={() => { if (confirm("Remove this product? If it has past orders it is archived instead of deleted.")) remove.mutate(); }}>Remove</Button>}
      {item?.isArchived && <Button variant="outline" className="mr-auto" loading={restore.isPending} onClick={() => restore.mutate()}>Restore</Button>}
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button variant="gold" loading={save.isPending} disabled={offerBad || uploading > 0} onClick={() => save.mutate()}>Save</Button>
    </>}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (!offerBad) save.mutate(); }} className="space-y-4">
        {save.isError && <ErrorNote>{errorMessage(save.error)}</ErrorNote>}
        <Input label="Product name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder='e.g. Bob wig 14" 11A human hair' />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Category" list="product-categories" maxLength={40} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} hint="Groups products in your shop, e.g. Bob wigs, Wig tools." />
          <datalist id="product-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <Input label="Code / SKU (optional)" value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} />
        </div>
        <Textarea label="Description" rows={3} maxLength={1500} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} hint="Length, density, texture, lace type: what a buyer wants to know." />

        <div>
          <p className="mb-1.5 text-sm font-medium text-stone-700">Photos <span className="font-normal text-stone-500">(up to 6, the first is the cover)</span></p>
          <div className="flex flex-wrap gap-2">
            {f.images.map((u, i) => (
              <span key={u} className="relative">
                <img src={img(u, 160)} alt="" className="size-20 rounded-lg object-cover" />
                {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-ink/80 px-1.5 text-[10px] text-white">Cover</span>}
                <button type="button" aria-label="Remove photo" onClick={() => setF({ ...f, images: f.images.filter((x) => x !== u) })} className="absolute -top-1.5 -right-1.5 rounded-full bg-white p-0.5 shadow ring-1 ring-line"><X className="size-3.5" /></button>
              </span>
            ))}
            {f.images.length < 6 && (
              <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line text-xs text-stone-500 hover:border-gold-400">
                {uploading > 0 ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
                {uploading > 0 ? "Uploading" : "Add"}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Selling price (KES)" type="number" min={0} required value={f.salePrice} onChange={(e) => setF({ ...f, salePrice: e.target.value })} hint="What the customer pays." />
          <Input label="Normal price (optional)" type="number" min={0} value={f.compareAtPrice} onChange={(e) => setF({ ...f, compareAtPrice: e.target.value })} error={offerBad ? "Must be higher than the selling price" : undefined} hint="Fill to show an offer: this price is crossed out." />
          <Input label="Your cost (KES)" type="number" min={0} value={f.costPrice} onChange={(e) => setF({ ...f, costPrice: e.target.value })} hint="Private. For your profit reports." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {!item && <Input label="Opening stock" type="number" min={0} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} />}
          <Input label="Warn me when stock is at or below" type="number" min={0} value={f.reorderAt} onChange={(e) => setF({ ...f, reorderAt: e.target.value })} />
        </div>
        {item && <p className="text-xs text-stone-500">To change how many you have, use the stock box on the product list so the change is recorded.</p>}
        <Toggle checked={f.isPublished} onChange={(v) => setF({ ...f, isPublished: v })} label="Sell on my website" hint="Off keeps it in your stock list only." />
        <Toggle checked={f.isFeatured} onChange={(v) => setF({ ...f, isFeatured: v })} label="Feature on the home page" hint="Featured products are shown first." />
      </form>
    </Modal>
  );
}

interface Move { id: string; delta: number; reason: string; at: string; by: string }
const REASONS = { add: ["Restock", "Returned by customer", "Count correction"], remove: ["Damaged", "Sold in the salon", "Lost", "Count correction"] };

function StockDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [n, setN] = useState("1");
  const [reason, setReason] = useState("Restock");
  const moves = useQuery({ queryKey: ["stock-moves", item.id], queryFn: async () => (await api.get<Move[]>(`/shop/products/${item.id}/movements`)).data });
  const amount = Math.max(0, Math.round(Number(n) || 0));
  const save = useMutation({
    mutationFn: async () => (await api.post<Item>(`/shop/products/${item.id}/stock`, { delta: mode === "add" ? amount : -amount, reason })).data,
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: ["shop-inventory"] });
      void qc.invalidateQueries({ queryKey: ["shop-products"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["stock-moves", item.id] });
      toast.success(`Now ${d.quantity} in stock`);
      onClose();
    },
  });

  return (
    <Modal open onClose={onClose} title={`Stock: ${item.name}`} footer={<><Button variant="outline" onClick={onClose}>Close</Button><Button variant="gold" disabled={amount < 1} loading={save.isPending} onClick={() => save.mutate()}>{mode === "add" ? `Add ${amount || ""}` : `Remove ${amount || ""}`}</Button></>}>
      <div className="space-y-4">
        {save.isError && <ErrorNote>{errorMessage(save.error)}</ErrorNote>}
        <p className="text-sm text-stone-600">Currently <strong className="text-ink">{item.quantity}</strong> in stock.</p>
        <div className="flex gap-2" role="group" aria-label="Add or remove">
          {(["add", "remove"] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); setReason(REASONS[m][0]!); }} aria-pressed={mode === m} className={cx("flex-1 rounded-lg border px-4 py-2 text-sm font-medium", mode === m ? "border-ink bg-ink text-white" : "border-line bg-white")}>{m === "add" ? "Add stock" : "Remove stock"}</button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="How many" type="number" min={1} value={n} onChange={(e) => setN(e.target.value)} />
          <label className="block text-sm"><span className="mb-1.5 block font-medium text-stone-700">Reason</span>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="h-11 w-full rounded-lg border border-line bg-white px-3">{REASONS[mode].map((r) => <option key={r}>{r}</option>)}</select>
          </label>
        </div>
        <div>
          <h3 className="mb-2 font-sans text-sm font-semibold text-stone-700">Recent changes</h3>
          {moves.isLoading ? <Spinner /> : (
            <ul className="max-h-48 divide-y divide-line overflow-auto rounded-lg border border-line text-xs">
              {(moves.data ?? []).map((m) => (
                <li key={m.id} className="flex justify-between gap-3 px-3 py-2"><span>{fmtDateTime(m.at)} · {m.reason} · {m.by}</span><span className={cx("font-semibold tabular-nums", m.delta < 0 && "text-red-600")}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span></li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
