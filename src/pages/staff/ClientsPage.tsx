import { useDeferredValue, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Users } from "lucide-react";
import toast from "react-hot-toast";
import { api, errorMessage } from "../../lib/api";
import { fmtDateShort, fmtDateTime, money, telHref, toDateStr } from "../../lib/format";
import type { Booking, Client } from "../../lib/types";
import { Avatar, Badge, Button, Card, Empty, ErrorNote, Input, Modal, PageHeader, Spinner, Textarea, Toggle, statusLabel, statusTone } from "../../components/ui";

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim());
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const q = useQuery({
    queryKey: ["clients", deferred],
    queryFn: async () => (await api.get<Client[]>("/clients", { params: deferred ? { search: deferred } : {} })).data,
  });

  return (
    <div>
      <PageHeader title="Clients" subtitle="Everyone who has booked with you." actions={<Button variant="gold" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Add client</Button>} />

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
        <input aria-label="Search clients" placeholder="Search by name or phone" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-white pr-3 pl-9" />
      </div>

      <Card padded={false}>
        {q.isLoading ? <Spinner /> : q.data?.length === 0 ? (
          <Empty icon={<Users className="size-6" />} title={deferred ? "No clients match" : "No clients yet"} hint={deferred ? "Try a different name or number." : "Clients are added automatically when they book online, or add one yourself."} />
        ) : (
          <ul className="divide-y divide-line">
            {q.data?.map((c) => (
              <li key={c.id}>
                <button onClick={() => setSelected(c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 sm:px-5">
                  <Avatar name={c.name} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium text-ink"><span className="truncate">{c.name}</span>{c.isBlocked && <Badge tone="red">Blocked</Badge>}</span>
                    <span className="block truncate text-sm text-stone-500">{c.phone}</span>
                  </span>
                  <span className="hidden text-right text-sm sm:block">
                    <span className="block font-medium tabular-nums">{money(c.totalSpent ?? 0)}</span>
                    <span className="text-xs text-stone-500">{c.visits ?? 0} visit{c.visits === 1 ? "" : "s"}{c.lastVisit ? ` · last ${fmtDateShort(toDateStr(c.lastVisit))}` : ""}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {selected && <ClientDialog id={selected} onClose={() => setSelected(null)} />}
      {adding && <AddClientDialog onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddClientDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", phone: "", allergies: "" });
  const m = useMutation({
    mutationFn: async () => (await api.post("/clients", { name: f.name.trim(), phone: f.phone.trim(), ...(f.allergies.trim() ? { allergies: f.allergies.trim() } : {}) })).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Client added"); onClose(); },
  });
  return (
    <Modal open onClose={onClose} title="Add client" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="gold" loading={m.isPending} onClick={() => m.mutate()}>Add client</Button></>}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
        {m.isError && <ErrorNote>{errorMessage(m.error)}</ErrorNote>}
        <Input label="Name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label="Phone" type="tel" required placeholder="0712 345 678" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Textarea label="Allergies (optional)" value={f.allergies} onChange={(e) => setF({ ...f, allergies: e.target.value })} />
      </form>
    </Modal>
  );
}

interface PaymentLine { id: string; amount: number; method: "CASH" | "MPESA" | "CARD"; kind: "DEPOSIT" | "BALANCE" | "REFUND"; mpesaReceipt: string | null; paidAt: string; notes: string | null }
type ClientDetail = Client & { bookings: Array<Pick<Booking, "id" | "startAt" | "status" | "price" | "discount"> & { service: { name: string }; staff: { name: string }; payments: PaymentLine[] }> };

function ClientDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["client", id], queryFn: async () => (await api.get<ClientDetail>(`/clients/${id}`)).data });
  const [draft, setDraft] = useState<{ name: string; phone: string; allergies: string; isBlocked: boolean } | null>(null);

  const c = q.data;
  const form = draft ?? (c ? { name: c.name, phone: c.phone, allergies: c.allergies ?? "", isBlocked: c.isBlocked } : null);

  const save = useMutation({
    mutationFn: async () => (await api.patch(`/clients/${id}`, { name: form!.name.trim(), phone: form!.phone.trim(), allergies: form!.allergies.trim() || null, isBlocked: form!.isBlocked })).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["clients"] }); void qc.invalidateQueries({ queryKey: ["client", id] }); setDraft(null); toast.success("Saved"); },
  });

  return (
    <Modal open onClose={onClose} title="Client" wide footer={draft ? <><Button variant="outline" onClick={() => setDraft(null)}>Discard</Button><Button variant="gold" loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button></> : undefined}>
      {!form || !c ? <Spinner /> : (
        <div className="space-y-5">
          {save.isError && <ErrorNote>{errorMessage(save.error)}</ErrorNote>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" value={form.name} onChange={(e) => setDraft({ ...form, name: e.target.value })} />
            <Input label="Phone" value={form.phone} onChange={(e) => setDraft({ ...form, phone: e.target.value })} hint={<a href={telHref(form.phone)} className="text-gold-700 hover:underline">Call this number</a>} />
          </div>
          <Textarea label="Allergies & notes" value={form.allergies} onChange={(e) => setDraft({ ...form, allergies: e.target.value })} />
          <Toggle checked={form.isBlocked} onChange={(v) => setDraft({ ...form, isBlocked: v })} label="Block this client" hint="Blocked clients can't book online or be booked by staff." />

          <div>
            <h3 className="mb-2 font-sans text-sm font-semibold text-stone-700">Appointments & payments</h3>
            {c.bookings.length === 0 ? <p className="text-sm text-stone-500">No appointments yet.</p> : (
              <>
                <p className="mb-2 text-xs text-stone-500">Total paid by this client: <strong className="text-ink">{money(c.bookings.reduce((sum, b) => sum + (b.payments ?? []).reduce((a, p) => a + p.amount, 0), 0))}</strong></p>
                <ul className="divide-y divide-line rounded-lg border border-line text-sm">
                  {c.bookings.map((b) => {
                    const due = b.price - b.discount;
                    const paid = (b.payments ?? []).reduce((a, p) => a + p.amount, 0);
                    return (
                      <li key={b.id} className="px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span><span className="font-medium">{b.service.name}</span><span className="block text-xs text-stone-500">{fmtDateShort(toDateStr(b.startAt))} · {b.staff.name}</span></span>
                          <span className="flex items-center gap-3"><span className="tabular-nums">{money(due)}</span><Badge tone={statusTone(b.status)}>{statusLabel(b.status)}</Badge></span>
                        </div>
                        {(b.payments ?? []).length > 0 && (
                          <ul className="mt-2 space-y-1 rounded-lg bg-cream px-3 py-2 text-xs text-stone-600">
                            {(b.payments ?? []).map((p) => (
                              <li key={p.id} className="flex justify-between gap-3">
                                <span>{fmtDateTime(p.paidAt)} · {p.kind === "REFUND" ? "Refund" : p.kind === "DEPOSIT" && p.amount < due ? "Deposit" : p.kind === "DEPOSIT" ? "Paid in full" : "Payment"} · {p.method === "MPESA" ? `M-Pesa ${p.mpesaReceipt ?? ""}` : p.method === "CASH" ? "Cash" : "Card"}{p.notes ? ` · ${p.notes}` : ""}</span>
                                <span className={`tabular-nums ${p.amount < 0 ? "text-red-600" : ""}`}>{money(p.amount)}</span>
                              </li>
                            ))}
                            <li className="flex justify-between border-t border-line pt-1 font-medium text-ink"><span>{paid >= due ? "Settled" : "Still owing"}</span><span className="tabular-nums">{paid >= due ? money(paid) : money(due - paid)}</span></li>
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
