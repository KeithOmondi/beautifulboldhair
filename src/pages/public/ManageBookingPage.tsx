import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus } from "lucide-react";
import toast from "react-hot-toast";
import { api, errorMessage } from "../../lib/api";
import { addDays, fmtClock12, fmtDateLong, fmtDateShort, fmtDay, fmtDayNum, money, toDateStr, todayStr } from "../../lib/format";
import { Badge, Button, Card, Confirm, ErrorNote, Modal, Spinner, cx, statusLabel, statusTone } from "../../components/ui";
import PublicShell from "./PublicShell";
import { SlotGrid } from "./BookingPage";
import { downloadIcs, usePublicSlots } from "./publicApi";
import type { Slot } from "../../lib/types";

interface Managed {
  salon: { name: string; phone: string | null; address: string | null };
  clientName: string;
  serviceId: string;
  serviceName: string;
  staffId: string;
  staffName: string;
  startAt: string;
  endAt: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  price: number;
  depositPaid: number;
  cancelWindowHours: number;
  isUpcoming: boolean;
  canReschedule: boolean;
  cancellationKeepsDeposit: boolean;
}

export default function ManageBookingPage() {
  const { token } = useParams();
  const qc = useQueryClient();
  const key = ["managed", token];
  const [cancelOpen, setCancelOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  const q = useQuery({ queryKey: key, queryFn: async () => (await api.get<Managed>(`/public/manage/${token}`)).data, retry: false });

  const cancel = useMutation({
    mutationFn: async () => (await api.post<Managed>(`/public/manage/${token}/cancel`)).data,
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      setCancelOpen(false);
      toast.success("Your appointment was cancelled");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <PublicShell><Spinner /></PublicShell>;
  if (q.isError || !q.data) {
    return (
      <PublicShell>
        <Card className="text-center">
          <h1 className="text-xl font-semibold text-ink">Booking not found</h1>
          <p className="mt-2 text-sm text-stone-500">This link may be incorrect. Please check your confirmation SMS or call the salon.</p>
        </Card>
      </PublicShell>
    );
  }

  const b = q.data;
  const active = b.status === "CONFIRMED" || b.status === "PENDING";

  return (
    <PublicShell salonName={b.salon.name}>
      <h1 className="mb-1 text-2xl font-semibold text-ink">Your appointment</h1>
      <p className="mb-5 text-sm text-stone-500">Hi {b.clientName.split(" ")[0]}, here are your booking details.</p>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-lg font-semibold text-ink">{b.serviceName}</p>
          <Badge tone={statusTone(b.status)}>{statusLabel(b.status)}</Badge>
        </div>
        <dl className="space-y-2.5 text-sm">
          <Row label="Date" value={fmtDateLong(toDateStr(b.startAt))} />
          <Row label="Time" value={fmtClock12(new Date(b.startAt).toLocaleTimeString("en-GB", { timeZone: "Africa/Nairobi", hour: "2-digit", minute: "2-digit", hour12: false }))} />
          <Row label="Stylist" value={b.staffName} />
          <Row label="Price" value={money(b.price)} />
          {b.depositPaid > 0 && <Row label="Deposit paid" value={money(b.depositPaid)} />}
          {b.salon.address && <Row label="Where" value={b.salon.address} />}
        </dl>
      </Card>

      {active && b.isUpcoming && (
        <div className="mt-5 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="gold" className="flex-1" disabled={!b.canReschedule} onClick={() => setMoveOpen(true)}>Change time</Button>
            <Button variant="outline" className="flex-1" icon={<CalendarPlus className="size-4" />} onClick={() => downloadIcs({ title: `${b.serviceName} at ${b.salon.name}`, startAt: b.startAt, endAt: b.endAt, location: b.salon.address })}>
              Add to calendar
            </Button>
          </div>
          {!b.canReschedule && (
            <p className="text-center text-xs text-stone-500">
              Changes are possible up to {b.cancelWindowHours} hours before.{b.salon.phone ? ` Please call ${b.salon.phone}.` : ""}
            </p>
          )}
          <button onClick={() => setCancelOpen(true)} className="block w-full py-2 text-center text-sm text-red-600 hover:underline">Cancel appointment</button>
        </div>
      )}

      {b.status === "CANCELLED" && (
        <p className="mt-5 text-center text-sm text-stone-500">
          This appointment was cancelled. <a href="/" className="text-gold-700 underline">Book a new time</a>
        </p>
      )}

      <Confirm
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this appointment?"
        danger
        confirmLabel="Yes, cancel it"
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        body={
          b.cancellationKeepsDeposit
            ? `It's within ${b.cancelWindowHours} hours of your appointment, so your ${money(b.depositPaid)} deposit is not refundable.`
            : b.depositPaid > 0
              ? `Your ${money(b.depositPaid)} deposit will be refunded by the salon.`
              : "You can book again any time."
        }
      />

      <RescheduleModal open={moveOpen} onClose={() => setMoveOpen(false)} booking={b} token={token!} onDone={(data) => { qc.setQueryData(key, data); setMoveOpen(false); toast.success("Your appointment was moved"); }} />
    </PublicShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function RescheduleModal({ open, onClose, booking, token, onDone }: { open: boolean; onClose: () => void; booking: Managed; token: string; onDone: (m: Managed) => void }) {
  const [date, setDate] = useState(todayStr());
  const [slot, setSlot] = useState<Slot | null>(null);
  const slots = usePublicSlots(booking.serviceId, booking.staffId, open ? date : undefined);
  const dates = Array.from({ length: 21 }, (_, i) => addDays(todayStr(), i));

  const move = useMutation({
    mutationFn: async () => (await api.post<Managed>(`/public/manage/${token}/reschedule`, { newStartAt: slot!.startAt })).data,
    onSuccess: onDone,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Choose a new time"
      footer={<Button variant="gold" disabled={!slot} loading={move.isPending} onClick={() => move.mutate()}>{slot ? `Move to ${fmtDateShort(date)}, ${fmtClock12(slot.startTime)}` : "Select a time"}</Button>}
    >
      {move.isError && <div className="mb-3"><ErrorNote>{errorMessage(move.error)}</ErrorNote></div>}
      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-2">
        {dates.map((d) => (
          <button key={d} onClick={() => { setDate(d); setSlot(null); }} className={cx("flex w-14 shrink-0 flex-col items-center rounded-xl border py-2", d === date ? "border-ink bg-ink text-white" : "border-line bg-white")}>
            <span className="text-xs opacity-70">{fmtDay(d)}</span>
            <span className="font-semibold">{fmtDayNum(d)}</span>
          </button>
        ))}
      </div>
      {slots.isLoading ? <Spinner /> : slots.data?.length ? <SlotGrid slots={slots.data} selected={slot?.startAt} onSelect={setSlot} /> : <p className="py-6 text-center text-sm text-stone-500">Nothing available on this day.</p>}
    </Modal>
  );
}
