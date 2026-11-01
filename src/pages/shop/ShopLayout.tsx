import { useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Clock, MapPin, MessageCircle, Phone, Search, ShoppingBag, Sparkles, Truck, ShieldCheck, Headphones, Menu, X } from "lucide-react";
import { api } from "../../lib/api";
import { useBag } from "../../lib/cart";
import { cx } from "../../components/ui";
import BrandMark from "../../components/BrandMark";
import { useShopConfig } from "./shopApi";
import { BranchSwitch, type PublicBranch } from "../public/BranchPicker";

interface Chrome { branch: string; branches: PublicBranch[]; salon: { name: string; phone: string | null; address: string | null; whatsapp: string | null; hoursText: string | null }; announcement: string | null }

const digits = (s: string) => s.replace(/[^\d]/g, "");

/** Header, footer and bag button shared by every shop page. */
export default function ShopLayout({ children }: { children: ReactNode }) {
  const { count } = useBag();
  const nav = useNavigate();
  const cfg = useShopConfig();
  const chrome = useQuery({ queryKey: ["landing"], queryFn: async () => (await api.get<Chrome>("/public/landing")).data, staleTime: 60_000 });
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const salon = chrome.data?.salon;

  const search = (e: FormEvent) => {
    e.preventDefault();
    nav(term.trim() ? `/shop?q=${encodeURIComponent(term.trim())}` : "/shop");
    setOpen(false);
  };
  const link = ({ isActive }: { isActive: boolean }) => cx("rounded-lg px-3 py-2 text-sm font-medium", isActive ? "text-gold-700" : "text-stone-700 hover:text-ink");

  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      {chrome.data?.announcement && (
        <div className="bg-gold-400 px-4 py-2 text-center text-sm font-medium text-ink"><Sparkles className="mr-1.5 inline size-4 align-text-bottom" aria-hidden />{chrome.data.announcement}</div>
      )}
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open} className="rounded-lg p-2 hover:bg-stone-100 md:hidden">{open ? <X className="size-5" /> : <Menu className="size-5" />}</button>
          <Link to="/" className="flex min-w-0 items-center gap-2 font-display text-lg font-semibold text-ink sm:text-xl"><BrandMark className="size-9" /><span className="truncate">{salon?.name ?? " "}</span></Link>
          <nav aria-label="Shop" className="ml-6 hidden items-center gap-1 md:flex">
            <NavLink to="/" end className={link}>Home</NavLink>
            <NavLink to="/shop" end className={link}>Shop</NavLink>
            <NavLink to="/book" className={link}>Book a service</NavLink>
          </nav>
          <form onSubmit={search} className="relative ml-auto hidden max-w-xs flex-1 sm:block" role="search">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search wigs and hair" aria-label="Search the shop" className="h-10 w-full rounded-full border border-line bg-cream pr-3 pl-9 text-sm" />
          </form>
          {chrome.data && <BranchSwitch current={chrome.data.branch} branches={chrome.data.branches} dark={false} />}
          <Link to="/bag" aria-label={`Your bag, ${count} item${count === 1 ? "" : "s"}`} className="relative ml-auto rounded-lg p-2 hover:bg-stone-100 sm:ml-0">
            <ShoppingBag className="size-6" aria-hidden />
            {count > 0 && <span className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-gold-500 px-1 text-xs font-bold text-ink">{count}</span>}
          </Link>
        </div>
        {open && (
          <div className="border-t border-line px-4 py-3 md:hidden">
            <form onSubmit={search} className="relative mb-2" role="search">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
              <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search wigs and hair" aria-label="Search the shop" className="h-10 w-full rounded-full border border-line bg-cream pr-3 pl-9 text-sm" />
            </form>
            <nav aria-label="Menu" className="flex flex-col">
              <NavLink to="/" end onClick={() => setOpen(false)} className={link}>Home</NavLink>
              <NavLink to="/shop" end onClick={() => setOpen(false)} className={link}>Shop</NavLink>
              <NavLink to="/book" onClick={() => setOpen(false)} className={link}>Book a service</NavLink>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <section aria-label="Our promises" className="border-t border-line bg-white">
        <ul className="mx-auto grid max-w-6xl gap-5 px-4 py-8 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            [Truck, "Delivery", cfg.data?.deliveryFee === 0 ? "Free delivery" : cfg.data?.freeOver ? `Free delivery over KES ${cfg.data.freeOver.toLocaleString("en-KE")}` : "Fast delivery to your door"],
            [ShieldCheck, "Secure payment", "Pay with M-Pesa, or on delivery or collection"],
            [CalendarCheck, "Book an install", "Get your wig fitted and styled by our team"],
            [Headphones, "Support", "Always here to help you choose"],
          ].map(([Icon, title, text]) => {
            const I = Icon as typeof Truck;
            return (
              <li key={title as string} className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-gold-300 text-gold-700"><I className="size-5" aria-hidden /></span>
                <span><span className="block font-semibold text-ink">{title as string}</span><span className="text-stone-500">{text as string}</span></span>
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="bg-ink px-4 py-10 text-sm text-stone-300">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="flex items-center gap-3 font-display text-lg font-semibold text-gold-300"><BrandMark className="size-12" />{salon?.name}</p>
            {salon?.address && <p className="mt-3 flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-gold-300" aria-hidden />{salon.address}</p>}
            {salon?.phone && <p className="mt-2 flex gap-2"><Phone className="mt-0.5 size-4 shrink-0 text-gold-300" aria-hidden /><a href={`tel:${salon.phone.replace(/\s/g, "")}`} className="hover:text-white">{salon.phone}</a></p>}
            {salon?.whatsapp && <p className="mt-2 flex gap-2"><MessageCircle className="mt-0.5 size-4 shrink-0 text-gold-300" aria-hidden /><a href={`https://wa.me/${digits(salon.whatsapp).replace(/^0/, "254")}`} target="_blank" rel="noreferrer" className="hover:text-white">Chat on WhatsApp</a></p>}
          </div>
          <div>
            <p className="font-semibold text-white">Shop</p>
            <ul className="mt-3 space-y-2"><li><Link to="/shop" className="hover:text-white">All products</Link></li><li><Link to="/shop?sale=1" className="hover:text-white">On offer</Link></li><li><Link to="/bag" className="hover:text-white">Your bag</Link></li></ul>
          </div>
          <div>
            <p className="font-semibold text-white">Services</p>
            <ul className="mt-3 space-y-2"><li><Link to="/book" className="hover:text-white">Book an appointment</Link></li><li><Link to="/#services" className="hover:text-white">Services & prices</Link></li></ul>
          </div>
          <div>
            <p className="font-semibold text-white">Information</p>
            <ul className="mt-3 space-y-2"><li><Link to="/contact" className="hover:text-white">Contact us</Link></li><li><Link to="/privacy" className="hover:text-white">Privacy policy</Link></li><li><Link to="/terms" className="hover:text-white">Terms of service</Link></li></ul>
            {salon?.hoursText && <p className="mt-4 flex gap-2 whitespace-pre-line text-stone-400"><Clock className="mt-0.5 size-4 shrink-0" aria-hidden />{salon.hoursText}</p>}
          </div>
        </div>
      </footer>
    </div>
  );
}
