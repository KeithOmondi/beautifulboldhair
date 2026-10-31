import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Smartphone, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { api, errorMessage } from "../../lib/api";
import { money } from "../../lib/format";
import { Button, ErrorNote, Input, Modal, Spinner } from "../../components/ui";

interface Target { id: string; clientName: string; phone: string; balance: number }
interface RequestStatus { id: string; status: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "CONFLICT"; amount: number; phone: string }

/**
 * Sends an M-Pesa prompt to the client's phone for what they still owe, then waits for their answer.
 * The payment itself is recorded by the server when M-Pesa confirms, not by this screen.
 */
export function RequestPaymentDialog({ booking, onClose }: { booking: Target; onClose: () => void }) {
  const qc = useQueryClient();
  const [phone, setPhone] = useState(booking.phone);
  const [amount, setAmount] = useState(String(booking.balance));
  const [requestId, setRequestId] = useState<string | null>(null);

  const amountNum = Math.round(Number(amount) || 0);
  const amountOk = amountNum >= 1 && amountNum <= booking.balance;

  const send = useMutation({
    mutationFn: async () => (await api.post<{ id: string }>(`/bookings/${booking.id}/request-payment`, { phone: phone.trim(), amount: amountNum })).data,
    onSuccess: (d) => setRequestId(d.id),
  });

  const status = useQuery({
    queryKey: ["payment-request", requestId],
    enabled: Boolean(requestId),
    queryFn: async () => (await api.get<RequestStatus>(`/bookings/payment-requests/${requestId}`)).data,
    refetchInterval: (q) => (q.state.data?.status === "PENDING" || !q.state.data ? 3000 : false),
  });

  const state = status.data?.status;
  useEffect(() => {
    if (state === "PAID") {
      toast.success("Payment received");
      for (const key of ["bookings", "booking", "payments", "dashboard", "ledger", "owing"]) void qc.invalidateQueries({ queryKey: [key] });
    }
  }, [state, qc]);

  const close = () => onClose();

  return (
    <Modal open onClose={close} title="Ask client to pay">
      {!requestId ? (
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (amountOk) send.mutate(); }} className="space-y-4">
          {send.isError && <ErrorNote>{errorMessage(send.error)}</ErrorNote>}
          <p className="text-sm text-stone-600"><strong>{booking.clientName}</strong> still owes <strong>{money(booking.balance)}</strong>. We'll send an M-Pesa prompt to their phone and they enter their PIN to pay.</p>
          <Input label="M-Pesa phone number" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} hint="Change it if someone else is paying for them." />
          <Input label="Amount (KES)" type="number" min={1} max={booking.balance} required value={amount} onChange={(e) => setAmount(e.target.value)} error={amount && !amountOk ? `Enter between 1 and ${booking.balance}` : undefined} hint="Lower it for a part payment." />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" variant="gold" icon={<Smartphone className="size-4" />} disabled={!amountOk || !phone.trim()} loading={send.isPending}>Send request for {amountOk ? money(amountNum) : "…"}</Button>
          </div>
        </form>
      ) : state === "PAID" ? (
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto size-12 text-emerald-600" aria-hidden />
          <p className="font-semibold text-ink">{money(status.data!.amount)} received</p>
          <p className="text-sm text-stone-600">The payment is recorded on the booking and the client has an SMS receipt.</p>
          <Button variant="gold" onClick={close}>Done</Button>
        </div>
      ) : state === "FAILED" || state === "EXPIRED" || state === "CONFLICT" ? (
        <div className="space-y-4 text-center">
          <XCircle className="mx-auto size-12 text-red-600" aria-hidden />
          <p className="font-semibold text-ink">{state === "EXPIRED" ? "No response yet" : state === "CONFLICT" ? "Paid, but needs checking" : "The payment was not completed"}</p>
          <p className="text-sm text-stone-600">
            {state === "EXPIRED" ? "The client didn't answer the prompt. If they pay late it will still be recorded automatically. You can send it again, or take cash." : state === "CONFLICT" ? "The money arrived but could not be applied to this booking. Open Money → Needs matching to sort it out." : "The client cancelled, had too little money, or entered the wrong PIN. You can try again or take cash."}
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={close}>Close</Button>
            {state !== "CONFLICT" && <Button variant="gold" onClick={() => { setRequestId(null); send.reset(); }}>Try again</Button>}
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-center">
          <Spinner label="Waiting for the client" />
          <p className="font-semibold text-ink">Prompt sent to {status.data?.phone ?? phone}</p>
          <p className="text-sm text-stone-600">Ask {booking.clientName} to check their phone and enter their M-Pesa PIN. This screen updates by itself.</p>
          <Button variant="outline" onClick={close}>Close (it is still recorded when they pay)</Button>
        </div>
      )}
    </Modal>
  );
}
