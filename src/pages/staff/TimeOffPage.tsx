import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarOff, Phone, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { api, errorMessage } from "../../lib/api";
import { fmtDateShort, fmtTime, toDateStr, todayStr } from "../../lib/format";
import { useStaffList } from "../../lib/queries";
import { Badge, Button, Card, Empty, ErrorNote, Input, PageHeader, Select, Spinner } from "../../components/ui";

type Kind = "LEAVE" | "OFF_DAY" | "EMERGENCY" | "SICK" | "HOLIDAY";
interface Affected { id: string; startAt: string; clientName: string; clientPhone: string; service: string; staffName: string }
interface TimeOff { id: string; staffId: string | null; kind: Kind; startAt: string; endAt: string; reason: string | null; staff: { name: string } | null; affectedBookings: Affected[] }

const KINDS: Record<Kind, { label: string; tone: "gold" | "red" | "amber" | "gray" | "green"; hint: string }> = {
  LEAVE: { label: "Leave", tone: "gold", hint: "Planned holiday or leave." },
  OFF_DAY: { label: "Off day", tone: "gray", hint: "A regular day off." },
  EMERGENCY: { label: "Emergency", tone: "red", hint: "Unplanned. If it starts today, booking closes from this moment." },
  SICK: { label: "Sick", tone: "amber", hint: "Sick day." },
  HOLIDAY: { label: "Public holiday / closure", tone: "green", hint: "Whole salon closed." },
};

function describe(t: TimeOff) {
  const first = toDateStr(t.startAt);
  const last = toDateStr(new Date(new Date(t.endAt).getTime() - 1));
  const wholeDays = fmtTime(t.startAt) === "00:00" && fmtTime(new Date(new Date(t.endAt).getTime() - 1)) === "23:59";
  if (first === last && !wholeDays) return `${fmtDateShort(first)} · ${fmtTime(t.startAt)}–${fmtTime(t.endAt)}`;
  return first === last ? fmtDateShort(first) : `${fmtDateShort(first)} – ${fmtDateShort(last)}`;
}

export default function TimeOffPage() {
  const qc = useQueryClient();
  const staff = useStaffList();
  const q = useQuery({ queryKey: ["time-off"], queryFn: async () => (await api.get<TimeOff[]>("/time-off")).data });
  const [f, setF] = useState({ staffId: "", kind: "LEAVE" as Kind, from: todayStr(), to: todayStr(), partDay: false, startTime: "09:00", endTime: "13:00", reason: "" });
  const [affected, setAffected] = useState<Affected[]>([]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["time-off"] });
    void qc.invalidateQueries({ queryKey: ["public-slots"] });
  };

  const add = useMutation({
    mutationFn: async () =>
      (await api.post<{ affectedBookings: Affected[] }>("/time-off", {
        kind: f.kind,
        from: f.from,
        to: f.partDay ? f.from : f.to,
        ...(f.kind !== "HOLIDAY" && f.staffId ? { staffId: f.staffId } : {}),
        ...(f.partDay ? { startTime: f.startTime, endTime: f.endTime } : {}),
        ...(f.reason.trim() ? { reason: f.reason.trim() } : {}),
      })).data,
    onSuccess: (d) => {
      refresh();
      setAffected(d.affectedBookings);
      if (d.affectedBookings.length === 0) toast.success("Time off saved");
      else toast(`Saved. ${d.affectedBookings.length} booking(s) fall in this period and need rebooking.`, { icon: "⚠️", duration: 6000 });
      setF({ ...f, reason: "" });
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/time-off/${id}`)).data,
    onSuccess: () => { refresh(); toast.success("Removed"); },
  });

  return (
    <div className="max-w-3xl">
      <PageHeader title="Time off" subtitle="Schedule leave, off days, sick days, emergencies and closures. Clients can't book these times." />

      <Card className="mb-6">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); add.mutate(); }} className="grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <Select label="Type" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Kind })}>
              {(Object.keys(KINDS) as Kind[]).map((k) => <option key={k} value={k}>{KINDS[k].label}</option>)}
            </Select>
          </div>
          <div className="sm:col-span-3">
            <Select label="Who" value={f.kind === "HOLIDAY" ? "" : f.staffId} disabled={f.kind === "HOLIDAY"} onChange={(e) => setF({ ...f, staffId: e.target.value })}>
              <option value="">Whole salon (closed)</option>
              {staff.data?.filter((s) => s.isActive && s.isBookable).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <p className="text-xs text-stone-500 sm:col-span-6">{KINDS[f.kind].hint}</p>

          <div className="sm:col-span-3">
            <Input label={f.partDay ? "Date" : "From"} type="date" min={todayStr()} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: e.target.value > f.to ? e.target.value : f.to })} />
          </div>
          {!f.partDay && <div className="sm:col-span-3"><Input label="To" type="date" min={f.from} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>}
          <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-6">
            <input type="checkbox" checked={f.partDay} onChange={(e) => setF({ ...f, partDay: e.target.checked })} className="size-4 accent-gold-500" />
            Only part of the day (a few hours)
          </label>
          {f.partDay && (
            <>
              <div className="sm:col-span-3"><Input label="From time" type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} /></div>
              <div className="sm:col-span-3"><Input label="Until" type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} /></div>
            </>
          )}
          <div className="sm:col-span-6"><Input label="Note (optional)" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
          <div className="sm:col-span-6"><Button type="submit" variant="gold" loading={add.isPending}>Save time off</Button></div>
        </form>
        {add.isError && <div className="mt-3"><ErrorNote>{errorMessage(add.error)}</ErrorNote></div>}
      </Card>

      {affected.length > 0 && (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <h2 className="font-semibold text-amber-900">These bookings need rebooking</h2>
          <p className="mb-3 text-sm text-amber-800">They are still on the calendar. Call the clients, then move or cancel them from the Calendar.</p>
          <AffectedList rows={affected} />
          <div className="mt-3"><Button variant="outline" onClick={() => setAffected([])}>Dismiss</Button></div>
        </Card>
      )}

      <Card padded={false}>
        {q.isLoading ? <Spinner /> : !q.data || q.data.length === 0 ? (
          <Empty icon={<CalendarOff className="size-6" />} title="No time off scheduled" hint="Anything you add above shows up here." />
        ) : (
          <ul className="divide-y divide-line">
            {q.data.map((t) => (
              <li key={t.id} className="px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 text-sm">
                    <Badge tone={KINDS[t.kind]?.tone ?? "gray"}>{KINDS[t.kind]?.label ?? t.kind}</Badge>{" "}
                    <span className="font-medium">{t.staff?.name ?? "Whole salon"}</span> · {describe(t)}
                    {t.reason && <span className="text-stone-500"> · {t.reason}</span>}
                  </span>
                  <button aria-label="Remove" onClick={() => { if (confirm("Remove this time off? Clients will be able to book these times again.")) remove.mutate(t.id); }} className="rounded p-1.5 text-stone-400 hover:bg-stone-100 hover:text-red-600"><Trash2 className="size-4" /></button>
                </div>
                {t.affectedBookings.length > 0 && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-amber-700">{t.affectedBookings.length} booking(s) clash with this</summary>
                    <div className="mt-2"><AffectedList rows={t.affectedBookings} /></div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AffectedList({ rows }: { rows: Affected[] }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.map((b) => (
        <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2">
          <span><strong>{b.clientName}</strong> · {b.service} · {fmtDateShort(toDateStr(b.startAt))} {fmtTime(b.startAt)} · {b.staffName}</span>
          <a href={`tel:${b.clientPhone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 text-gold-700 underline"><Phone className="size-3.5" />{b.clientPhone}</a>
        </li>
      ))}
    </ul>
  );
}
