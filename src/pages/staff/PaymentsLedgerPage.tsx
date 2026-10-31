import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ChevronRight, Copy, Download, Receipt, Search } from "lucide-react";
import toast from "react-hot-toast";
import { api, errorMessage } from "../../lib/api";
import { addDays, fmtDateTime, money, todayStr } from "../../lib/format";
import { Badge, Button, Card, Empty, ErrorNote, Modal, PageHeader, Select, Spinner, Stat, Tabs, cx } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { useBranches } from "../../lib/queries";

type Method = "CASH" | "MPESA" | "CARD";
type Kind = "DEPOSIT" | "BALANCE" | "REFUND";

interface LedgerRow {
  id: string;
  paidAt: string;
  recordedAt: string;
  amount: number;
  method: Method;
  kind: Kind;
  paidInFull: boolean;
  receipt: string | null;
  phone: string | null;
  clientName: string | null;
  branchName: string;
  service: string | null;
  bookingId: string | null;
  recordedBy: string;
  notes: string | null;
}
interface Ledger {
  byBranch: Array<{ id: string; name: string; net: number; count: number }>;
  rows: LedgerRow[];
  page: number;
  pageSize: number;
  total: number;
  totals: { collected: number; refunded: number; net: number; deposits: number; balances: number; byMethod: Record<Method, number> };
  unmatched: { count: number; amount: number };
}
interface Attempt { id: string; at: string; name: string | null; phone: string; amount: number; status: string; reason: string | null; forSlot: string }

const KIND_LABEL: Record<Kind, string> = { DEPOSIT: "Deposit", BALANCE: "Balance", REFUND: "Refund" };
const kindLabel = (r: { kind: Kind; paidInFull: boolean }) => (r.paidInFull ? "Paid in full" : KIND_LABEL[r.kind]);
const METHOD_LABEL: Record<Method, string> = { MPESA: "M-Pesa", CASH: "Cash", CARD: "Card" };
const ATTEMPT_LABEL: Record<string, { text: string; tone: "amber" | "red" | "gray" }> = {
  PENDING: { text: "Waiting for the client", tone: "amber" },
  FAILED: { text: "Declined or cancelled", tone: "red" },
  EXPIRED: { text: "Timed out", tone: "gray" },
  CONFLICT: { text: "Paid but slot was taken", tone: "red" },
};

type Tab = "clients" | "ledger" | "attempts";

export default function PaymentsLedgerPage() {
  const { user } = useAuth();
  const branches = useBranches();
  // An owner who works across branches can add every branch together; everyone else always sees their own branch.
  const spans = Boolean(user?.role === "OWNER" && user.canSwitchBranches && (branches.data?.branches.length ?? 0) > 1);
  const [scope, setScope] = useState<"here" | "all">("here");
  const everyBranch = spans && scope === "all";
  const [tab, setTab] = useState<Tab>("clients");
  const [from, setFrom] = useState(addDays(todayStr(), -29));
  const [to, setTo] = useState(todayStr());
  const [method, setMethod] = useState("");
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<LedgerRow | null>(null);
  const [exporting, setExporting] = useState(false);

  // Wait for the owner to stop typing before asking the server.
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const params = { from, to, ...(everyBranch ? { all: "1" } : {}), ...(method ? { method } : {}), ...(kind ? { kind } : {}), ...(q ? { q } : {}) };
  const ledger = useQuery({
    queryKey: ["ledger", params, page],
    queryFn: async () => (await api.get<Ledger>("/ledger", { params: { ...params, page } })).data,
    placeholderData: (prev) => prev,
  });
  const byClient = useQuery({
    queryKey: ["ledger-by-client", params],
    queryFn: async () => (await api.get<ByClient>("/ledger/by-client", { params })).data,
    enabled: tab === "clients",
  });
  const attempts = useQuery({
    queryKey: ["ledger-attempts", from, to],
    queryFn: async () => (await api.get<Attempt[]>("/ledger/attempts", { params: { from, to } })).data,
    enabled: tab === "attempts",
  });

  const range = (days: number) => { setTo(todayStr()); setFrom(addDays(todayStr(), -(days - 1))); setPage(1); };
  const monthStart = () => { setTo(todayStr()); setFrom(`${todayStr().slice(0, 8)}01`); setPage(1); };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await api.get<Blob>("/ledger/export.csv", { params, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payments-${from}-to-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const d = ledger.data;
  const pages = d ? Math.max(1, Math.ceil(d.total / d.pageSize)) : 1;

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle={`${everyBranch ? "Every branch together" : "This branch"}: who paid, the M-Pesa code, the phone and the time. Visible to the owner only.`}
        actions={<Button variant="outline" icon={<Download className="size-4" />} loading={exporting} onClick={() => void exportCsv()}>Export to Excel</Button>}
      />

      {spans && (
        <div className="mb-4 flex gap-2" role="group" aria-label="Which branches to count">
          {([["here", "This branch"], ["all", "All branches"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => { setScope(k); setPage(1); }} aria-pressed={scope === k} className={cx("rounded-full border px-4 py-1.5 text-sm", scope === k ? "border-ink bg-ink text-white" : "border-line bg-white")}>{label}</button>
          ))}
        </div>
      )}

      {d && d.unmatched.count > 0 && (
        <Link to="/app/money" className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <span><strong>{d.unmatched.count} M-Pesa payment{d.unmatched.count === 1 ? "" : "s"} ({money(d.unmatched.amount)})</strong> arrived but {d.unmatched.count === 1 ? "isn't" : "aren't"} matched to a booking yet. Open Money to match or refund {d.unmatched.count === 1 ? "it" : "them"}.</span>
        </Link>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Money in" value={d ? money(d.totals.collected) : "…"} hint={d ? `Deposits ${money(d.totals.deposits)} · Balances ${money(d.totals.balances)}` : undefined} />
        <Stat label="Refunded" value={d ? money(d.totals.refunded) : "…"} {...(d && d.totals.refunded > 0 ? { tone: "bad" as const } : {})} />
        <Stat label="Net" value={d ? money(d.totals.net) : "…"} />
        <Stat label="M-Pesa" value={d ? money(d.totals.byMethod.MPESA) : "…"} hint={d ? `Cash ${money(d.totals.byMethod.CASH)}${d.totals.byMethod.CARD ? ` · Card ${money(d.totals.byMethod.CARD)}` : ""}` : undefined} />
      </div>

      {everyBranch && d && d.byBranch.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">By branch</h2>
          <ul className="divide-y divide-line text-sm">
            {d.byBranch.map((b) => <li key={b.id} className="flex justify-between gap-3 py-2"><span>{b.name} <span className="text-xs text-stone-500">· {b.count} payment{b.count === 1 ? "" : "s"}</span></span><span className="font-semibold tabular-nums">{money(b.net)}</span></li>)}
          </ul>
        </Card>
      )}

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-stone-600">From
            <input type="date" value={from} max={to} onChange={(e) => { if (e.target.value) { setFrom(e.target.value); setPage(1); } }} className="mt-1 block h-10 rounded-lg border border-line bg-white px-3 text-sm" />
          </label>
          <label className="text-xs font-medium text-stone-600">To
            <input type="date" value={to} min={from} max={todayStr()} onChange={(e) => { if (e.target.value) { setTo(e.target.value); setPage(1); } }} className="mt-1 block h-10 rounded-lg border border-line bg-white px-3 text-sm" />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => range(1)}>Today</Button>
            <Button size="sm" variant="outline" onClick={() => range(7)}>7 days</Button>
            <Button size="sm" variant="outline" onClick={() => range(30)}>30 days</Button>
            <Button size="sm" variant="outline" onClick={monthStart}>This month</Button>
          </div>
        </div>
        {tab !== "attempts" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone or M-Pesa code" aria-label="Search payments" className="h-10 w-full rounded-lg border border-line bg-white pr-3 pl-9 text-sm" />
            </div>
            <Select label="Method" value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }}>
              <option value="">All methods</option>
              <option value="MPESA">M-Pesa</option>
              <option value="CASH">Cash</option>
            </Select>
            <Select label="Type" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }}>
              <option value="">All types</option>
              <option value="DEPOSIT">Deposits</option>
              <option value="BALANCE">Balances</option>
              <option value="REFUND">Refunds</option>
            </Select>
          </div>
        )}
      </Card>

      <Tabs value={tab} onChange={setTab} tabs={[{ id: "clients", label: "By client" }, { id: "ledger", label: "Every payment" }, { id: "attempts", label: "Failed M-Pesa attempts" }]} />

      {tab === "clients" && (
        <>
          {byClient.isError && <ErrorNote>{errorMessage(byClient.error)}</ErrorNote>}
          <p className="mb-3 text-sm text-stone-600">One line per client with everything they paid in total, however many payments it took. Open a client to see each deposit and balance.</p>
          <Card padded={false}>
            {byClient.isLoading ? <Spinner /> : !byClient.data || byClient.data.clients.length === 0 ? (
              <Empty icon={<Receipt className="size-6" />} title="No client payments match" hint="Try a wider date range or clear the search." />
            ) : (
              <ul className="divide-y divide-line">
                {byClient.data.clients.map((c) => <ClientRow key={c.clientId} c={c} />)}
              </ul>
            )}
          </Card>
        </>
      )}

      {tab === "ledger" && (
        <>
          {ledger.isError && <ErrorNote>{errorMessage(ledger.error)}</ErrorNote>}
          <Card padded={false}>
            {ledger.isLoading ? <Spinner /> : !d || d.rows.length === 0 ? (
              <Empty icon={<Receipt className="size-6" />} title="No payments match" hint="Try a wider date range or clear the search." />
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-line bg-cream/60 text-xs tracking-wide text-stone-500 uppercase">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Time paid</th>
                        {everyBranch && <th className="px-4 py-2.5 font-medium">Branch</th>}
                        <th className="px-4 py-2.5 font-medium">Client</th>
                        <th className="px-4 py-2.5 font-medium">Phone</th>
                        <th className="px-4 py-2.5 font-medium">M-Pesa code</th>
                        <th className="px-4 py-2.5 font-medium">Type</th>
                        <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {d.rows.map((r) => (
                        <tr key={r.id} tabIndex={0} onClick={() => setOpen(r)} onKeyDown={(e) => e.key === "Enter" && setOpen(r)} className="cursor-pointer hover:bg-cream/50 focus:bg-cream/50 focus:outline-none">
                          <td className="px-4 py-3 whitespace-nowrap text-stone-600">{fmtDateTime(r.paidAt)}</td>
                          {everyBranch && <td className="px-4 py-3 whitespace-nowrap text-stone-600">{r.branchName}</td>}
                          <td className="px-4 py-3 font-medium">{r.clientName ?? <span className="font-normal text-stone-400">Not linked to a client</span>}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-stone-600">{r.phone ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{r.receipt ?? (r.method === "MPESA" ? <span className="text-amber-700">No code recorded</span> : "—")}</td>
                          <td className="px-4 py-3 whitespace-nowrap"><Badge tone={r.kind === "REFUND" ? "red" : r.kind === "DEPOSIT" && !r.paidInFull ? "gold" : "green"}>{kindLabel(r)}</Badge> <span className="text-xs text-stone-500">{METHOD_LABEL[r.method]}</span></td>
                          <td className={`px-4 py-3 text-right font-semibold tabular-nums ${r.amount < 0 ? "text-red-600" : ""}`}>{money(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="divide-y divide-line md:hidden">
                  {d.rows.map((r) => (
                    <li key={r.id}>
                      <button onClick={() => setOpen(r)} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{r.clientName ?? "Not linked to a client"}</span>
                          <span className="block truncate text-xs text-stone-500">{everyBranch ? `${r.branchName} · ` : ""}{fmtDateTime(r.paidAt)} · {METHOD_LABEL[r.method]} {kindLabel(r).toLowerCase()}</span>
                          {r.receipt && <span className="block font-mono text-xs text-stone-500">{r.receipt}</span>}
                        </span>
                        <span className={`text-sm font-semibold tabular-nums ${r.amount < 0 ? "text-red-600" : ""}`}>{money(r.amount)}</span>
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-stone-600">
                  <span>{d.total.toLocaleString("en-KE")} payment{d.total === 1 ? "" : "s"}</span>
                  <span className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></Button>
                    Page {page} of {pages}
                    <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight className="size-4" /></Button>
                  </span>
                </div>
              </>
            )}
          </Card>
        </>
      )}

      {tab === "attempts" && (
        <>
          <p className="mb-3 max-w-2xl text-sm text-stone-600">M-Pesa requests sent to clients that did not turn into money: the client declined, ignored the prompt, or paid after their slot was taken. Use this to follow up with people who tried to book.</p>
          <Card padded={false}>
            {attempts.isLoading ? <Spinner /> : !attempts.data || attempts.data.length === 0 ? (
              <Empty icon={<Receipt className="size-6" />} title="No failed attempts" hint="Every M-Pesa request in this period was paid." />
            ) : (
              <ul className="divide-y divide-line">
                {attempts.data.map((a) => {
                  const s = ATTEMPT_LABEL[a.status] ?? { text: a.status, tone: "gray" as const };
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{a.name ?? "Guest"} · {a.phone}</span>
                        <span className="block text-xs text-stone-500">{fmtDateTime(a.at)} · {money(a.amount)}{a.reason ? ` · ${a.reason}` : ""}</span>
                      </span>
                      <Badge tone={s.tone}>{s.text}</Badge>
                      <a href={`tel:${a.phone}`} className="text-sm font-medium text-gold-700 hover:underline">Call</a>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}

      {open && <Detail row={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Detail({ row, onClose }: { row: LedgerRow; onClose: () => void }) {
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  };
  const lines: Array<[string, React.ReactNode]> = [
    ["Amount", <strong className={row.amount < 0 ? "text-red-600" : ""}>{money(row.amount)}</strong>],
    ["Type", `${kindLabel(row)} · ${METHOD_LABEL[row.method]}`],
    ["Branch", row.branchName],
    ["Time paid", fmtDateTime(row.paidAt)],
    ["Client", row.clientName ?? "Not linked to a client"],
    ["Phone", row.phone ?? "—"],
    ["M-Pesa code", row.receipt ? (
      <span className="inline-flex items-center gap-2 font-mono">{row.receipt}<button aria-label="Copy M-Pesa code" onClick={() => void copy(row.receipt!)} className="rounded p-1 text-stone-400 hover:bg-stone-100"><Copy className="size-4" /></button></span>
    ) : "—"],
    ["Service", row.service ?? "—"],
    ["Recorded by", row.recordedBy],
    ["Written to the books", fmtDateTime(row.recordedAt)],
  ];
  if (row.notes) lines.push(["Notes", row.notes]);
  return (
    <Modal open onClose={onClose} title="Payment details" footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
      <dl className="divide-y divide-line text-sm">
        {lines.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="text-stone-500">{k}</dt><dd className="text-right">{v}</dd></div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-stone-500">To refund a payment, open Money → Payments. Payment records can't be edited, so the books stay trustworthy.</p>
    </Modal>
  );
}

interface ClientPayment { id: string; amount: number; method: Method; kind: Kind; mpesaReceipt: string | null; paidAt: string; notes: string | null }
interface ClientBooking { id: string; service: string; startAt: string; status: string; due: number; paid: number; balance: number; payments: ClientPayment[] }
interface ClientTotal { clientId: string; name: string; phone: string; paid: number; refunded: number; net: number; lastPaidAt: string; bookings: ClientBooking[] }
interface ByClient { clients: ClientTotal[]; totalClients: number; net: number }

function ClientRow({ c }: { c: ClientTotal }) {
  const [open, setOpen] = useState(false);
  const owing = c.bookings.reduce((a, b) => a + b.balance, 0);
  const count = c.bookings.reduce((a, b) => a + b.payments.length, 0);
  return (
    <li>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cream/60 sm:px-5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{c.name}</span>
          <span className="block truncate text-xs text-stone-500">{c.phone} · {count} payment{count === 1 ? "" : "s"} · last {fmtDateTime(c.lastPaidAt)}</span>
        </span>
        {owing > 0 && <Badge tone="amber">Owes {money(owing)}</Badge>}
        <span className="text-right"><span className="block text-sm font-semibold tabular-nums">{money(c.net)}</span><span className="block text-xs text-stone-500">paid in total</span></span>
      </button>
      {open && (
        <div className="space-y-3 bg-cream/50 px-4 py-3 sm:px-5">
          {c.refunded > 0 && <p className="text-xs text-stone-600">Paid {money(c.paid)}, refunded {money(c.refunded)}.</p>}
          {c.bookings.map((b) => (
            <div key={b.id} className="rounded-lg border border-line bg-white p-3 text-sm">
              <div className="flex justify-between gap-3"><span className="font-medium">{b.service} <span className="font-normal text-stone-500">· {fmtDateTime(b.startAt)}</span></span><span className="tabular-nums">{money(b.due)}</span></div>
              <ul className="mt-2 space-y-1 text-xs text-stone-600">
                {b.payments.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span>{fmtDateTime(p.paidAt)} · {p.kind === "REFUND" ? "Refund" : p.kind === "DEPOSIT" && p.amount < b.due ? "Deposit" : p.kind === "DEPOSIT" ? "Paid in full" : "Payment"} · {METHOD_LABEL[p.method]}{p.mpesaReceipt ? ` ${p.mpesaReceipt}` : ""}</span>
                    <span className={`tabular-nums ${p.amount < 0 ? "text-red-600" : ""}`}>{money(p.amount)}</span>
                  </li>
                ))}
                <li className="flex justify-between border-t border-line pt-1 font-medium text-ink"><span>{b.balance > 0 ? "Still owing" : "Settled"}</span><span className="tabular-nums">{b.balance > 0 ? money(b.balance) : money(b.paid)}</span></li>
              </ul>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
