import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, ShieldCheck, Star } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { fmtDateLong, toDateStr } from "../../lib/format";
import { usePageMeta } from "../../lib/track";
import { Button, Card, ErrorNote, Input, Spinner, Textarea, cx } from "../../components/ui";
import PublicShell from "./PublicShell";

interface ReviewInfo {
  salonName: string;
  clientName: string;
  serviceName: string;
  date: string;
  canReview: boolean;
  expired: boolean;
  alreadyReviewed: boolean;
  maskedPhone: string;
}

const WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

export default function ReviewPage() {
  usePageMeta("How was your visit?");
  const { token } = useParams();
  const q = useQuery({ queryKey: ["review", token], retry: false, queryFn: async () => (await api.get<ReviewInfo>(`/public/review/${token}`)).data });
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // Proof that the person holds the phone on the booking. Kept in memory only, so a shared link never carries it.
  const [key, setKey] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const sendCode = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await api.post<{ sentTo: string }>(`/public/review/${token}/send-code`);
      setSentTo(res.data.sentTo);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.post<{ key: string }>(`/public/review/${token}/verify`, { code });
      setKey(res.data.key);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post(`/public/review/${token}`, { rating, key, ...(comment.trim() ? { comment: comment.trim() } : {}) });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading) return <PublicShell><Spinner /></PublicShell>;
  if (q.isError || !q.data) {
    return <PublicShell><Card className="text-center"><h1 className="text-xl font-semibold text-ink">Link not found</h1><p className="mt-2 text-sm text-stone-500">This review link doesn't look right. Please check your SMS.</p></Card></PublicShell>;
  }
  const d = q.data;

  if (done || d.alreadyReviewed) {
    return (
      <PublicShell>
        <Card className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check className="size-7" aria-hidden /></div>
          <h1 className="text-2xl font-semibold text-ink">Thank you!</h1>
          <p className="mt-2 text-sm text-stone-600">{rating > 0 && rating <= 2 ? "We're sorry your visit wasn't great. A member of our team will reach out to put things right." : "Your feedback helps us look after every client better."}</p>
          <Link to="/" className="mt-6 inline-block text-sm text-gold-700 underline">Back to home</Link>
        </Card>
      </PublicShell>
    );
  }

  if (d.expired) {
    return <PublicShell><Card className="text-center"><h1 className="text-xl font-semibold text-ink">This link has expired</h1><p className="mt-2 text-sm text-stone-500">Review links work for 30 days after your visit.</p></Card></PublicShell>;
  }

  if (!d.canReview) {
    return <PublicShell><Card className="text-center"><h1 className="text-xl font-semibold text-ink">Not ready yet</h1><p className="mt-2 text-sm text-stone-500">You can leave a review once your appointment is complete.</p></Card></PublicShell>;
  }

  if (!key) {
    return (
      <PublicShell>
        <Card>
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-gold-50 text-gold-600"><ShieldCheck className="size-6" aria-hidden /></div>
          <h1 className="text-2xl font-semibold text-ink">Confirm it's you</h1>
          <p className="mt-2 text-sm text-stone-600">So that every review comes from a real client, we'll text a 6-digit code to the number you booked with ({d.maskedPhone}). Only the person holding that phone can leave this review.</p>
          {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
          {!sentTo ? (
            <Button className="mt-5 w-full" size="lg" variant="gold" loading={busy} onClick={() => void sendCode()}>Text me the code</Button>
          ) : (
            <form onSubmit={verify} className="mt-5 space-y-4">
              <Input label={`Code sent to ${sentTo}`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              <Button type="submit" className="w-full" size="lg" variant="gold" disabled={code.length !== 6} loading={busy}>Confirm</Button>
              <button type="button" onClick={() => void sendCode()} className="block w-full text-center text-sm text-stone-500 underline">Send a new code</button>
            </form>
          )}
        </Card>
      </PublicShell>
    );
  }

  return (
    <PublicShell salonName={d.salonName}>
      <h1 className="mb-1 text-2xl font-semibold text-ink">How was your visit, {d.clientName}?</h1>
      <p className="mb-6 text-sm text-stone-500">{d.serviceName} · {fmtDateLong(toDateStr(d.date))}</p>
      <form onSubmit={submit} className="space-y-5">
        {error && <ErrorNote>{error}</ErrorNote>}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-stone-700">Your rating</legend>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`} aria-pressed={rating === n} className="rounded p-1">
                <Star className={cx("size-9 transition", n <= rating ? "fill-gold-400 text-gold-400" : "text-stone-300")} />
              </button>
            ))}
            <span className="ml-2 text-sm text-stone-600">{WORDS[rating]}</span>
          </div>
        </fieldset>
        <Textarea label="Tell us more (optional)" maxLength={600} value={comment} onChange={(e) => setComment(e.target.value)} />
        <Button type="submit" size="lg" variant="gold" className="w-full" disabled={rating === 0} loading={busy}>Send review</Button>
      </form>
    </PublicShell>
  );
}
