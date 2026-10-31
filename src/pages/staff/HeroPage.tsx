import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Loader2, Megaphone, Palette, Plus, Trash2, Type, X } from "lucide-react";
import toast from "react-hot-toast";
import { api, errorMessage } from "../../lib/api";
import { fmtDateShort, toDateStr } from "../../lib/format";
import { uploadPhoto } from "../../lib/upload";
import { Badge, Button, Card, Empty, ErrorNote, Input, Modal, PageHeader, Select, Spinner, Toggle, cx } from "../../components/ui";
import { HeroSlideView, type HeroSlideData } from "../public/HeroCarousel";

interface Slide {
  id: string; kind: "DESIGNED" | "PHOTO_TEXT"; imageUrl: string; mobileImageUrl: string | null;
  eyebrow: string | null; headline: string | null; subtext: string | null; buttonLabel: string | null; linkTo: string | null;
  align: "left" | "center"; overlay: number; isActive: boolean; startsAt: string | null; endsAt: string | null;
}

const LINKS: Array<{ label: string; value: string }> = [
  { label: "Book an appointment", value: "/book" },
  { label: "Shop (all products)", value: "/shop" },
  { label: "Shop: products on offer", value: "/shop?sale=1" },
  { label: "Our services and prices", value: "#services" },
  { label: "Reviews", value: "#reviews" },
  { label: "Contact us", value: "/contact" },
];

const thumb = (u: string) => u.replace("/image/upload/", "/image/upload/c_fill,w_320,h_160,q_auto,f_auto/");
const asView = (s: Slide | FormState): HeroSlideData => ({
  id: "preview",
  kind: s.kind,
  image: "imageUrl" in s ? s.imageUrl : "",
  mobileImage: s.mobileImageUrl || null,
  eyebrow: s.eyebrow || null,
  headline: s.headline || null,
  subtext: s.subtext || null,
  buttonLabel: s.buttonLabel || null,
  linkTo: s.linkTo || null,
  align: s.align,
  overlay: s.overlay,
});

export default function HeroPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["hero-admin"], queryFn: async () => (await api.get<Slide[]>("/site/hero")).data });
  const [editing, setEditing] = useState<Slide | "new" | null>(null);
  const slides = q.data ?? [];

  const refresh = () => { void qc.invalidateQueries({ queryKey: ["hero-admin"] }); void qc.invalidateQueries({ queryKey: ["landing"] }); };
  const reorder = useMutation({
    mutationFn: async (ids: string[]) => (await api.put("/site/hero/order", { ids })).data,
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const move = (i: number, d: -1 | 1) => {
    const ids = slides.map((s) => s.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    reorder.mutate(ids);
  };
  const toggle = useMutation({
    mutationFn: async (s: Slide) => (await api.patch(`/site/hero/${s.id}`, payload({ ...toForm(s), isActive: !s.isActive }))).data,
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/site/hero/${id}`)).data,
    onSuccess: () => { refresh(); toast.success("Banner removed"); },
  });

  const state = (s: Slide) => {
    const today = toDateStr(new Date());
    if (!s.isActive) return { label: "Hidden", tone: "gray" as const };
    if (s.startsAt && toDateStr(s.startsAt) > today) return { label: `Starts ${fmtDateShort(toDateStr(s.startsAt))}`, tone: "amber" as const };
    if (s.endsAt && toDateStr(new Date(new Date(s.endsAt).getTime() - 1)) < today) return { label: "Ended", tone: "gray" as const };
    return { label: "Showing now", tone: "green" as const };
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title="Home page banners" subtitle="The big sliding area at the top of this branch's website. Change it whenever you have an offer, a new arrival or news." actions={<Button variant="gold" icon={<Plus className="size-4" />} onClick={() => setEditing("new")} disabled={slides.length >= 8}>Add banner</Button>} />

      {q.isLoading ? <Spinner /> : slides.length === 0 ? (
        <Card><Empty icon={<Megaphone className="size-6" />} title="No banners yet" hint="Until you add one, your home page shows the standard welcome with your headline. Add a banner to show a designed image or a photo with your own words." action={<Button variant="gold" onClick={() => setEditing("new")}>Add your first banner</Button>} /></Card>
      ) : (
        <ul className="space-y-3">
          {slides.map((s, i) => {
            const st = state(s);
            return (
              <li key={s.id}>
                <Card className="flex flex-wrap items-center gap-4">
                  <img src={thumb(s.imageUrl)} alt="" className={cx("h-20 w-40 shrink-0 rounded-lg object-cover", !s.isActive && "opacity-50")} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{s.kind === "DESIGNED" ? "Designed image" : (s.headline ?? "Photo banner")}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <span>{s.kind === "DESIGNED" ? "Image with its own writing" : "Photo with our writing"}</span>
                      {s.linkTo && <span>· opens {s.linkTo}</span>}
                      {s.endsAt && <span>· until {fmtDateShort(toDateStr(new Date(new Date(s.endsAt).getTime() - 1)))}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label="Move up" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 disabled:opacity-30"><ArrowUp className="size-4" /></button>
                    <button type="button" aria-label="Move down" disabled={i === slides.length - 1 || reorder.isPending} onClick={() => move(i, 1)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 disabled:opacity-30"><ArrowDown className="size-4" /></button>
                    <button type="button" aria-label={s.isActive ? "Hide this banner" : "Show this banner"} title={s.isActive ? "Hide" : "Show"} onClick={() => toggle.mutate(s)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100">{s.isActive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(s)}>Edit</Button>
                    <button type="button" aria-label="Remove banner" onClick={() => { if (confirm("Remove this banner?")) remove.mutate(s.id); }} className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-red-600"><Trash2 className="size-4" /></button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-sm text-stone-500">Banners slide in the order shown, one after another. Up to 8. Each branch has its own set.</p>
      {editing && <HeroDialog slide={editing === "new" ? null : editing} onDone={() => { refresh(); setEditing(null); }} onClose={() => setEditing(null)} />}
    </div>
  );
}

interface FormState {
  kind: "DESIGNED" | "PHOTO_TEXT"; imageUrl: string; mobileImageUrl: string; eyebrow: string; headline: string; subtext: string; buttonLabel: string;
  linkTo: string; align: "left" | "center"; overlay: number; isActive: boolean; startsOn: string; endsOn: string;
}
const toForm = (s: Slide | null): FormState => ({
  kind: s?.kind ?? "PHOTO_TEXT",
  imageUrl: s?.imageUrl ?? "",
  mobileImageUrl: s?.mobileImageUrl ?? "",
  eyebrow: s?.eyebrow ?? "",
  headline: s?.headline ?? "",
  subtext: s?.subtext ?? "",
  buttonLabel: s?.buttonLabel ?? "",
  linkTo: s?.linkTo ?? "",
  align: s?.align ?? "left",
  overlay: s?.overlay ?? 45,
  isActive: s?.isActive ?? true,
  startsOn: s?.startsAt ? toDateStr(s.startsAt) : "",
  endsOn: s?.endsAt ? toDateStr(new Date(new Date(s.endsAt).getTime() - 1)) : "",
});
const payload = (f: FormState) => ({
  kind: f.kind,
  imageUrl: f.imageUrl,
  mobileImageUrl: f.mobileImageUrl || null,
  eyebrow: f.eyebrow.trim() || null,
  headline: f.headline.trim() || null,
  subtext: f.subtext.trim() || null,
  buttonLabel: f.buttonLabel.trim() || null,
  linkTo: f.linkTo.trim() || null,
  align: f.align,
  overlay: f.overlay,
  isActive: f.isActive,
  startsOn: f.startsOn || null,
  endsOn: f.endsOn || null,
});

function Uploader({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadPhoto(file));
    } catch (e) {
      toast.error(e instanceof Error && !("response" in e) ? e.message : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-stone-700">{label}</p>
      {value ? (
        <div className="relative inline-block">
          <img src={thumb(value)} alt="" className="h-24 w-48 rounded-lg object-cover" />
          <button type="button" aria-label="Remove picture" onClick={() => onChange("")} className="absolute -top-1.5 -right-1.5 rounded-full bg-white p-0.5 shadow ring-1 ring-line"><X className="size-3.5" /></button>
        </div>
      ) : (
        <label className="flex h-24 w-48 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line text-xs text-stone-500 hover:border-gold-400">
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
          {busy ? "Uploading…" : "Choose a picture"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      )}
      <p className="mt-1 text-xs text-stone-500">{hint}</p>
    </div>
  );
}

function HeroDialog({ slide, onDone, onClose }: { slide: Slide | null; onDone: () => void; onClose: () => void }) {
  const [f, setF] = useState<FormState>(toForm(slide));
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((cur) => ({ ...cur, [k]: v }));
  const preset = LINKS.some((l) => l.value === f.linkTo) ? f.linkTo : f.linkTo ? "custom" : "";
  const designed = f.kind === "DESIGNED";

  const save = useMutation({
    mutationFn: async () => (slide ? (await api.patch(`/site/hero/${slide.id}`, payload(f))).data : (await api.post("/site/hero", payload(f))).data),
    onSuccess: () => { toast.success(slide ? "Banner saved" : "Banner added"); onDone(); },
  });
  const ready = Boolean(f.imageUrl) && (designed || f.headline.trim().length > 0) && (!f.buttonLabel.trim() || Boolean(f.linkTo));

  return (
    <Modal open onClose={onClose} wide title={slide ? "Edit banner" : "New banner"} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="gold" loading={save.isPending} disabled={!ready} onClick={() => save.mutate()}>Save banner</Button></>}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (ready) save.mutate(); }} className="space-y-5">
        {save.isError && <ErrorNote>{errorMessage(save.error)}</ErrorNote>}

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-stone-700">What kind of banner?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["PHOTO_TEXT", Type, "Photo with my words", "Upload a photo. We put your headline, text and button on top, so you can change the words any time."],
              ["DESIGNED", Palette, "Finished design", "Upload a banner you designed (for example in Canva) that already has its writing. We show it exactly as it is."],
            ] as const).map(([k, Icon, title, text]) => (
              <label key={k} className={cx("flex cursor-pointer gap-3 rounded-xl border p-4 text-sm", f.kind === k ? "border-gold-500 bg-gold-50" : "border-line bg-white")}>
                <input type="radio" name="kind" className="mt-1 accent-gold-500" checked={f.kind === k} onChange={() => set("kind", k)} />
                <Icon className="size-5 shrink-0 text-gold-700" aria-hidden />
                <span><span className="block font-medium text-ink">{title}</span><span className="text-stone-500">{text}</span></span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <Uploader label="Banner picture" value={f.imageUrl} onChange={(u) => set("imageUrl", u)} hint={designed ? "Best size 1920 × 800 pixels (wide). Keep the words away from the edges." : "A wide photo, at least 1600 pixels across. Faces and products near the middle work best."} />
          <Uploader label="Phone version (optional)" value={f.mobileImageUrl} onChange={(u) => set("mobileImageUrl", u)} hint={designed ? "A taller picture for phones, e.g. 900 × 1100 pixels. Without it, phones show the wide one smaller." : "A taller photo for phones. Without it, the wide one is cropped."} />
        </div>

        {!designed && (
          <div className="space-y-4">
            <Input label="Headline" required maxLength={90} value={f.headline} onChange={(e) => set("headline", e.target.value)} placeholder="e.g. Weekend offer: 20% off wig installs" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Small label above (optional)" maxLength={40} value={f.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} placeholder="e.g. This weekend only" />
              <Select label="Text position" value={f.align} onChange={(e) => set("align", e.target.value as "left" | "center")}><option value="left">Left</option><option value="center">Centre</option></Select>
            </div>
            <Input label="Text under the headline (optional)" maxLength={220} value={f.subtext} onChange={(e) => set("subtext", e.target.value)} placeholder="One short sentence" />
            <label className="block text-sm"><span className="mb-1.5 block font-medium text-stone-700">Photo shade: {f.overlay}%</span><input type="range" min={0} max={80} step={5} value={f.overlay} onChange={(e) => set("overlay", Number(e.target.value))} className="w-full accent-gold-500" /><span className="text-xs text-stone-500">Darker makes the writing easier to read on a bright photo.</span></label>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {!designed && <Input label="Button text (optional)" maxLength={30} value={f.buttonLabel} onChange={(e) => set("buttonLabel", e.target.value)} placeholder="e.g. Book now" />}
          <Select label={designed ? "Where does a click go? (optional)" : "Where does the button go?"} value={preset} onChange={(e) => set("linkTo", e.target.value === "custom" ? "https://" : e.target.value)}>
            <option value="">Nowhere</option>
            {LINKS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            <option value="custom">Another web address…</option>
          </Select>
          {preset === "custom" && <div className="sm:col-span-2"><Input label="Web address" value={f.linkTo} onChange={(e) => set("linkTo", e.target.value)} placeholder="https://" hint="Must start with https://" /></div>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Show from (optional)" type="date" value={f.startsOn} onChange={(e) => set("startsOn", e.target.value)} hint="Set it ahead of time and it appears on that morning." />
          <Input label="Show until (optional)" type="date" min={f.startsOn || undefined} value={f.endsOn} onChange={(e) => set("endsOn", e.target.value)} hint="It disappears by itself after this day." />
        </div>
        <Toggle checked={f.isActive} onChange={(v) => set("isActive", v)} label="Show this banner" hint="Off keeps it saved without showing it." />

        {f.imageUrl && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-stone-700">How it will look</p>
            <div className="overflow-hidden rounded-xl border border-line"><HeroSlideView s={asView({ ...f, imageUrl: f.imageUrl.replace("/image/upload/", "/image/upload/f_auto,q_auto,c_limit,w_1200/") })} /></div>
          </div>
        )}
      </form>
    </Modal>
  );
}
