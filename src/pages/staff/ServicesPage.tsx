import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Plus, Scissors } from "lucide-react";
import toast from "react-hot-toast";
import { api, errorMessage } from "../../lib/api";
import { fmtDuration, money } from "../../lib/format";
import { useServices } from "../../lib/queries";
import type { Service } from "../../lib/types";
import { OTHER, SERVICE_CATEGORIES, groupByCategory, orderedCategories } from "../../lib/categories";
import { Badge, Button, Card, Empty, ErrorNote, Input, Modal, PageHeader, Select, Spinner, Textarea, Toggle } from "../../components/ui";

export default function ServicesPage() {
  const q = useServices(true);
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const [tab, setTab] = useState("");
  const all = q.data ?? [];
  const cats = orderedCategories(all);
  const shown = groupByCategory(all.filter((s) => !tab || (s.category ?? OTHER) === tab));

  return (
    <div>
      <PageHeader title="Services" subtitle="What clients can book, and for how much." actions={<Button variant="gold" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>Add service</Button>} />
      {cats.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Service categories">
          {["", ...cats].map((c) => {
            const n = c ? all.filter((s) => (s.category ?? OTHER) === c).length : all.length;
            return <button key={c || "all"} type="button" onClick={() => setTab(c)} aria-pressed={tab === c} className={`rounded-full border px-4 py-1.5 text-sm ${tab === c ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-700 hover:border-gold-400"}`}>{c || "All"} <span className="opacity-60">{n}</span></button>;
          })}
        </div>
      )}
      {q.isLoading ? <Spinner /> : q.data?.length === 0 ? (
        <Card><Empty icon={<Scissors className="size-6" />} title="No services yet" hint="Add your first service so clients can start booking." action={<Button variant="gold" onClick={() => setEditing("new")}>Add service</Button>} /></Card>
      ) : (
        <div className="space-y-8">
          {shown.map((g) => (
            <section key={g.name} aria-label={g.name}>
              {(cats.length > 1) && <h2 className="mb-3 font-display text-xl font-semibold text-ink">{g.name} <span className="text-sm font-normal text-stone-500">· {g.items.length}</span></h2>}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {g.items.map((s) => (
            <button key={s.id} onClick={() => setEditing(s)} className={`rounded-xl border border-line bg-white p-5 text-left shadow-sm transition hover:border-gold-400 ${s.isActive ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-ink">{s.name}</p>
                <p className="text-right font-semibold tabular-nums">{s.salePrice != null && s.salePrice < s.price ? <><span className="mr-1.5 text-xs font-normal text-stone-400 line-through">{money(s.price)}</span><span className="text-red-600">{money(s.salePrice)}</span></> : money(s.price)}</p>
              </div>
              {s.description && <p className="mt-1 line-clamp-2 text-sm text-stone-500">{s.description}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{fmtDuration(s.durationMin)}</span>
                {s.category && <Badge tone="gold">{s.category}</Badge>}
                {s.salePrice != null && s.salePrice < s.price && <Badge tone="red">Offer</Badge>}
                {s.requiresPatchTest && <Badge tone="amber">Patch test</Badge>}
                {!s.isActive && <Badge>Hidden</Badge>}
              </div>
            </button>
          ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {editing && <ServiceDialog service={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ServiceDialog({ service, onClose }: { service: Service | null; onClose: () => void }) {
  const qc = useQueryClient();
  const all = useServices(true);
  const categories = [...new Set((all.data ?? []).map((x) => x.category).filter((c): c is string => Boolean(c)))];
  const known = [...SERVICE_CATEGORIES, ...categories];
  const [f, setF] = useState({
    name: service?.name ?? "",
    description: service?.description ?? "",
    durationMin: String(service?.durationMin ?? 60),
    price: String(service?.price ?? ""),
    salePrice: service?.salePrice != null ? String(service.salePrice) : "",
    category: service?.category ?? "",
    imageUrl: service?.imageUrl ?? "",
    requiresPatchTest: service?.requiresPatchTest ?? false,
    isActive: service?.isActive ?? true,
  });

  const [custom, setCustom] = useState(false);
  const customCategory = custom || (f.category !== "" && !known.includes(f.category));
  const categoryChoice = customCategory ? "__custom" : f.category;

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: f.name.trim(),
        durationMin: Number(f.durationMin),
        price: Number(f.price),
        salePrice: f.salePrice.trim() === "" ? null : Number(f.salePrice),
        category: f.category.trim() || null,
        imageUrl: f.imageUrl || null,
        requiresPatchTest: f.requiresPatchTest,
        isActive: f.isActive,
        description: f.description.trim() || null,
      };
      return service ? (await api.patch(`/services/${service.id}`, body)).data : (await api.post("/services", { ...body, description: body.description ?? undefined })).data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["services"] }); void qc.invalidateQueries({ queryKey: ["public-services"] }); toast.success(service ? "Service updated" : "Service added"); onClose(); },
  });

  return (
    <Modal open onClose={onClose} title={service ? "Edit service" : "New service"} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="gold" loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        {save.isError && <ErrorNote>{errorMessage(save.error)}</ErrorNote>}
        <Input label="Name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Textarea label="Description" hint="Shown to clients when they book." maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Duration (minutes)" type="number" min={15} step={5} required value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: e.target.value })} />
          <Input label="Price (KES)" type="number" min={0} required value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Offer price (KES, optional)" type="number" min={0} value={f.salePrice} onChange={(e) => setF({ ...f, salePrice: e.target.value })} error={f.salePrice !== "" && Number(f.salePrice) >= Number(f.price) ? "Must be lower than the price" : undefined} hint="Shows the normal price crossed out. Clients pay this price. Clear it to end the offer." />
          <Select label="Category" value={categoryChoice} onChange={(e) => { const v = e.target.value; setCustom(v === "__custom"); setF({ ...f, category: v === "__custom" ? "" : v }); }} hint="Which side of the business this service belongs to. Groups it on your website.">
            {SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            {categories.filter((c) => !(SERVICE_CATEGORIES as readonly string[]).includes(c)).map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="">No category</option>
            <option value="__custom">Another category…</option>
          </Select>
          {customCategory && <Input label="New category name" maxLength={40} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="e.g. Nails" />}
        </div>
        <PhotoPicker value={f.imageUrl} onChange={(v) => setF({ ...f, imageUrl: v })} />
        <Toggle checked={f.requiresPatchTest} onChange={(v) => setF({ ...f, requiresPatchTest: v })} label="Needs a patch test" hint="Reminds clients to mention allergies." />
        <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Available to book" hint="Turn off to hide it without losing history." />
      </form>
    </Modal>
  );
}

interface GalleryList { enabled: boolean; images: Array<{ id: string; url: string }> }

/** Pick a service photo from the gallery; one tap to choose, one to clear. */
function PhotoPicker({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const q = useQuery({ queryKey: ["gallery-admin"], queryFn: async () => (await api.get<GalleryList>("/site/gallery")).data, staleTime: 60_000 });
  const images = q.data?.images ?? [];
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-stone-700">Photo (optional)</p>
      {images.length === 0 ? (
        <p className="text-sm text-stone-500">Add photos in Gallery first, then choose one here to show on this service.</p>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {images.slice(0, 15).map((g) => (
            <button type="button" key={g.id} onClick={() => onChange(value === g.url ? "" : g.url)} aria-pressed={value === g.url} aria-label="Use this photo" className={`aspect-square overflow-hidden rounded-lg border-2 ${value === g.url ? "border-gold-500" : "border-transparent"}`}>
              <img src={g.url} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
