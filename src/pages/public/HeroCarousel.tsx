import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface HeroSlideData {
  id: string;
  kind: "DESIGNED" | "PHOTO_TEXT";
  image: string;
  mobileImage: string | null;
  eyebrow: string | null;
  headline: string | null;
  subtext: string | null;
  buttonLabel: string | null;
  linkTo: string | null;
  align: "left" | "center";
  overlay: number;
}

/** A link to a page on this site, a section of the home page, or an outside address. */
export function SmartLink({ to, className, children, label }: { to: string; className?: string; children: ReactNode; label?: string }) {
  if (to.startsWith("/")) return <Link to={to} className={className} {...(label ? { "aria-label": label } : {})}>{children}</Link>;
  if (to.startsWith("#")) return <a href={to} className={className} {...(label ? { "aria-label": label } : {})}>{children}</a>;
  return <a href={to} target="_blank" rel="noopener noreferrer" className={className} {...(label ? { "aria-label": label } : {})}>{children}</a>;
}

/** One banner. Also used for the live preview while the owner designs it. */
export function HeroSlideView({ s, priority = false }: { s: HeroSlideData; priority?: boolean }) {
  const picture = (cls: string) => (
    <picture>
      {s.mobileImage && <source media="(max-width: 639px)" srcSet={s.mobileImage} />}
      <img src={s.image} alt="" loading={priority ? "eager" : "lazy"} className={cls} />
    </picture>
  );

  if (s.kind === "DESIGNED") {
    const img = picture("block h-auto w-full");
    return s.linkTo ? <SmartLink to={s.linkTo} label={s.headline ?? "Open this offer"} className="block">{img}</SmartLink> : img;
  }

  const center = s.align === "center";
  return (
    <div className="relative flex min-h-[440px] items-center overflow-hidden bg-ink sm:min-h-[540px]">
      {picture("absolute inset-0 size-full object-cover")}
      <div className="absolute inset-0 bg-gradient-to-r from-black to-black/60" style={{ opacity: s.overlay / 100 }} aria-hidden />
      <div className={`relative mx-auto w-full max-w-6xl px-6 py-14 sm:px-10 ${center ? "text-center" : ""}`}>
        <div className={`max-w-xl ${center ? "mx-auto" : ""}`}>
          {s.eyebrow && <p className="mb-3 inline-block rounded-full border border-gold-300/60 px-3 py-1 text-xs font-medium tracking-widest text-gold-200 uppercase">{s.eyebrow}</p>}
          {s.headline && <h2 className="font-display text-4xl leading-tight font-semibold text-white sm:text-5xl lg:text-6xl">{s.headline}</h2>}
          {s.subtext && <p className="mt-4 text-base text-stone-200 sm:text-lg">{s.subtext}</p>}
          {s.buttonLabel && s.linkTo && <SmartLink to={s.linkTo} className="mt-7 inline-flex h-12 items-center rounded-lg bg-gold-400 px-8 text-base font-semibold text-ink hover:bg-gold-300">{s.buttonLabel}</SmartLink>}
        </div>
      </div>
    </div>
  );
}

/** The sliding banner area at the top of the home page. Pauses while a visitor hovers, focuses or swipes. */
export default function HeroCarousel({ slides }: { slides: HeroSlideData[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  const n = slides.length;
  const go = useCallback((to: number) => setI(((to % n) + n) % n), [n]);

  useEffect(() => {
    if (n < 2 || paused) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((cur) => (cur + 1) % n), 6500);
    return () => clearInterval(t);
  }, [n, paused]);
  useEffect(() => { if (i >= n) setI(0); }, [n, i]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured offers"
      className="relative bg-ink"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => { touch.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        const end = e.changedTouches[0]?.clientX;
        if (start == null || end == null || Math.abs(end - start) < 50) return;
        go(i + (end < start ? 1 : -1));
      }}
    >
      {/* Every slide sits in the same cell, so the area is as tall as the tallest one and slides fade into each other. */}
      <div className="grid">
        {slides.map((s, k) => (
          <div key={s.id} role="group" aria-roledescription="slide" aria-label={`${k + 1} of ${n}`} aria-hidden={k !== i} {...(k !== i ? { inert: true } : {})} className={`col-start-1 row-start-1 transition-opacity duration-700 ${k === i ? "z-10 opacity-100" : "pointer-events-none opacity-0"}`}>
            <HeroSlideView s={s} priority={k === 0} />
          </div>
        ))}
      </div>

      {n > 1 && (
        <>
          <button type="button" onClick={() => go(i - 1)} aria-label="Previous banner" className="absolute top-1/2 left-3 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-ink shadow hover:bg-white sm:flex"><ChevronLeft className="size-5" aria-hidden /></button>
          <button type="button" onClick={() => go(i + 1)} aria-label="Next banner" className="absolute top-1/2 right-3 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-ink shadow hover:bg-white sm:flex"><ChevronRight className="size-5" aria-hidden /></button>
          <div className="absolute inset-x-0 bottom-3 z-20 flex justify-center gap-2">
            {slides.map((s, k) => (
              <button key={s.id} type="button" onClick={() => go(k)} aria-label={`Show banner ${k + 1}`} aria-current={k === i} className={`h-2.5 rounded-full transition-all ${k === i ? "w-7 bg-gold-400" : "w-2.5 bg-white/70 hover:bg-white"}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
