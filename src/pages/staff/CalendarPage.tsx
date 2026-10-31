import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarX2, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../lib/api";
import { addDays, fmtDateLong, fmtTime, minutesOfDay, todayStr } from "../../lib/format";
import { useStaffList } from "../../lib/queries";
import type { Booking } from "../../lib/types";
import { Button, Empty, Spinner, cx } from "../../components/ui";
import { BookingDetails, NewBookingDialog } from "./BookingDialogs";

const PX_PER_MIN = 1.15;
const DEFAULT_START = 8 * 60;
const DEFAULT_END = 20 * 60;

const blockStyle: Record<string, string> = {
  CONFIRMED: "border-sky-300 bg-sky-50 text-sky-900",
  PENDING: "border-amber-300 bg-amber-50 text-amber-900",
  COMPLETED: "border-emerald-300 bg-emerald-50 text-emerald-900",
  NO_SHOW: "border-red-300 bg-red-50 text-red-800",
  CANCELLED: "border-stone-200 bg-stone-100 text-stone-400 line-through",
};

export default function CalendarPage() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayStr());
  const [showCancelled, setShowCancelled] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ staffId?: string; time?: string } | null>(null);

  const canEdit = user?.role !== "WORKER";
  const staff = useStaffList();
  const bookings = useQuery({
    queryKey: ["bookings", date],
    queryFn: async () => (await api.get<Booking[]>("/bookings", { params: { date } })).data,
    refetchInterval: 60_000,
  });

  const columns = useMemo(() => {
    const all = (staff.data ?? []).filter((s) => s.isActive && s.isBookable);
    return user?.role === "WORKER" ? all.filter((s) => s.id === user.id) : all;
  }, [staff.data, user]);

  const visible = useMemo(() => (bookings.data ?? []).filter((b) => showCancelled || (b.status !== "CANCELLED")), [bookings.data, showCancelled]);

  const { startMin, endMin } = useMemo(() => {
    let lo = DEFAULT_START;
    let hi = DEFAULT_END;
    for (const b of visible) {
      lo = Math.min(lo, Math.floor(minutesOfDay(b.startAt) / 60) * 60);
      hi = Math.max(hi, Math.ceil(minutesOfDay(b.endAt) / 60) * 60);
    }
    return { startMin: lo, endMin: Math.min(hi, 24 * 60) };
  }, [visible]);

  const hours = Array.from({ length: (endMin - startMin) / 60 }, (_, i) => startMin / 60 + i);
  const height = (endMin - startMin) * PX_PER_MIN;
  const isToday = date === todayStr();
  const nowMin = minutesOfDay(new Date());
  const activeCount = visible.filter((b) => b.status !== "CANCELLED").length;

  const onGridClick = (staffId: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (!canEdit) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = startMin + Math.floor((e.clientY - rect.top) / PX_PER_MIN / 15) * 15;
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    setCreating({ staffId, time: `${hh}:${mm}` });
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">{user?.role === "WORKER" ? "My schedule" : "Calendar"}</h1>
          <p className="mt-1 text-sm text-stone-500">{fmtDateLong(date)} · {activeCount} appointment{activeCount === 1 ? "" : "s"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-line bg-white">
            <button aria-label="Previous day" onClick={() => setDate(addDays(date, -1))} className="p-2.5 hover:bg-stone-50"><ChevronLeft className="size-4" /></button>
            <input type="date" aria-label="Date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-10 border-x border-line bg-transparent px-2 text-sm" />
            <button aria-label="Next day" onClick={() => setDate(addDays(date, 1))} className="p-2.5 hover:bg-stone-50"><ChevronRight className="size-4" /></button>
          </div>
          <Button variant="outline" onClick={() => setDate(todayStr())} disabled={isToday}>Today</Button>
          {canEdit && <Button variant="gold" icon={<Plus className="size-4" />} onClick={() => setCreating({})}>New booking</Button>}
        </div>
      </div>

      <label className="mb-3 flex w-fit items-center gap-2 text-sm text-stone-600">
        <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} className="size-4 accent-gold-500" />
        Show cancelled
      </label>

      {bookings.isLoading || staff.isLoading ? (
        <Spinner />
      ) : columns.length === 0 ? (
        <Empty icon={<CalendarX2 className="size-6" />} title="No stylists to show" hint="Add a team member with “Takes online bookings” turned on." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
          <div className="flex min-w-fit">
            {/* time gutter */}
            <div className="sticky left-0 z-20 w-14 shrink-0 border-r border-line bg-white">
              <div className="h-11 border-b border-line" />
              <div className="relative" style={{ height }}>
                {hours.map((h) => (
                  <div key={h} className="absolute right-2 -translate-y-2 text-xs text-stone-400" style={{ top: (h * 60 - startMin) * PX_PER_MIN }}>
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
            </div>

            {columns.map((s) => (
              <div key={s.id} className="min-w-[170px] flex-1 border-r border-line last:border-r-0">
                <div className="flex h-11 items-center justify-center border-b border-line bg-cream px-2 text-sm font-medium text-ink">
                  <span className="truncate">{s.name}</span>
                </div>
                <div className={cx("relative", canEdit && "cursor-cell")} style={{ height }} onClick={(e) => e.target === e.currentTarget && onGridClick(s.id, e)}>
                  {hours.map((h) => (
                    <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-stone-100" style={{ top: (h * 60 - startMin) * PX_PER_MIN }} />
                  ))}
                  {isToday && nowMin >= startMin && nowMin <= endMin && (
                    <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-400" style={{ top: (nowMin - startMin) * PX_PER_MIN }} />
                  )}
                  {visible
                    .filter((b) => b.staff.id === s.id)
                    .map((b) => {
                      const top = (minutesOfDay(b.startAt) - startMin) * PX_PER_MIN;
                      const h = Math.max(((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60000) * PX_PER_MIN, 28);
                      return (
                        <button
                          key={b.id}
                          onClick={() => setSelectedId(b.id)}
                          className={cx("absolute inset-x-1 overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left text-xs shadow-sm transition hover:shadow-md", blockStyle[b.status])}
                          style={{ top, height: h - 2 }}
                        >
                          <span className="block truncate font-semibold">{fmtTime(b.startAt)} · {b.client.name}</span>
                          <span className="block truncate opacity-80">{b.service.name}</span>
                          {b.status === "CONFIRMED" && b.balance > 0 && h > 60 && <span className="mt-0.5 block truncate opacity-70">Balance {b.balance.toLocaleString()}</span>}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <BookingDetails bookingId={selectedId} canEdit={canEdit} onClose={() => setSelectedId(null)} />
      {canEdit && creating && <NewBookingDialog initial={creating} date={date} onClose={() => setCreating(null)} onCreated={(d) => { setDate(d); setCreating(null); }} />}
    </div>
  );
}
