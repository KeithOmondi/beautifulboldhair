import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Plus, Store } from "lucide-react";
import toast from "react-hot-toast";
import { api, errorMessage } from "../../lib/api";
import { money } from "../../lib/format";
import { useBranches, type BranchRow } from "../../lib/queries";
import { Badge, Button, Card, Empty, ErrorNote, Input, Modal, PageHeader, Select, Spinner, Stat, Toggle } from "../../components/ui";

interface Overview {
  rows: Array<{ id: string; name: string; city: string | null; bookingsToday: number; revenueToday: number; revenueMonth: number; staff: number; ordersToHandle: number; lowStock: number }>;
  totals: { bookingsToday: number; revenueToday: number; revenueMonth: number };
}

export default function BranchesPage() {
  const q = useBranches();
  const overview = useQuery({ queryKey: ["branch-overview"], queryFn: async () => (await api.get<Overview>("/branches/overview")).data, refetchInterval: 60_000 });
  const [editing, setEditing] = useState<BranchRow | "new" | null>(null);
  const [copying, setCopying] = useState<BranchRow | null>(null);
  const rows = q.data?.branches ?? [];

  return (
    <div className="max-w-5xl">
      <PageHeader title="Branches" subtitle="One salon, several locations. Each branch has its own team, services, products, customers, opening hours and money." actions={<Button variant="gold" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>Add branch</Button>} />

      {overview.data && overview.data.rows.length > 1 && (
        <section className="mb-6" aria-label="All branches today">
          <div className="mb-3 grid grid-cols-3 gap-3">
            <Stat label="Bookings today" value={overview.data.totals.bookingsToday} />
            <Stat label="Collected today" value={money(overview.data.totals.revenueToday)} />
            <Stat label="Collected this month" value={money(overview.data.totals.revenueMonth)} />
          </div>
          <Card padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-cream/60 text-xs tracking-wide text-stone-500 uppercase">
                  <tr><th className="px-4 py-3">Branch</th><th className="px-4 py-3 text-right">Bookings today</th><th className="px-4 py-3 text-right">Today</th><th className="px-4 py-3 text-right">This month</th><th className="px-4 py-3 text-right">Team</th><th className="px-4 py-3 text-right">Needs attention</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {overview.data.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-medium text-ink">{r.city ?? r.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.bookingsToday}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(r.revenueToday)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(r.revenueMonth)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.staff}</td>
                      <td className="px-4 py-3 text-right">{r.ordersToHandle + r.lowStock === 0 ? <span className="text-stone-400">All clear</span> : <span className="space-x-1">{r.ordersToHandle > 0 && <Badge tone="amber">{r.ordersToHandle} new order{r.ordersToHandle === 1 ? "" : "s"}</Badge>}{r.lowStock > 0 && <Badge tone="red">{r.lowStock} low stock</Badge>}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      {q.isLoading ? <Spinner /> : rows.length === 0 ? (
        <Card><Empty icon={<Store className="size-6" />} title="No branches" /></Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {rows.map((b) => {
              const link = `${window.location.origin}/?branch=${b.slug}`;
              return (
                <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{b.city ?? b.name}{b.city && b.name !== b.city && <span className="font-normal text-stone-500"> · {b.name}</span>}</span>
                    <span className="block truncate text-xs text-stone-500">{link.replace(/^https?:\/\//, "")}</span>
                  </span>
                  {b.id === q.data?.homeBranchId && <Badge tone="gold">Your branch</Badge>}
                  {!b.isActive && <Badge>Switched off</Badge>}
                  <button type="button" aria-label="Copy this branch's website link" title="Copy link" onClick={() => { void navigator.clipboard.writeText(link); toast.success("Link copied"); }} className="rounded-lg p-2 text-stone-400 hover:bg-stone-100"><Copy className="size-4" /></button>
                  <a href={link} target="_blank" rel="noreferrer" aria-label="Open this branch's website" title="Open" className="rounded-lg p-2 text-stone-400 hover:bg-stone-100"><ExternalLink className="size-4" /></a>
                  {rows.length > 1 && <Button size="sm" variant="outline" onClick={() => setCopying(b)}>Copy menu in</Button>}
                  <Button size="sm" variant="outline" onClick={() => setEditing(b)}>Edit</Button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <p className="mt-4 text-sm text-stone-500">To work inside a branch (add its staff, set its prices and hours, take its payments), pick it from the menu at the top of the sidebar. A new person you add belongs to the branch you have selected.</p>
      {editing && <BranchDialog branch={editing === "new" ? null : editing} isHome={editing !== "new" && editing.id === q.data?.homeBranchId} onClose={() => setEditing(null)} />}
      {copying && <CopyDialog target={copying} others={rows.filter((r) => r.id !== copying.id)} onClose={() => setCopying(null)} />}
    </div>
  );
}

function BranchDialog({ branch, isHome, onClose }: { branch: BranchRow | null; isHome: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ city: branch?.city ?? "", name: branch?.name ?? "", slug: branch?.slug ?? "", sortOrder: String(branch?.sortOrder ?? 0), isActive: branch?.isActive ?? true });

  const save = useMutation({
    mutationFn: async () => {
      const slug = f.slug.trim();
      const city = f.city.trim() || null;
      return branch
        ? (await api.patch(`/branches/${branch.id}`, { name: f.name.trim(), city, ...(slug ? { slug } : {}), sortOrder: Number(f.sortOrder || 0), isActive: f.isActive })).data
        : (await api.post("/branches", { name: f.name.trim(), ...(city ? { city } : {}), ...(slug ? { slug } : {}) })).data;
    },
    onSuccess: () => {
      for (const k of ["branches", "landing", "public-info", "branch-overview"]) void qc.invalidateQueries({ queryKey: [k] });
      toast.success(branch ? "Branch saved" : "Branch added. Pick it from the sidebar menu to set it up.");
      onClose();
    },
  });

  return (
    <Modal open onClose={onClose} title={branch ? "Edit branch" : "New branch"} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="gold" loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        {save.isError && <ErrorNote>{errorMessage(save.error)}</ErrorNote>}
        <Input label="Town or area" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="e.g. Kisumu" hint="Shown big on the branch picker." />
        <Input label="Branch name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Glam Salon Kisumu" hint="The full name customers see on that branch's pages and in SMS." />
        <Input label="Web name" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })} placeholder="kisumu" hint="Used in the link to this branch. Lowercase letters, numbers and dashes. Leave empty to make one from the town." />
        {branch && <Input label="Order on the website" type="number" min={0} max={99} value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} hint="Smaller numbers come first. The first branch is the one customers land on." />}
        {branch && !isHome && <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Open to customers" hint="Off hides this branch from your website. Nothing is deleted." />}
      </form>
    </Modal>
  );
}

function CopyDialog({ target, others, onClose }: { target: BranchRow; others: BranchRow[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [from, setFrom] = useState(others[0]?.id ?? "");
  const [products, setProducts] = useState(false);
  const run = useMutation({
    mutationFn: async () => (await api.post<{ services: number; products: number }>(`/branches/${target.id}/copy-from`, { fromId: from, products })).data,
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: ["services"] });
      toast.success(d.services + d.products === 0 ? "Nothing new to copy" : `Copied ${d.services} service${d.services === 1 ? "" : "s"}${products ? ` and ${d.products} product${d.products === 1 ? "" : "s"}` : ""}`);
      onClose();
    },
  });
  return (
    <Modal open onClose={onClose} title={`Copy a menu into ${target.city ?? target.name}`} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="gold" loading={run.isPending} disabled={!from} onClick={() => run.mutate()}>Copy</Button></>}>
      <div className="space-y-4">
        {run.isError && <ErrorNote>{errorMessage(run.error)}</ErrorNote>}
        <p className="text-sm text-stone-600">Saves retyping: brings another branch's services (names, prices, durations) into this one. You can change prices afterwards. Anything already here is left alone.</p>
        <Select label="Copy from" value={from} onChange={(e) => setFrom(e.target.value)}>{others.map((o) => <option key={o.id} value={o.id}>{o.city ?? o.name}</option>)}</Select>
        <Toggle checked={products} onChange={setProducts} label="Also copy products" hint="They arrive with zero stock and hidden from the shop until this branch counts what it really has." />
      </div>
    </Modal>
  );
}
