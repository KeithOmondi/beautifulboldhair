import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Lock, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { api, errorMessage } from "../../lib/api";
import { fmtMonth, money, todayStr } from "../../lib/format";
import { Badge, Button, Card, Confirm, Empty, ErrorNote, Input, Modal, PageHeader, Select, Spinner, Textarea } from "../../components/ui";

interface Line {
  id: string;
  staffId: string;
  salary: number;
  commission: number;
  finalAmount: number;
  staff: { name: string };
  adjustments: Array<{ id: string; type: "ADVANCE" | "DEDUCTION" | "BONUS"; amount: number; note: string | null }>;
}
interface Run { id: string; month: string; status: string; locked: boolean; lines: Line[] }

export default function PayrollPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["payroll"], queryFn: async () => (await api.get<Run[]>("/payroll/runs")).data });
  const [generating, setGenerating] = useState(false);
  const [adjusting, setAdjusting] = useState<{ run: Run; line: Line } | null>(null);
  const [approving, setApproving] = useState<Run | null>(null);

  const approve = useMutation({
    mutationFn: async (id: string) => (await api.post(`/payroll/runs/${id}/approve`)).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["payroll"] }); toast.success("Payroll approved and locked"); setApproving(null); },
    onError: (e) => { toast.error(errorMessage(e)); setApproving(null); },
  });

  return (
    <div>
      <PageHeader title="Payroll" subtitle="Monthly pay from salaries and commission on completed, paid appointments." actions={<Button variant="gold" icon={<Plus className="size-4" />} onClick={() => setGenerating(true)}>Run payroll</Button>} />
      {q.isLoading ? <Spinner /> : q.data?.length === 0 ? (
        <Card><Empty icon={<Coins className="size-6" />} title="No payroll runs yet" hint="Run payroll for a month to see what each person is owed." /></Card>
      ) : (
        <div className="space-y-6">
          {q.data?.map((run) => {
            const total = run.lines.reduce((s, l) => s + l.finalAmount, 0);
            return (
              <Card key={run.id} padded={false}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold">{fmtMonth(run.month.slice(0, 7))}</h2>
                    <Badge tone={run.locked ? "gray" : "amber"}>{run.locked ? "Approved" : "Draft"}</Badge>
                    {run.locked && <Lock className="size-4 text-stone-400" aria-label="Locked" />}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-stone-500">Total <strong className="text-base text-ink">{money(total)}</strong></span>
                    {!run.locked && <Button size="sm" variant="gold" onClick={() => setApproving(run)}>Approve & lock</Button>}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="text-left text-xs tracking-wide text-stone-500 uppercase">
                      <tr><th className="px-5 py-2.5 font-medium">Staff</th><th className="px-3 py-2.5 text-right font-medium">Salary</th><th className="px-3 py-2.5 text-right font-medium">Commission</th><th className="px-3 py-2.5 text-right font-medium">Adjustments</th><th className="px-5 py-2.5 text-right font-medium">Pay</th><th /></tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {run.lines.map((l) => {
                        const adj = l.adjustments.reduce((s, a) => s + (a.type === "BONUS" ? a.amount : -a.amount), 0);
                        return (
                          <tr key={l.id}>
                            <td className="px-5 py-3 font-medium">{l.staff.name}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{money(l.salary)}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{money(l.commission)}</td>
                            <td className="px-3 py-3 text-right tabular-nums" title={l.adjustments.map((a) => `${a.type.toLowerCase()} ${a.amount}${a.note ? ` (${a.note})` : ""}`).join(", ")}>{adj === 0 ? "—" : `${adj > 0 ? "+" : "−"} ${money(Math.abs(adj))}`}</td>
                            <td className="px-5 py-3 text-right font-semibold tabular-nums">{money(l.finalAmount)}</td>
                            <td className="pr-4 text-right">{!run.locked && <button onClick={() => setAdjusting({ run, line: l })} className="text-xs text-gold-700 hover:underline">Adjust</button>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {generating && <GenerateDialog onClose={() => setGenerating(false)} />}
      {adjusting && <AdjustDialog {...adjusting} onClose={() => setAdjusting(null)} />}
      <Confirm open={Boolean(approving)} onClose={() => setApproving(null)} title="Approve this payroll?" confirmLabel="Approve & lock" loading={approve.isPending} onConfirm={() => approving && approve.mutate(approving.id)} body="Once approved, this month is locked and can no longer be changed." />
    </div>
  );
}

function GenerateDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const m = useMutation({
    mutationFn: async () => (await api.post("/payroll/runs", { month })).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["payroll"] }); toast.success("Payroll created"); onClose(); },
  });
  return (
    <Modal open onClose={onClose} title="Run payroll" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="gold" loading={m.isPending} onClick={() => m.mutate()}>Create draft</Button></>}>
      {m.isError && <div className="mb-3"><ErrorNote>{errorMessage(m.error)}</ErrorNote></div>}
      <Input label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} hint="Uses completed and fully paid appointments in that month." />
    </Modal>
  );
}

function AdjustDialog({ run, line, onClose }: { run: Run; line: Line; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ type: "ADVANCE", amount: "", note: "" });
  const m = useMutation({
    mutationFn: async () => (await api.post(`/payroll/runs/${run.id}/adjustments`, { staffId: line.staffId, type: f.type, amount: Number(f.amount), ...(f.note.trim() ? { note: f.note.trim() } : {}) })).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["payroll"] }); toast.success("Adjustment added"); onClose(); },
  });
  return (
    <Modal open onClose={onClose} title={`Adjust pay · ${line.staff.name}`} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="gold" loading={m.isPending} onClick={() => m.mutate()}>Add</Button></>}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
        {m.isError && <ErrorNote>{errorMessage(m.error)}</ErrorNote>}
        <Select label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          <option value="ADVANCE">Advance (already paid)</option>
          <option value="DEDUCTION">Deduction</option>
          <option value="BONUS">Bonus</option>
        </Select>
        <Input label="Amount (KES)" type="number" min={1} required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <Textarea label="Note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </form>
    </Modal>
  );
}
