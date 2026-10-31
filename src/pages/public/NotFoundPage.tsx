import { Link } from "react-router-dom";
import { usePageMeta } from "../../lib/track";
import PublicShell from "./PublicShell";

export default function NotFoundPage() {
  usePageMeta("Page not found");
  return (
    <PublicShell>
      <div className="py-10 text-center">
        <p className="font-display text-6xl font-semibold text-gold-500">404</p>
        <h1 className="mt-3 text-2xl font-semibold text-ink">We can't find that page</h1>
        <p className="mt-2 text-sm text-stone-500">The link may be old or mistyped.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="inline-flex h-10 items-center rounded-lg bg-ink px-5 text-sm font-medium text-white hover:bg-stone-800">Go to home</Link>
          <Link to="/book" className="inline-flex h-10 items-center rounded-lg bg-gold-400 px-5 text-sm font-semibold text-ink hover:bg-gold-300">Book now</Link>
        </div>
      </div>
    </PublicShell>
  );
}
