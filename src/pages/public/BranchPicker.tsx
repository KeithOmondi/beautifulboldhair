import BrandMark from "../../components/BrandMark";
import { useState } from "react";
import { ArrowRight, ChevronDown, Clock, MapPin, Phone } from "lucide-react";
import { setPublicBranch } from "../../lib/branch";

export interface PublicBranch { slug: string; name: string; city: string | null; tagline: string | null; address: string | null; phone: string | null; hours: string | null }

/**
 * Choose a branch, remember it, and reload so every page shows that branch's services, products, team and times.
 * A half-finished booking belongs to the old branch's menu, so it is dropped.
 */
export const chooseBranch = (slug: string, to = "/") => {
  setPublicBranch(slug);
  try { localStorage.removeItem("booking-progress-v1"); } catch { /* ignore */ }
  window.location.assign(to);
};

export const branchLabel = (b: Pick<PublicBranch, "city" | "name">) => b.city ?? b.name;

/** First visit to a salon with more than one branch: a clear "which branch?" screen. */
export function BranchChooser({ branches }: { branches: PublicBranch[] }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ink px-4 py-12 text-center">
      <BrandMark className="mb-5 size-24" />
      <p className="text-xs tracking-[0.3em] text-stone-400 uppercase">Welcome</p>
      <h1 className="mt-3 max-w-xl text-3xl font-semibold text-white sm:text-5xl">Choose your branch</h1>
      <p className="mt-3 text-stone-300">Pick the one nearest to you to see its services, prices and available times.</p>
      <ul className="mt-10 grid w-full max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((b) => (
          <li key={b.slug}>
            <button type="button" onClick={() => chooseBranch(b.slug)} className="group flex h-full w-full flex-col items-start rounded-2xl border border-white/15 bg-white/5 p-6 text-left transition hover:border-gold-400 hover:bg-white/10">
              <span className="font-display text-3xl font-semibold text-gold-300">{branchLabel(b)}</span>
              {b.city && b.name !== b.city && <span className="mt-0.5 text-sm text-stone-400">{b.name}</span>}
              <span className="mt-4 space-y-1.5 text-sm text-stone-300">
                {b.address && <span className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-gold-300" aria-hidden />{b.address}</span>}
                {b.phone && <span className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0 text-gold-300" aria-hidden />{b.phone}</span>}
                {b.hours && <span className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0 text-gold-300" aria-hidden /><span className="whitespace-pre-line">{b.hours}</span></span>}
              </span>
              <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-medium text-white">Visit this branch <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden /></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Small switcher shown in headers so a visitor can hop to another branch at any time. */
/** Booking step: which branch is closest to you? */
export function BranchStep({ branches, onPick }: { branches: PublicBranch[]; onPick: (slug: string) => void }) {
  return (
    <section aria-labelledby="pick-branch">
      <h1 id="pick-branch" className="mb-1 text-2xl font-semibold text-ink">Choose your branch</h1>
      <p className="mb-5 text-sm text-stone-500">Pick the branch closest to you. Services, prices and available times are different at each one.</p>
      <ul className="space-y-3">
        {branches.map((b) => (
          <li key={b.slug}>
            <button type="button" onClick={() => onPick(b.slug)} className="group flex w-full items-start justify-between gap-4 rounded-xl border border-line bg-white p-4 text-left shadow-sm transition hover:border-gold-400 hover:shadow">
              <span className="min-w-0">
                <span className="block text-lg font-semibold text-ink">{branchLabel(b)}</span>
                {b.city && b.name !== b.city && <span className="block text-sm text-stone-500">{b.name}</span>}
                <span className="mt-2 block space-y-1 text-sm text-stone-600">
                  {b.address && <span className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-gold-700" aria-hidden />{b.address}</span>}
                  {b.phone && <span className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0 text-gold-700" aria-hidden />{b.phone}</span>}
                  {b.hours && <span className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0 text-gold-700" aria-hidden /><span className="whitespace-pre-line">{b.hours}</span></span>}
                </span>
              </span>
              <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-gold-700">Book here <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden /></span>
            </button>
            {b.address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name} ${b.address}`)}`} target="_blank" rel="noreferrer" className="mt-1 ml-1 inline-block text-xs text-stone-500 underline">See on the map</a>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BranchSwitch({ current, branches, dark = true }: { current: string; branches: PublicBranch[]; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  if (branches.length < 2) return null;
  const now = branches.find((b) => b.slug === current) ?? branches[0]!;
  return (
    <span className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label={`Branch: ${branchLabel(now)}. Change branch`} className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${dark ? "border-white/25 text-stone-100 hover:bg-white/10" : "border-line text-ink hover:bg-stone-50"}`}>
        <MapPin className="size-4" aria-hidden /><span className="hidden max-w-28 truncate sm:inline">{branchLabel(now)}</span><ChevronDown className="size-4" aria-hidden />
      </button>
      {open && (
        <span role="menu" className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-lg border border-line bg-white text-left text-sm text-ink shadow-lg">
          {branches.map((b) => (
            <button key={b.slug} role="menuitem" type="button" onClick={() => { if (b.slug === now.slug) setOpen(false); else chooseBranch(b.slug); }} className={`block w-full px-4 py-2.5 text-left hover:bg-cream ${b.slug === now.slug ? "font-semibold" : ""}`}>
              {branchLabel(b)}{b.slug === now.slug && " ✓"}
              {b.address && <span className="block truncate text-xs font-normal text-stone-500">{b.address}</span>}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
