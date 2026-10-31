import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../auth/AuthContext";
import { api, errorMessage } from "../../lib/api";
import { fmtClock12 } from "../../lib/format";
import { useAccess, useBranches, useServices, useStaffList } from "../../lib/queries";
import { setStaffBranch, staffBranch } from "../../lib/branch";
import { groupByCategory } from "../../lib/categories";
import type { Role, StaffMember, WeeklyHours } from "../../lib/types";
import { Avatar, Badge, Button, ErrorNote, Input, Modal, PageHeader, Select, Spinner, Toggle, cx } from "../../components/ui";

const ROLE_LABEL: Record<Role, string> = { OWNER: "Owner", MANAGER: "Manager", RECEPTIONIST: "Receptionist", WORKER: "Stylist" };
const DAYS = [
  { n: 1, label: "Mon" }, { n: 2, label: "Tue" }, { n: 3, label: "Wed" }, { n: 4, label: "Thu" },
  { n: 5, label: "Fri" }, { n: 6, label: "Sat" }, { n: 0, label: "Sun" },
];
const DEFAULT_HOURS: WeeklyHours = Object.fromEntries(DAYS.map((d) => [String(d.n), d.n === 0 ? null : { start: "09:00", end: "18:00" }]));

type AllStaff = StaffMember & { branchId: string; branchName: string };

export default function TeamPage() {
  const { user } = useAuth();
  const branches = useBranches();
  const spans = Boolean(user?.canSwitchBranches && user.role === "OWNER" && (branches.data?.branches.length ?? 0) > 1);
  const [scope, setScope] = useState<"here" | "all">("here");
  const all = useQuery({ queryKey: ["staff-all"], enabled: spans && scope === "all", queryFn: async () => (await api.get<AllStaff[]>("/staff", { params: { all: "1" } })).data });
  const q = useStaffList();
  const meRole = user?.role;
  // A manager looks after front-desk staff and stylists; managers and owners are the owner's to manage.
  const mayManage = (s: StaffMember) => meRole === "OWNER" || (meRole === "MANAGER" && (s.role === "RECEPTIONIST" || s.role === "WORKER"));
  const [editing, setEditing] = useState<StaffMember | "new" | null>(null);
  const [credentials, setCredentials] = useState<{ name: string; email: string; password: string } | null>(null);

  return (
    <div>
      <PageHeader title="Team" subtitle="Who works here, and when they're bookable." actions={<Button variant="gold" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>Add team member</Button>} />
      {spans && (
        <div className="mb-4 flex gap-2" role="group" aria-label="Which team">
          {([["here", "This branch"], ["all", "All branches"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setScope(k)} aria-pressed={scope === k} className={cx("rounded-full border px-4 py-1.5 text-sm", scope === k ? "border-ink bg-ink text-white" : "border-line bg-white")}>{label}</button>
          ))}
        </div>
      )}
      {spans && scope === "all" ? (
        all.isLoading ? <Spinner /> : (
          <div className="space-y-6">
            {[...new Set((all.data ?? []).map((s) => s.branchId))].map((bid) => {
              const people = (all.data ?? []).filter((s) => s.branchId === bid);
              return (
                <section key={bid} aria-label={people[0]?.branchName}>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="font-display text-xl font-semibold text-ink">{people[0]?.branchName} <span className="text-sm font-normal text-stone-500">· {people.filter((p) => p.isActive).length} active</span></h2>
                    <Button size="sm" variant="outline" onClick={() => { setStaffBranch(bid === branches.data?.homeBranchId ? null : bid); window.location.assign("/app/team"); }}>Manage this team</Button>
                  </div>
                  <ul className="divide-y divide-line rounded-xl border border-line bg-white">
                    {people.map((s) => (
                      <li key={s.id} className={cx("flex items-center gap-3 px-4 py-3", !s.isActive && "opacity-60")}>
                        <Avatar name={s.name} className="size-9" />
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-ink">{s.name}</span><span className="block truncate text-xs text-stone-500">{s.title ?? ROLE_LABEL[s.role]} · {s.phone}</span></span>
                        <Badge tone="gold">{ROLE_LABEL[s.role]}</Badge>
                        {!s.isActive && <Badge>Inactive</Badge>}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )
      ) : q.isLoading ? <Spinner /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {q.data?.map((s) => (
            <button key={s.id} onClick={() => (mayManage(s) ? setEditing(s) : toast("Only an owner can change a manager or an owner.", { icon: "🔒" }))} className={cx("rounded-xl border border-line bg-white p-5 text-left shadow-sm transition hover:border-gold-400", !s.isActive && "opacity-60", !mayManage(s) && "cursor-default")}>
              <div className="flex items-center gap-3">
                <Avatar name={s.name} className="size-11" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{s.name}</p>
                  <p className="truncate text-sm text-stone-500">{s.title ?? ROLE_LABEL[s.role]}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone="gold">{ROLE_LABEL[s.role]}</Badge>
                {s.isBookable && s.isActive && <Badge tone="green">Takes bookings</Badge>}
                {!s.isActive && <Badge>Inactive</Badge>}
              </div>
              <p className="mt-3 truncate text-xs text-stone-500">{s.email}</p>
            </button>
          ))}
        </div>
      )}
      {editing && <StaffDialog member={editing === "new" ? null : editing} onClose={() => setEditing(null)} onCreated={setCredentials} />}
      {credentials && <CredentialsDialog {...credentials} onClose={() => setCredentials(null)} />}
    </div>
  );
}

function CredentialsDialog({ name, email, password, onClose }: { name: string; email: string; password: string; onClose: () => void }) {
  const text = `Hi ${name.split(" ")[0]}, you can sign in at ${window.location.origin}/login\nEmail: ${email}\nTemporary password: ${password}\n(You'll choose a new password on first sign in.)`;
  return (
    <Modal open onClose={onClose} title="Share sign-in details" footer={<Button variant="gold" onClick={onClose}>Done</Button>}>
      <p className="mb-3 text-sm text-stone-600">Send this to {name}. This temporary password is shown only once.</p>
      <pre className="whitespace-pre-wrap rounded-lg bg-cream p-3 text-sm">{text}</pre>
      <Button className="mt-3" variant="outline" icon={<Copy className="size-4" />} onClick={() => { void navigator.clipboard.writeText(text); toast.success("Copied"); }}>Copy message</Button>
    </Modal>
  );
}

function StaffDialog({ member, onClose, onCreated }: { member: StaffMember | null; onClose: () => void; onCreated: (c: { name: string; email: string; password: string }) => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isSelf = member?.id === user?.id;
  const canMakeOwner = user?.role === "OWNER";
  const canMakeManager = user?.role === "OWNER";
  const access = useAccess();
  const branches = useBranches();
  // Only an owner who manages all branches picks where someone works; everyone else adds to their own branch.
  const pickBranch = Boolean(user?.role === "OWNER" && user.canSwitchBranches && (branches.data?.branches.filter((b) => b.isActive).length ?? 0) > 1);

  const activeBranchId = staffBranch() ?? branches.data?.homeBranchId ?? "";

  const [f, setF] = useState({
    name: member?.name ?? "",
    email: member?.email ?? "",
    phone: member?.phone ?? "",
    title: member?.title ?? "",
    role: (member?.role ?? "WORKER") as Role,
    isBookable: member?.isBookable ?? true,
    isActive: member?.isActive ?? true,
    canSwitchBranches: member?.canSwitchBranches ?? false,
    staffBranchId: "",
    payType: member?.payType ?? "COMMISSION_ONLY",
    monthlySalary: String(member?.monthlySalary ?? ""),
    commissionPct: member?.commissionPct != null ? String(member.commissionPct / 100) : "",
  });
  const [hours, setHours] = useState<WeeklyHours>(member?.weeklyHours ?? DEFAULT_HOURS);
  const [serviceIds, setServiceIds] = useState<string[]>(member?.serviceIds ?? []);
  const services = useServices();
  // The branch picked in the form (the one being viewed unless the owner changes it). The service list below belongs to the viewed branch.
  const chosenBranch = f.staffBranchId || activeBranchId;
  const otherBranch = pickBranch && chosenBranch !== activeBranchId;
  const toggleService =(id: string) => setServiceIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: f.name.trim(),
        phone: f.phone.trim(),
        title: f.title.trim() || null,
        role: f.role,
        isBookable: f.isBookable,
        ...(user?.canSwitchBranches && user.role === "OWNER" ? { canSwitchBranches: f.canSwitchBranches } : {}),
        weeklyHours: hours,
        // Services are per branch: when moving to or adding in another branch, they are chosen there afterwards.
        ...(otherBranch ? { staffBranchId: chosenBranch } : { serviceIds }),
        // Pay is only sent by someone who may see it; the server ignores it from anyone else.
        ...(access.staffPay ? { payType: f.payType, monthlySalary: f.monthlySalary ? Number(f.monthlySalary) : null, commissionPct: f.commissionPct ? Math.round(Number(f.commissionPct) * 100) : null } : {}),
      };
      if (member) return (await api.patch(`/staff/${member.id}`, { ...body, isActive: f.isActive })).data;
      const created = (await api.post<{ temporaryPassword: string }>("/staff", {
        ...body,
        email: f.email.trim(),
        title: body.title ?? undefined,
        ...(access.staffPay ? { monthlySalary: body.monthlySalary ?? undefined, commissionPct: body.commissionPct ?? undefined } : {}),
      })).data;
      onCreated({ name: f.name.trim(), email: f.email.trim(), password: created.temporaryPassword });
      return created;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["staff"] }); void qc.invalidateQueries({ queryKey: ["staff-all"] }); void qc.invalidateQueries({ queryKey: ["public-staff"] }); toast.success(member ? "Saved" : "Team member added"); onClose(); },
  });

  const reset = useMutation({
    mutationFn: async () => (await api.post<{ temporaryPassword: string }>(`/staff/${member!.id}/reset-password`)).data,
    onSuccess: (d) => { onCreated({ name: member!.name, email: member!.email, password: d.temporaryPassword }); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const setDay = (n: number, on: boolean) => setHours({ ...hours, [String(n)]: on ? { start: "09:00", end: "18:00" } : null });
  const setTime = (n: number, key: "start" | "end", value: string) => setHours({ ...hours, [String(n)]: { ...(hours[String(n)] ?? { start: "09:00", end: "18:00" }), [key]: value } });

  return (
    <Modal open onClose={onClose} wide title={member ? member.name : "Add team member"} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="gold" loading={save.isPending} onClick={() => save.mutate()}>{member ? "Save" : "Add & get sign-in details"}</Button></>}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="space-y-5">
        {save.isError && <ErrorNote>{errorMessage(save.error)}</ErrorNote>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Input label="Job title" placeholder="e.g. Lash artist" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Input label="Email (sign-in)" type="email" required disabled={Boolean(member)} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <Input label="Phone" type="tel" required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          {pickBranch && !isSelf && (
            <Select label="Branch" value={chosenBranch} onChange={(e) => setF({ ...f, staffBranchId: e.target.value })} hint={member ? "Moving someone to another branch needs them to have no upcoming bookings." : "Where this person works. They only ever see this branch."}>
              {branches.data?.branches.filter((b) => b.isActive).map((b) => <option key={b.id} value={b.id}>{b.city ?? b.name}</option>)}
            </Select>
          )}
          <Select label="Access level" value={f.role} disabled={isSelf} onChange={(e) => setF({ ...f, role: e.target.value as Role })} hint="Stylists see only their own appointments.">
            <option value="WORKER">Stylist</option>
            <option value="RECEPTIONIST">Receptionist</option>
            {canMakeManager && <option value="MANAGER">Manager</option>}
            {canMakeOwner && <option value="OWNER">Owner</option>}
          </Select>
        </div>

        <div className="space-y-1 rounded-xl border border-line p-4">
          <Toggle checked={f.isBookable} onChange={(v) => setF({ ...f, isBookable: v })} label="Takes online bookings" hint="Shows up on the calendar and on your booking website." />
          {user?.canSwitchBranches && user.role === "OWNER" && (f.role === "OWNER" || f.role === "MANAGER") && !isSelf && <Toggle checked={f.canSwitchBranches} onChange={(v) => setF({ ...f, canSwitchBranches: v })} label="Can work across all branches" hint="Off keeps them on this branch only. On lets them switch between branches." />}
          {member && !isSelf && <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Active" hint="Inactive people can't sign in or be booked." />}
        </div>

        {otherBranch && f.isBookable && <p className="rounded-lg bg-cream p-3 text-xs text-stone-600">Choose which services {f.name.trim() || "they"} perform after saving, by opening them from that branch&apos;s team.</p>}

        {!otherBranch && f.isBookable && services.data && services.data.length > 0 && (
          <div>
            <h3 className="mb-1 font-sans text-sm font-semibold text-stone-700">Services they perform</h3>
            <p className="mb-2 text-xs text-stone-500">Clients are only matched with people who do the service they pick. Select none to allow all services.</p>
            <div className="space-y-4">
              {groupByCategory(services.data.filter((s) => s.isActive)).map((g) => {
                const ids = g.items.map((s) => s.id);
                const allOn = ids.every((id) => serviceIds.includes(id));
                return (
                  <div key={g.name}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-sm font-medium text-ink">{g.name}</p>
                      <button type="button" onClick={() => setServiceIds((cur) => (allOn ? cur.filter((id) => !ids.includes(id)) : [...new Set([...cur, ...ids])]))} className="text-xs text-gold-700 underline">{allOn ? "Clear" : `Select all ${g.name.toLowerCase()}`}</button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {g.items.map((s) => (
                        <label key={s.id} className={cx("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm", serviceIds.includes(s.id) ? "border-gold-400 bg-gold-50" : "border-line")}>
                          <input type="checkbox" className="size-4 accent-gold-500" checked={serviceIds.includes(s.id)} onChange={() => toggleService(s.id)} />
                          {s.name}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {serviceIds.length === 0 && <p className="mt-2 text-xs text-stone-500">Currently: all services.</p>}
          </div>
        )}

        {f.isBookable && (
          <div>
            <h3 className="mb-2 font-sans text-sm font-semibold text-stone-700">Weekly hours</h3>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {DAYS.map((d) => {
                const h = hours[String(d.n)];
                return (
                  <li key={d.n} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <label className="flex w-20 items-center gap-2 text-sm font-medium">
                      <input type="checkbox" className="size-4 accent-gold-500" checked={Boolean(h)} onChange={(e) => setDay(d.n, e.target.checked)} /> {d.label}
                    </label>
                    {h ? (
                      <span className="flex items-center gap-2 text-sm">
                        <input aria-label={`${d.label} start`} type="time" value={h.start} onChange={(e) => setTime(d.n, "start", e.target.value)} className="h-9 rounded-lg border border-line px-2" />
                        to
                        <input aria-label={`${d.label} end`} type="time" value={h.end} onChange={(e) => setTime(d.n, "end", e.target.value)} className="h-9 rounded-lg border border-line px-2" />
                        <span className="hidden text-xs text-stone-400 sm:inline">{fmtClock12(h.start)} – {fmtClock12(h.end)}</span>
                      </span>
                    ) : <span className="text-sm text-stone-400">Day off</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {access.staffPay && <div>
          <h3 className="mb-2 font-sans text-sm font-semibold text-stone-700">Pay</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Paid by" value={f.payType} onChange={(e) => setF({ ...f, payType: e.target.value as typeof f.payType })}>
              <option value="SALARY_ONLY">Salary</option>
              <option value="COMMISSION_ONLY">Commission</option>
              <option value="BOTH">Salary + commission</option>
            </Select>
            <Input label="Monthly salary (KES)" type="number" min={0} disabled={f.payType === "COMMISSION_ONLY"} value={f.monthlySalary} onChange={(e) => setF({ ...f, monthlySalary: e.target.value })} />
            <Input label="Commission (%)" type="number" min={0} max={100} step={0.5} disabled={f.payType === "SALARY_ONLY"} value={f.commissionPct} onChange={(e) => setF({ ...f, commissionPct: e.target.value })} />
          </div>
        </div>}

        {member && !isSelf && (
          <Button type="button" variant="ghost" icon={<KeyRound className="size-4" />} loading={reset.isPending} onClick={() => reset.mutate()}>Reset password</Button>
        )}
      </form>
    </Modal>
  );
}
