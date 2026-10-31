import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { MapPin, Phone } from "lucide-react";
import { usePublicInfo } from "./publicApi";

/** Header + footer for every customer-facing page except the landing page (which has its own). */
export default function PublicShell({ children, salonName, wide = false }: { children: ReactNode; wide?: boolean; /** For links that belong to one branch (manage, review): its name wins over the browsing choice. */ salonName?: string }) {
  const { data: info } = usePublicInfo();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-ink px-4 py-6 text-center">
        <Link to="/" className="font-display text-2xl font-semibold text-gold-300 sm:text-3xl">
          {salonName ?? info?.name ?? " "}
        </Link>
        <p className="mt-1 text-xs tracking-[0.25em] text-stone-400 uppercase">Online booking</p>
      </header>

      <main className={`mx-auto w-full flex-1 px-4 py-6 sm:py-10 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>{children}</main>
      <SiteFooter phone={info?.phone ?? null} address={info?.address ?? null} />
    </div>
  );
}

export function SiteFooter({ phone, address }: { phone: string | null; address: string | null }) {
  return (
    <footer className="border-t border-line bg-white px-4 py-8 text-center text-sm text-stone-500">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
        {phone && (
          <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-ink">
            <Phone className="size-3.5" aria-hidden /> {phone}
          </a>
        )}
        {address && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" aria-hidden /> {address}
          </span>
        )}
      </div>
      <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs">
        <Link to="/book" className="hover:text-ink">Book online</Link>
        <Link to="/contact" className="hover:text-ink">Contact or report a problem</Link>
        <Link to="/privacy" className="hover:text-ink">Privacy policy</Link>
        <Link to="/terms" className="hover:text-ink">Terms of service</Link>
        <Link to="/login" className="text-stone-400 hover:text-stone-600">Staff sign in</Link>
      </nav>
    </footer>
  );
}
