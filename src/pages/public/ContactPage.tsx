import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { usePageMeta } from "../../lib/track";
import { Button, Card, ErrorNote, Input, Select, Textarea } from "../../components/ui";
import PublicShell from "./PublicShell";
import { usePublicInfo } from "./publicApi";

const CATEGORIES = [
  ["SERVICE", "The service I received"],
  ["STAFF", "A member of staff"],
  ["BOOKING", "My booking or appointment time"],
  ["PAYMENT", "A payment or refund"],
  ["OTHER", "Something else"],
] as const;

/** Contact / complaints form. Every message reaches the team's Feedback inbox and the owner is alerted. */
export default function ContactPage() {
  usePageMeta("Contact us or report a problem");
  const { data: info } = usePublicInfo();
  const [params] = useSearchParams();
  const manageToken = params.get("booking") ?? undefined;

  const [f, setF] = useState({ name: "", phone: "", category: "SERVICE", message: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post<{ reference: string }>("/public/complaints", { ...f, name: f.name.trim(), phone: f.phone.trim(), ...(manageToken && /^[0-9a-f]{48}$/.test(manageToken) ? { manageToken } : {}) });
      setReference(data.reference);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (reference) {
    return (
      <PublicShell>
        <Card className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check className="size-7" aria-hidden /></div>
          <h1 className="text-2xl font-semibold text-ink">Thank you, we've got it</h1>
          <p className="mt-2 text-sm text-stone-600">Someone from our team will contact you soon. Your reference is <strong>{reference}</strong>.</p>
          <Link to="/" className="mt-6 inline-block text-sm text-gold-700 underline">Back to home</Link>
        </Card>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <h1 className="mb-1 text-2xl font-semibold text-ink">Contact us</h1>
      <p className="mb-6 text-sm text-stone-600">Something not right, or a question? Tell us and we'll make it right. {info?.phone ? <>You can also call <a className="text-gold-700 underline" href={`tel:${info.phone.replace(/\s/g, "")}`}>{info.phone}</a>.</> : null}</p>

      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <Input label="Your name" required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label="Phone number" type="tel" inputMode="tel" required autoComplete="tel" placeholder="0712 345 678" hint="So we can call or text you back." value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Select label="This is about" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Textarea label="What happened?" required rows={5} minLength={10} maxLength={1000} hint="Please include the date of your visit if you can." value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
        <Button type="submit" size="lg" variant="gold" className="w-full" loading={busy}>Send message</Button>
        <p className="text-center text-xs text-stone-500">We only use your details to respond to you. See our <Link to="/privacy" className="underline">privacy policy</Link>.</p>
      </form>
    </PublicShell>
  );
}
