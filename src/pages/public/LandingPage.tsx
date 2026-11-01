import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, CalendarClock, ChevronLeft, ChevronRight, Clock, AtSign, Heart, Link2, MapPin, MessageCircle, Phone, Search, Share2, ShieldCheck, ShoppingBag, Smartphone, Sparkles, Star, X } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { fmtDuration, money } from "../../lib/format";
import { usePageMeta } from "../../lib/track";
import { Spinner } from "../../components/ui";
import BrandMark from "../../components/BrandMark";
import { SiteFooter } from "./PublicShell";
import { BranchChooser, BranchSwitch, type PublicBranch } from "./BranchPicker";
import HeroCarousel, { type HeroSlideData } from "./HeroCarousel";
import { publicBranch } from "../../lib/branch";
import { OTHER, groupByCategory, orderedCategories } from "../../lib/categories";
import { useBag } from "../../lib/cart";
import ProductCard from "../shop/ProductCard";
import { img, useShopProducts } from "../shop/shopApi";

interface Landing {
  branch: string;
  branches: PublicBranch[];
  salon: { name: string; tagline: string | null; about: string | null; phone: string | null; address: string | null; instagram: string | null; whatsapp: string | null; hoursText: string | null };
  services: Array<{ id: string; name: string; description: string | null; durationMin: number; price: number; wasPrice: number | null; category: string | null; image: string | null }>;
  gallery: Array<{ id: string; caption: string | null; likes: number; thumb: string; full: string }>;
  reviews: Array<{ id: string; rating: number; comment: string; name: string; date: string }>;
  rating: { average: number; count: number; spread: number[] } | null;
  announcement: string | null;
  hero: HeroSlideData[];
  cancelWindowHours: number;
  depositRequired: boolean;
  popularServiceIds: string[];
}

const digits = (s: string) => s.replace(/[^\d]/g, "");
const whatsappHref = (n: string) => `https://wa.me/${digits(n).replace(/^0/, "254")}`;

/* What this browser has already liked, so a visitor can't pile likes onto one photo. */
const LIKES_KEY = "salon.likedPhotos";
const readLiked = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(LIKES_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
};
const writeLiked = (s: Set<string>) => {
  try {
    localStorage.setItem(LIKES_KEY, JSON.stringify([...s]));
  } catch {
    /* private mode: the like still counts for this visit */
  }
};

/** Opens the phone's share sheet when there is one, otherwise offers WhatsApp and copy-link. */
function ShareMenu({ title, text, url, label = "Share", className = "" }: { title: string; text: string; url: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy. Please copy the address from your browser.");
    }
    setOpen(false);
  };
  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
      } catch {
        /* the visitor closed the share sheet */
      }
      return;
    }
    setOpen((o) => !o);
  };
  return (
    <span className={`relative ${className || "inline-block"}`}>
      <button type="button" onClick={() => void share()} aria-haspopup="menu" aria-expanded={open} className="inline-flex h-10 items-center gap-2 rounded-lg border border-current/30 px-4 text-sm font-medium hover:bg-white/10">
        <Share2 className="size-4" aria-hidden /> {label}
      </button>
      {open && (
        <span role="menu" className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-lg border border-line bg-white text-left text-sm text-ink shadow-lg">
          <a role="menuitem" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 hover:bg-cream"><MessageCircle className="size-4" aria-hidden /> WhatsApp</a>
          <button role="menuitem" type="button" onClick={() => void copy()} className="flex w-full items-center gap-2 px-4 py-2.5 hover:bg-cream"><Link2 className="size-4" aria-hidden /> Copy link</button>
        </span>
      )}
    </span>
  );
}

export default function LandingPage() {
  const [find, setFind] = useState("");
  const [cat, setCat] = useState("");
  const bag = useBag();
  const shop = useShopProducts({ limit: 8 });
  const featured = useShopProducts({ featured: true, limit: 4 });
  const offers = useShopProducts({ sale: true, limit: 4 });
  const hasShop = (shop.data?.total ?? 0) > 0;
  const q = useQuery({ queryKey: ["landing"], queryFn: async () => (await api.get<Landing>("/public/landing")).data, staleTime: 60_000 });
  const d = q.data;
  usePageMeta(d ? `${d.salon.name} | Book online` : "Book an appointment", d ? (d.salon.tagline ?? `Book your appointment at ${d.salon.name} online. Instant confirmation.`) : undefined);

  if (q.isLoading) return <Spinner />;
  if (q.isError || !d) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold text-ink">We'll be right back</h1>
        <p className="mt-2 text-sm text-stone-600">The website is taking a short break. Please try again in a minute.</p>
        <button onClick={() => void q.refetch()} className="mt-5 h-10 rounded-lg bg-ink px-5 text-sm font-medium text-white">Try again</button>
      </div>
    );
  }

  const { salon } = d;
  // More than one side and the visitor hasn't picked one yet: ask first.
  if (d.branches.length > 1 && !publicBranch()) return <BranchChooser branches={d.branches} />;
  const hero3 = d.gallery.slice(0, 3);
  const categories = orderedCategories(d.services);
  const shownServices = [...d.services]
    .filter((x) => !cat || (x.category ?? OTHER) === cat)
    .filter((x) => !find.trim() || `${x.name} ${x.description ?? ""}`.toLowerCase().includes(find.trim().toLowerCase()))
    .sort((a, b) => Number(d.popularServiceIds.includes(b.id)) - Number(d.popularServiceIds.includes(a.id)));
  const groups = groupByCategory(shownServices);

  const mapHref = salon.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${salon.name} ${salon.address}`)}` : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: salon.name,
    ...(salon.address ? { address: salon.address } : {}),
    ...(salon.phone ? { telephone: salon.phone } : {}),
    url: window.location.origin,
    ...(d.rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: d.rating.average, reviewCount: d.rating.count } } : {}),
  };

  return (
    <div className="bg-cream">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {d.announcement && (
        <div className="bg-gold-400 px-4 py-2 text-center text-sm font-medium text-ink">
          <Sparkles className="mr-1.5 inline size-4 align-text-bottom" aria-hidden />{d.announcement}
        </div>
      )}

      {/* Navigation */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <a href="#top" title={salon.name} className="flex min-w-0 items-center gap-2 font-display text-lg font-semibold text-gold-300 sm:text-xl"><BrandMark className="size-9" /><span className="sr-only truncate sm:not-sr-only">{salon.name}</span></a>
          <nav aria-label="Sections" className="hidden items-center gap-6 text-sm text-stone-300 md:flex">
            {hasShop && <a href="#shop" className="hover:text-white">Shop</a>}
            {d.gallery.length > 0 && <a href="#work" className="hover:text-white">Our work</a>}
            <a href="#services" className="hover:text-white">Services</a>
            <a href="#reviews" className="hover:text-white">Reviews</a>
            <a href="#visit" className="hover:text-white">Visit us</a>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <BranchSwitch current={d.branch} branches={d.branches} />
            <ShareMenu title={salon.name} text={`Have a look at ${salon.name}`} url={window.location.origin} className="hidden text-stone-200 lg:inline-block" />
            {hasShop && (
              <Link to="/bag" aria-label={`Your bag, ${bag.count} item${bag.count === 1 ? "" : "s"}`} className="relative rounded-lg p-2 text-stone-200 hover:bg-white/10">
                <ShoppingBag className="size-5" aria-hidden />
                {bag.count > 0 && <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-gold-400 px-1 text-[10px] font-bold text-ink">{bag.count}</span>}
              </Link>
            )}
            <Link to="/book" className="inline-flex h-10 items-center rounded-lg bg-gold-400 px-3 text-sm font-semibold whitespace-nowrap text-ink hover:bg-gold-300 sm:px-5">Book now</Link>
          </div>
        </div>
      </header>

      {/* Hero: the owner's banners when there are any, otherwise the built-in welcome */}
      {d.hero.length > 0 && <div id="top"><HeroCarousel slides={d.hero} /></div>}
      {d.hero.length === 0 && <section id="top" className="bg-ink px-4 pt-14 pb-16 sm:pt-20 sm:pb-24">
        <div className={`mx-auto grid max-w-6xl items-center gap-10 ${hero3.length > 0 ? "lg:grid-cols-2" : "text-center"}`}>
          <div className={hero3.length > 0 ? "text-center lg:text-left" : "mx-auto max-w-3xl"}>
            {d.rating && (
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold-400/40 px-4 py-1.5 text-sm text-gold-200">
                <Star className="size-4 fill-gold-300 text-gold-300" aria-hidden /> {d.rating.average} from {d.rating.count} verified reviews
              </p>
            )}
            <h1 className="text-4xl leading-tight font-semibold text-white sm:text-5xl lg:text-6xl">{salon.tagline ?? "Beautiful, bold and made for you"}</h1>
            <p className="mt-5 max-w-xl text-base text-stone-300 sm:text-lg lg:mx-0 mx-auto">Choose your service, pick a time that suits you, and get an instant confirmation. It takes about a minute.</p>
            <div className={`mt-8 flex flex-col items-center gap-3 sm:flex-row ${hero3.length > 0 ? "lg:justify-start justify-center" : "justify-center"}`}>
              <Link to="/book" className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-gold-400 px-8 text-base font-semibold text-ink hover:bg-gold-300 sm:w-auto">Book your appointment</Link>
              {hasShop ? <Link to="/shop" className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-white/25 px-8 text-base font-medium text-white hover:bg-white/10 sm:w-auto">Shop wigs & hair</Link> : <a href="#services" className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-white/25 px-8 text-base font-medium text-white hover:bg-white/10 sm:w-auto">See services & prices</a>}
            </div>
            {d.services.length > 0 && <p className="mt-5 text-sm text-stone-400">Services from {money(Math.min(...d.services.map((x) => x.price)))}</p>}
          </div>
          {hero3.length > 0 && (
            <div className="grid grid-cols-3 grid-rows-2 gap-3" aria-hidden>
              <img src={hero3[0]!.full} alt="" className="col-span-2 row-span-2 aspect-square h-full w-full rounded-2xl object-cover" loading="eager" />
              {hero3[1] && <img src={hero3[1].thumb} alt="" className="aspect-square w-full rounded-2xl object-cover" loading="lazy" />}
              {hero3[2] && <img src={hero3[2].thumb} alt="" className="aspect-square w-full rounded-2xl object-cover" loading="lazy" />}
            </div>
          )}
        </div>
      </section>}

      {/* Why book with us */}
      <section aria-label="Why book with us" className="border-b border-line bg-white">
        <ul className="mx-auto grid max-w-6xl gap-5 px-4 py-8 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            [Smartphone, "Book in a minute", "Pick a service and a real, open time. No calls needed."],
            [ShieldCheck, d.depositRequired ? "Secure M-Pesa payment" : "Pay at the salon", d.depositRequired ? "A small deposit secures your slot, the rest is settled after." : "No payment needed to book online."],
            [CalendarClock, "Easy changes", `Move or cancel free up to ${d.cancelWindowHours} hours before, from your SMS link.`],
            [BadgeCheck, "Real reviews only", "Every review is confirmed by an SMS code to a client who visited."],
          ].map(([Icon, title, text]) => {
            const I = Icon as typeof Smartphone;
            return (
              <li key={title as string} className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-700"><I className="size-5" aria-hidden /></span>
                <span><span className="block font-semibold text-ink">{title as string}</span><span className="text-stone-500">{text as string}</span></span>
              </li>
            );
          })}
        </ul>
      </section>

      {hasShop && shop.data && (
        <section id="shop" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16 sm:py-20">
          <SectionTitle title="Shop wigs & hair" subtitle="Order online and we deliver, or collect from the salon." />
          {shop.data.categories.length > 0 && (
            <ul className="mb-12 flex gap-5 overflow-x-auto pb-2 sm:justify-center" aria-label="Shop by category">
              {shop.data.categories.map((c) => {
                const cover = shop.data!.products.find((p) => p.category === c.name)?.images[0];
                return (
                  <li key={c.name} className="shrink-0 text-center">
                    <Link to={`/shop?category=${encodeURIComponent(c.name)}`} className="group block w-24 sm:w-28">
                      <span className="block size-24 overflow-hidden rounded-full border border-line bg-stone-100 sm:size-28">{cover ? <img src={img(cover, 240)} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-105" /> : <ShoppingBag className="m-auto mt-8 size-8 text-stone-300" aria-hidden />}</span>
                      <span className="mt-2 block text-sm font-medium text-ink group-hover:underline">{c.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {featured.data && featured.data.products.length > 0 && (
            <div className="mb-12">
              <div className="mb-4 flex items-end justify-between"><h3 className="font-display text-2xl font-semibold text-ink">Featured</h3><Link to="/shop" className="text-sm font-medium text-gold-700 underline">See all products</Link></div>
              <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">{featured.data.products.map((p) => <ProductCard key={p.id} p={p} />)}</ul>
            </div>
          )}

          {offers.data && offers.data.products.length > 0 && (
            <div className="mb-12 rounded-2xl bg-gold-50 p-4 sm:p-6">
              <div className="mb-4 flex items-end justify-between"><h3 className="font-display text-2xl font-semibold text-ink">On offer</h3><Link to="/shop?sale=1" className="text-sm font-medium text-gold-700 underline">See all offers</Link></div>
              <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">{offers.data.products.map((p) => <ProductCard key={p.id} p={p} />)}</ul>
            </div>
          )}

          <div>
            <div className="mb-4 flex items-end justify-between"><h3 className="font-display text-2xl font-semibold text-ink">New arrivals</h3><Link to="/shop" className="text-sm font-medium text-gold-700 underline">Shop all</Link></div>
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">{shop.data.products.slice(0, 8).map((p) => <ProductCard key={p.id} p={p} />)}</ul>
          </div>
          <div className="mt-8 text-center"><Link to="/shop" className="inline-flex h-12 items-center rounded-lg bg-ink px-8 text-sm font-semibold text-white hover:bg-stone-800">Browse the whole shop</Link></div>
        </section>
      )}

      {d.gallery.length > 0 && <Gallery images={d.gallery} />}

      {/* Services */}
      <section id="services" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16 sm:py-20">
        <SectionTitle title="Services & prices" subtitle="Clear prices, no surprises. Pick one to start booking." />
        {d.services.length === 0 ? (
          <p className="text-center text-sm text-stone-500">Our services will be listed here soon.</p>
        ) : (
          <>
          {categories.length > 1 && (
            <div className="mb-6 flex flex-wrap justify-center gap-2" role="group" aria-label="Service categories">
              {["", ...categories].map((c) => (
                <button key={c || "all"} type="button" onClick={() => setCat(c)} aria-pressed={cat === c} className={`rounded-full border px-4 py-1.5 text-sm ${cat === c ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-700 hover:border-gold-400"}`}>{c || "All"}</button>
              ))}
            </div>
          )}
          {d.services.length > 6 && (
            <div className="relative mx-auto mb-6 max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
              <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search services" aria-label="Search services" className="h-11 w-full rounded-lg border border-line bg-white pr-3 pl-9 text-sm" />
            </div>
          )}
          {groups.length === 0 ? <p className="py-8 text-center text-sm text-stone-500">No services match.</p> : groups.map((g) => (
            <div key={g.name} className="mb-10 last:mb-0">
              {(groups.length > 1 || cat) && <h3 className="mb-4 font-display text-2xl font-semibold text-ink">{g.name}</h3>}
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((s) => (
                  <li key={s.id}>
                    <Link to={`/book?service=${s.id}`} className="relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-white shadow-sm transition hover:border-gold-400 hover:shadow-md">
                      {s.wasPrice != null && <span className="absolute top-3 left-3 z-10 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">-{Math.round((1 - s.price / s.wasPrice) * 100)}%</span>}
                      {s.image && <img src={s.image} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />}
                      <span className="flex flex-1 flex-col p-5">
                      {d.popularServiceIds.includes(s.id) && <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-semibold text-gold-800"><Sparkles className="size-3" aria-hidden />Most booked</span>}
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-medium text-ink">{s.name}</span>
                        <span className="shrink-0 text-right font-semibold text-ink">{s.wasPrice != null && <span className="mr-1.5 text-xs font-normal text-stone-400 line-through">{money(s.wasPrice)}</span>}<span className={s.wasPrice != null ? "text-red-600" : ""}>{money(s.price)}</span></span>
                      </span>
                      {s.description && <span className="mt-1.5 text-sm text-stone-500">{s.description}</span>}
                      <span className="mt-auto flex items-center justify-between pt-4 text-xs text-stone-500">
                        <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{fmtDuration(s.durationMin)}</span>
                        <span className="font-medium text-gold-700">Book this →</span>
                      </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {find.trim() && <p className="mt-4 text-center text-sm text-stone-500">Can't find it? <a href="#visit" className="underline">Ask us</a>.</p>}
          </>
        )}
      </section>

      {/* How it works */}
      <section className="bg-white px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <SectionTitle title="How booking works" />
          <ol className="grid gap-8 text-center sm:grid-cols-3">
            {[
              ["1", "Choose your service", "Browse the menu and pick what you'd like."],
              ["2", "Pick a time", "See real, available times and choose one that suits you."],
              ["3", "Confirm", "Pay a small deposit with M-Pesa and get an instant SMS confirmation."],
            ].map(([n, t, text]) => (
              <li key={n}>
                <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-gold-100 font-display text-xl font-semibold text-gold-800">{n}</span>
                <h3 className="font-sans text-base font-semibold text-ink">{t}</h3>
                <p className="mt-1 text-sm text-stone-500">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Reviews reviews={d.reviews} rating={d.rating} />

      {/* About + visit */}
      <section id="visit" className="scroll-mt-16 bg-ink px-4 py-16 text-stone-300 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold text-gold-300">{salon.about ? "About us" : "Visit us"}</h2>
            {salon.about && <p className="mt-4 whitespace-pre-line leading-relaxed">{salon.about}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to="/book" className="inline-flex h-11 items-center rounded-lg bg-gold-400 px-6 text-sm font-semibold text-ink hover:bg-gold-300">Book your appointment</Link>
              <ShareMenu title={salon.name} text={`Have a look at ${salon.name}`} url={window.location.origin} label="Tell a friend" className="inline-block text-stone-200" />
            </div>
          </div>
          <ul className="space-y-4 text-sm">
            {salon.address && <li className="flex gap-3"><MapPin className="mt-0.5 size-5 shrink-0 text-gold-300" aria-hidden /><span>{salon.address}{mapHref && <> · <a href={mapHref} target="_blank" rel="noreferrer" className="text-gold-300 underline">Get directions</a></>}</span></li>}
            {salon.hoursText && <li className="flex gap-3"><Clock className="mt-0.5 size-5 shrink-0 text-gold-300" aria-hidden /><span className="whitespace-pre-line">{salon.hoursText}</span></li>}
            {salon.phone && <li className="flex gap-3"><Phone className="mt-0.5 size-5 shrink-0 text-gold-300" aria-hidden /><a href={`tel:${salon.phone.replace(/\s/g, "")}`} className="hover:text-white">{salon.phone}</a></li>}
            {salon.whatsapp && <li className="flex gap-3"><MessageCircle className="mt-0.5 size-5 shrink-0 text-gold-300" aria-hidden /><a href={whatsappHref(salon.whatsapp)} target="_blank" rel="noreferrer" className="hover:text-white">Chat on WhatsApp</a></li>}
            {salon.instagram && <li className="flex gap-3"><AtSign className="mt-0.5 size-5 shrink-0 text-gold-300" aria-hidden /><a href={`https://instagram.com/${salon.instagram}`} target="_blank" rel="noreferrer" className="hover:text-white">@{salon.instagram}</a></li>}
          </ul>
        </div>
      </section>

      <SiteFooter phone={null} address={null} />

      {salon.whatsapp && (
        <a href={whatsappHref(salon.whatsapp)} target="_blank" rel="noreferrer" aria-label="Chat with us on WhatsApp" className="fixed right-4 bottom-20 z-30 flex size-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg hover:brightness-110 md:bottom-6">
          <MessageCircle className="size-6" aria-hidden />
        </a>
      )}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 p-3 backdrop-blur md:hidden">
        <Link to="/book" className="flex h-11 items-center justify-center rounded-lg bg-gold-400 text-sm font-semibold text-ink">Book your appointment</Link>
      </div>
      <div className="h-[68px] md:hidden" aria-hidden />
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-10 text-center">
      <h2 className="text-3xl font-semibold text-ink sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-2 text-stone-500">{subtitle}</p>}
    </div>
  );
}

function Reviews({ reviews, rating }: { reviews: Landing["reviews"]; rating: Landing["rating"] }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? reviews : reviews.slice(0, 6);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-KE", { month: "short", year: "numeric", timeZone: "Africa/Nairobi" });

  return (
    <section id="reviews" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16 sm:py-20">
      <SectionTitle title="Kind words from our clients" subtitle="Real reviews from people who have visited us." />

      {rating && (
        <div className="mx-auto mb-10 flex max-w-xl flex-col items-center gap-6 rounded-xl border border-line bg-white p-6 shadow-sm sm:flex-row">
          <div className="text-center">
            <p className="font-display text-5xl font-semibold text-ink">{rating.average}</p>
            <p className="mt-1 flex justify-center gap-0.5" aria-label={`${rating.average} out of 5 stars`}>
              {Array.from({ length: 5 }, (_, i) => <Star key={i} className={`size-4 ${i < Math.round(rating.average) ? "fill-gold-400 text-gold-400" : "text-stone-300"}`} aria-hidden />)}
            </p>
            <p className="mt-1 text-xs text-stone-500">{rating.count} reviews</p>
          </div>
          <ul className="w-full flex-1 space-y-1.5" aria-label="Rating breakdown">
            {rating.spread.map((n, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-stone-600">
                <span className="w-8 shrink-0">{5 - i} star</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100"><span className="block h-full rounded-full bg-gold-400" style={{ width: `${rating.count ? (n / rating.count) * 100 : 0}%` }} /></span>
                <span className="w-6 shrink-0 text-right">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="mx-auto max-w-md text-center text-sm text-stone-500">Reviews will appear here after our first clients visit. Book now and be the first to share your experience.</p>
      ) : (
        <>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((r) => (
              <li key={r.id} className="rounded-xl border border-line bg-white p-5 shadow-sm">
                <p className="flex gap-0.5" aria-label={`${r.rating} out of 5 stars`}>
                  {Array.from({ length: r.rating }, (_, i) => <Star key={i} className="size-4 fill-gold-400 text-gold-400" aria-hidden />)}
                </p>
                <blockquote className="mt-3 text-sm text-stone-700">“{r.comment}”</blockquote>
                <p className="mt-3 flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{r.name}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-stone-500"><ShieldCheck className="size-3.5 text-gold-600" aria-hidden /> Verified visit · {fmt(r.date)}</span>
                </p>
              </li>
            ))}
          </ul>
          {reviews.length > 6 && !showAll && (
            <div className="mt-6 text-center"><button onClick={() => setShowAll(true)} className="h-10 rounded-lg border border-line bg-white px-5 text-sm font-medium text-ink hover:border-gold-400">Show more reviews</button></div>
          )}
        </>
      )}
      <p className="mt-8 text-center text-xs text-stone-500">Only clients who have completed an appointment can leave a review. We send the link by SMS after your visit.</p>
    </section>
  );
}

/** Grid shape by photo count: one big centred photo, two side by side, then a feature photo with smaller ones, then an even grid. */
function galleryGrid(n: number) {
  if (n === 1) return "mx-auto max-w-3xl";
  if (n === 2) return "mx-auto grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2";
  if (n === 3) return "grid grid-cols-2 gap-3 md:grid-cols-3 md:grid-rows-2";
  if (n === 4) return "grid grid-cols-2 gap-3 md:grid-cols-4";
  return "grid grid-cols-2 gap-3 md:grid-cols-3 lg:auto-rows-[15rem] lg:grid-cols-4";
}
function tileClass(n: number, i: number) {
  if (n === 1) return "aspect-[4/3]";
  if (n === 2) return "aspect-[4/5]";
  if (n === 3) return i === 0 ? "col-span-2 aspect-[4/3] md:col-span-2 md:row-span-2 md:aspect-auto md:min-h-[26rem]" : "aspect-square md:aspect-auto";
  if (n === 4) return "aspect-[3/4]";
  // 5+: the first photo is a big feature tile on wider screens
  return i === 0 ? "col-span-2 row-span-2 aspect-square lg:aspect-auto" : "aspect-square lg:aspect-auto";
}

function Gallery({ images }: { images: Landing["gallery"] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [liked, setLiked] = useState<Set<string>>(readLiked);
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(images.map((i) => [i.id, i.likes])));

  const toggleLike = async (id: string) => {
    const wasLiked = liked.has(id);
    const next = new Set(liked);
    if (wasLiked) next.delete(id);
    else next.add(id);
    setLiked(next);
    setCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + (wasLiked ? -1 : 1)) }));
    writeLiked(next);
    try {
      const r = await api.post<{ likes: number }>(`/public/gallery/${id}/like`, { action: wasLiked ? "unlike" : "like" });
      setCounts((c) => ({ ...c, [id]: r.data.likes }));
    } catch {
      // Put things back so the screen never shows a like the salon didn't receive.
      const back = new Set(next);
      if (wasLiked) back.add(id);
      else back.delete(id);
      setLiked(back);
      writeLiked(back);
      setCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + (wasLiked ? 1 : -1)) }));
    }
  };

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((by: number) => setOpen((i) => (i === null ? i : (i + by + images.length) % images.length)), [images.length]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, step]);

  return (
    <section id="work" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16 sm:py-20">
      <SectionTitle title="Our work" subtitle="A few of our recent favourites." />
      {/* The layout adapts to how many photos there are, so a few photos still look deliberate. */}
      <ul className={galleryGrid(images.length)}>
        {images.map((img, i) => {
          const feature = images.length === 1 || (images.length >= 3 && i === 0 && images.length !== 4);
          return (
            <li key={img.id} className={`group relative overflow-hidden rounded-2xl bg-stone-200 ${tileClass(images.length, i)}`}>
              <button onClick={() => setOpen(i)} className="block size-full" aria-label={img.caption ? `Open photo: ${img.caption}` : "Open photo"}>
                <img src={feature ? img.full : img.thumb} alt={img.caption ?? "Our work"} loading={i < 2 ? "eager" : "lazy"} decoding="async" className="size-full object-cover transition duration-500 group-hover:scale-105" />
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" aria-hidden />
              </button>
              {img.caption && <span className="pointer-events-none absolute bottom-3 left-3 max-w-[70%] truncate text-sm font-medium text-white opacity-0 transition group-hover:opacity-100">{img.caption}</span>}
              <button
                onClick={() => void toggleLike(img.id)}
                aria-pressed={liked.has(img.id)}
                aria-label={liked.has(img.id) ? "Remove your like" : "Like this photo"}
                className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur hover:bg-black/75"
              >
                <Heart className={`size-4 ${liked.has(img.id) ? "fill-red-500 text-red-500" : ""}`} aria-hidden /> {counts[img.id] ?? 0}
              </button>
            </li>
          );
        })}
      </ul>

      {open !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={close}>
          <button onClick={close} aria-label="Close" className="absolute top-4 right-4 rounded-full p-2 text-white hover:bg-white/10"><X className="size-6" /></button>
          {images.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous photo" className="absolute left-2 rounded-full p-2 text-white hover:bg-white/10 sm:left-6"><ChevronLeft className="size-8" /></button>
              <button onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next photo" className="absolute right-2 rounded-full p-2 text-white hover:bg-white/10 sm:right-6"><ChevronRight className="size-8" /></button>
            </>
          )}
          <figure className="max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <img src={images[open]!.full} alt={images[open]!.caption ?? "Our work"} className="max-h-[80dvh] rounded-lg object-contain" />
            {images[open]!.caption && <figcaption className="mt-3 text-center text-sm text-stone-300">{images[open]!.caption}</figcaption>}
            <div className="mt-3 flex items-center justify-center gap-3 text-white">
              <button
                onClick={() => void toggleLike(images[open]!.id)}
                aria-pressed={liked.has(images[open]!.id)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/30 px-4 text-sm font-medium hover:bg-white/10"
              >
                <Heart className={`size-4 ${liked.has(images[open]!.id) ? "fill-red-500 text-red-500" : ""}`} aria-hidden /> {counts[images[open]!.id] ?? 0}
              </button>
              <ShareMenu title="Our work" text={images[open]!.caption ?? "Look at this beautiful work"} url={window.location.origin} />
            </div>
          </figure>
        </div>
      )}
    </section>
  );
}
