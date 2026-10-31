import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareWarning, Phone, Star } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../auth/AuthContext";
import { api, errorMessage } from "../../lib/api";
import { fmtDateTime, telHref } from "../../lib/format";
import { Badge, Button, Card, Empty, Select, Spinner, Tabs, Textarea, cx } from "../../components/ui";

type Status = "OPEN" | "IN_PROGRESS" | "RESOLVED";
interface Complaint {
  id: string; name: string; phone: string; category: string; message: string; status: Status; resolutionNote: string | null; createdAt: string;
  booking: { startAt: string; service: { name: string } } | null;
}
interface Review {
  id: string; rating: number; comment: string | null; isPublished: boolean; verifiedAt: string | null; removedAt: string | null; removalReason: string | null; createdAt: string;
  client: { name: string }; booking: { service: { name: string }; staff: { name: string } } | null;
}

const CATEGORY: Record<string, string> = { SERVICE: "Service", STAFF: "Staff", PAYMENT: "Payment", BOOKING: "Booking", OTHER: "Other" };
const STATUS_LABEL: Record<Status, string> = { OPEN: "New", IN_PROGRESS: "In progress", RESOLVED: "Resolved" };
const STATUS_TONE = { OPEN: "red", IN_PROGRESS: "amber", RESOLVED: "green" } as const;

type Tab = "complaints" | "reviews";

export default function FeedbackPage() {
  const { user } = useAuth();
  const canSeeReviews = user?.role === "OWNER" || user?.role === "MANAGER";
  const [tab, setTab] = useState<Tab>("complaints");
  const complaints = useQuery({ queryKey: ["complaints"], queryFn: async () => (await api.get<Complaint[]>("/site/complaints")).data });
  const openCount = complaints.data?.filter((c) => c.status !== "RESOLVED").length ?? 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Feedback</h1>
        <p className="mt-1 text-sm text-stone-500">What clients tell you: fix problems quickly and show off the praise.</p>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "complaints", label: "Complaints", ...(openCount ? { badge: openCount } : {}) }, ...(canSeeReviews ? [{ id: "reviews" as const, label: "Reviews" }] : [])]} />
      {tab === "complaints" ? <ComplaintsTab items={complaints.data} loading={complaints.isLoading} /> : <ReviewsTab />}
    </div>
  );
}

function ComplaintsTab({ items, loading }: { items: Complaint[] | undefined; loading: boolean }) {
  const [filter, setFilter] = useState<"active" | "all">("active");
  if (loading) return <Spinner />;
  const shown = (items ?? []).filter((c) => filter === "all" || c.status !== "RESOLVED");

  return (
    <div>
      <div className="mb-4 flex gap-2" role="group" aria-label="Filter">
        {(["active", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={cx("rounded-full border px-4 py-1.5 text-sm", filter === f ? "border-ink bg-ink text-white" : "border-line bg-white")}>{f === "active" ? "Needs attention" : "Everything"}</button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Card><Empty icon={<MessageSquareWarning className="size-6" />} title={filter === "active" ? "Nothing needs attention" : "No complaints yet"} hint="Messages from your website's contact form, and any low review, land here." /></Card>
      ) : (
        <ul className="space-y-3">{shown.map((c) => <ComplaintCard key={c.id} c={c} />)}</ul>
      )}
    </div>
  );
}

function ComplaintCard({ c }: { c: Complaint }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>(c.status);
  const [note, setNote] = useState(c.resolutionNote ?? "");
  const dirty = status !== c.status || note.trim() !== (c.resolutionNote ?? "");

  const save = useMutation({
    mutationFn: async () => (await api.patch(`/site/complaints/${c.id}`, { status, resolutionNote: note.trim() || null })).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["complaints"] }); void qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Saved"); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <li>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium text-ink">{c.name} <span className="font-normal text-stone-500">· {CATEGORY[c.category] ?? c.category}</span></p>
            <a href={telHref(c.phone)} className="inline-flex items-center gap-1.5 text-sm text-gold-700 hover:underline"><Phone className="size-3.5" aria-hidden />{c.phone}</a>
          </div>
          <div className="text-right text-xs text-stone-500">
            <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
            <p className="mt-1">{fmtDateTime(c.createdAt)}</p>
          </div>
        </div>
        <p className="mt-3 text-sm whitespace-pre-line text-stone-800">{c.message}</p>
        {c.booking && <p className="mt-2 text-xs text-stone-500">About: {c.booking.service.name}, {fmtDateTime(c.booking.startAt)}</p>}

        <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </Select>
          <div className="sm:col-span-3"><Textarea label="What was done (private note)" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        {dirty && <div className="mt-3 flex justify-end"><Button variant="gold" size="sm" loading={save.isPending} onClick={() => save.mutate()}>Save</Button></div>}
      </Card>
    </li>
  );
}

function ReviewsTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["reviews"] }); void qc.invalidateQueries({ queryKey: ["landing"] }); };
  const reject = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => (await api.post(`/site/reviews/${id}/reject`, { reason })).data,
    onSuccess: () => { refresh(); toast.success("Review rejected"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const restore = useMutation({
    mutationFn: async (id: string) => (await api.post(`/site/reviews/${id}/restore`)).data,
    onSuccess: () => { refresh(); toast.success("Review restored"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const q = useQuery({ queryKey: ["reviews"], queryFn: async () => (await api.get<Review[]>("/site/reviews")).data });
  const toggle = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => (await api.patch(`/site/reviews/${id}`, { isPublished })).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["reviews"] }); void qc.invalidateQueries({ queryKey: ["landing"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <Spinner />;
  if (!q.data?.length) return <Card><Empty icon={<Star className="size-6" />} title="No reviews yet" hint="Clients are sent a review link by SMS a couple of hours after their appointment is marked complete." /></Card>;

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-stone-600">Choose which reviews appear on your website. Only 4 and 5 star reviews with a comment are ever shown, and only the client's first name and initial.</p>
      <ul className="space-y-3">
        {q.data.map((r) => {
          const eligible = r.rating >= 4 && Boolean(r.comment?.trim());
          return (
            <li key={r.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex gap-0.5" aria-label={`${r.rating} out of 5`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} className={cx("size-4", i < r.rating ? "fill-gold-400 text-gold-400" : "text-stone-300")} aria-hidden />)}</p>
                    <p className="mt-1 text-sm font-medium">{r.client.name} {r.removedAt ? <Badge tone="red">Rejected</Badge> : r.verifiedAt ? <Badge tone="green">Verified by SMS code</Badge> : <Badge tone="gray">Not code-verified</Badge>}</p>
                    <p className="text-xs text-stone-500">{r.booking ? `${r.booking.service.name} with ${r.booking.staff.name} · ` : ""}{fmtDateTime(r.createdAt)}</p>
                  </div>
                  {r.removedAt ? (
                    isOwner && <Button size="sm" variant="outline" loading={restore.isPending && restore.variables === r.id} onClick={() => restore.mutate(r.id)}>Restore</Button>
                  ) : (
                  <div className="flex gap-2">
                  {isOwner && <Button size="sm" variant="outline" onClick={() => { const reason = window.prompt("Why are you rejecting this review? (kept in the audit log)"); if (reason && reason.trim().length >= 3) reject.mutate({ id: r.id, reason: reason.trim() }); }}>Reject</Button>}
                  <Button size="sm" variant={r.isPublished ? "outline" : "gold"} disabled={!eligible} loading={toggle.isPending && toggle.variables?.id === r.id} onClick={() => toggle.mutate({ id: r.id, isPublished: !r.isPublished })}>
                    {r.isPublished ? "Hide from website" : "Show on website"}
                  </Button>
                  </div>
                  )}
                </div>
                {r.comment ? <p className="mt-2 text-sm text-stone-800">“{r.comment}”</p> : <p className="mt-2 text-sm text-stone-400">No comment left.</p>}
                {r.removedAt && <p className="mt-2 text-xs text-red-700">Rejected: {r.removalReason}. It no longer counts toward your rating.</p>}
                {!r.removedAt && !eligible && <p className="mt-2 text-xs text-stone-500">Not eligible for the website (needs 4+ stars and a comment).</p>}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
