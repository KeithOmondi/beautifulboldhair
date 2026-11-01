import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Mail, Phone } from "lucide-react";
import { usePageMeta } from "../../lib/track";
import ShopLayout from "../shop/ShopLayout";
import { usePublicInfo } from "./publicApi";

const UPDATED = "1 November 2026";

interface Section { id: string; title: string; body: ReactNode }

function useContact() {
  const { data } = usePublicInfo();
  return { name: data?.name ?? "the salon", phone: data?.phone, window: data?.cancelWindowHours ?? 24 };
}

const A = ({ to, children }: { to: string; children: ReactNode }) => <Link to={to} className="font-medium text-gold-700 underline underline-offset-2 hover:text-gold-800">{children}</Link>;

/** A readable document page: title band, a contents list you can click, and numbered sections. */
function Doc({ title, intro, sections, other }: { title: string; intro: ReactNode; sections: Section[]; other: { to: string; label: string } }) {
  const { phone } = useContact();
  return (
    <ShopLayout>
      <div className="bg-ink px-4 py-12 text-center sm:py-16">
        <p className="text-xs font-medium tracking-[0.25em] text-gold-300 uppercase">Legal</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-white sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-stone-400">Last updated {UPDATED}</p>
      </div>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:py-12 lg:grid-cols-[15rem_1fr] lg:gap-12">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          {/* On a phone the contents fold away so the document starts right under the title. */}
          <details className="group rounded-xl border border-line bg-white lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-ink">
              On this page <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
            </summary>
            <ol className="space-y-1 border-t border-line px-4 py-3 text-sm">
              {sections.map((s, i) => <li key={s.id}><a href={`#${s.id}`} className="block rounded py-1 text-stone-600 hover:text-ink"><span className="mr-2 text-stone-400 tabular-nums">{i + 1}.</span>{s.title}</a></li>)}
            </ol>
          </details>
          <nav aria-label="On this page" className="hidden lg:block">
            <p className="mb-3 text-xs font-semibold tracking-wider text-stone-500 uppercase">On this page</p>
            <ol className="space-y-1 border-l border-line text-sm">
              {sections.map((s, i) => <li key={s.id}><a href={`#${s.id}`} className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-stone-600 hover:border-gold-500 hover:text-ink"><span className="mr-2 text-stone-400 tabular-nums">{i + 1}.</span>{s.title}</a></li>)}
            </ol>
          </nav>
        </aside>

        <article className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-10">
          <div className="text-base leading-7 text-stone-700">{intro}</div>
          <div className="mt-8 divide-y divide-line">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24 py-7 first:pt-0 last:pb-0">
                <h2 className="flex items-center gap-3 font-display text-xl font-semibold text-ink sm:text-2xl">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gold-50 font-sans text-sm font-semibold text-gold-700 ring-1 ring-gold-200">{i + 1}</span>
                  {s.title}
                </h2>
                <div className="mt-3 space-y-3 leading-7 text-stone-700 sm:pl-11 [&_li]:marker:text-gold-500 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">{s.body}</div>
              </section>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-4 rounded-xl bg-cream p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-ink">Questions about this page?</p>
              <p className="text-sm text-stone-600">We are happy to explain anything in plain words.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {phone && <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink hover:bg-stone-50"><Phone className="size-4" aria-hidden />{phone}</a>}
              <Link to="/contact" className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-white hover:bg-stone-800"><Mail className="size-4" aria-hidden />Contact us</Link>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-stone-500">Also read our <A to={other.to}>{other.label}</A>.</p>
        </article>
      </div>
    </ShopLayout>
  );
}

export function PrivacyPage() {
  usePageMeta("Privacy policy");
  const { name, phone } = useContact();
  const sections: Section[] = [
    {
      id: "collect", title: "What we collect",
      body: (
        <ul>
          <li>Your name and phone number, so we can confirm and manage your appointment or order.</li>
          <li>For shop orders, your delivery address and area, and your email if you give it.</li>
          <li>Allergies or sensitivities you tell us about, so we can keep you safe.</li>
          <li>Your booking and order history (services, products, dates, prices) and payment records, including M-Pesa receipt numbers.</li>
          <li>Messages you send us, such as a review or complaint.</li>
        </ul>
      ),
    },
    {
      id: "not-collect", title: "What we do not collect",
      body: <p>Our website does not use advertising cookies or trackers. We count visits in a way that stores no cookies, no IP address and nothing that identifies you.</p>,
    },
    {
      id: "use", title: "How we use it",
      body: (
        <>
          <ul>
            <li>To provide the service or products you ordered, including SMS confirmations, reminders and delivery updates.</li>
            <li>To take and record payments, and to handle refunds.</li>
            <li>To respond to your questions, reviews and complaints.</li>
            <li>To keep our records, as the law requires.</li>
          </ul>
          <p>We do not sell your information, and we only send marketing messages if you have agreed to receive them.</p>
        </>
      ),
    },
    {
      id: "share", title: "Who we share it with",
      body: <p>Only the service providers who help us run the booking service and the shop: Safaricom (M-Pesa payments), our SMS provider, our image host for gallery and product photos, and our hosting and database provider. They may only use your information to provide that service to us. Our delivery team sees your name, phone number and address so they can reach you.</p>,
    },
    {
      id: "keep", title: "How long we keep it",
      body: <p>We keep client, order and payment records for as long as needed to serve you and to meet our legal and accounting duties. You may ask us to delete your details sooner, unless we must keep them by law.</p>,
    },
    {
      id: "rights", title: "Your rights",
      body: <p>You may ask to see the information we hold about you, correct it, or ask us to delete it. You may also object to how we use it. To do any of these, {phone ? <>call us on {phone} or </> : null}use our <A to="/contact">contact form</A>. You also have the right to complain to the Office of the Data Protection Commissioner.</p>,
    },
    {
      id: "security", title: "Security",
      body: <p>Our systems use encrypted connections, restrict access by role, and keep a record of important changes. No system is perfectly secure, so please tell us at once if you think your information has been misused.</p>,
    },
    {
      id: "changes", title: "Changes",
      body: <p>If we change this policy we will update the date at the top of the page.</p>,
    },
  ];
  return (
    <Doc
      title="Privacy policy"
      sections={sections}
      other={{ to: "/terms", label: "Terms of service" }}
      intro={<p>{name} ("we", "us") respects your privacy. This policy explains what personal information we collect when you book or order with us, why, and the choices you have. We handle your information in line with the Data Protection Act, 2019 of Kenya.</p>}
    />
  );
}

export function TermsPage() {
  usePageMeta("Terms of service");
  const { name, phone, window } = useContact();
  const sections: Section[] = [
    {
      id: "bookings", title: "Bookings",
      body: (
        <ul>
          <li>An appointment is confirmed once you receive our confirmation message. Please arrive a few minutes early.</li>
          <li>If you arrive late, we may need to shorten or reschedule your service so that other clients are not kept waiting.</li>
          <li>Please tell us about any allergies, skin conditions or sensitivities before your appointment. Some services may need a patch test.</li>
        </ul>
      ),
    },
    {
      id: "payment", title: "Deposits and payment",
      body: (
        <ul>
          <li>We may ask for a deposit by M-Pesa to secure your time. The deposit counts toward the price of your service.</li>
          <li>The remaining balance is paid at the salon, by cash, M-Pesa or card.</li>
        </ul>
      ),
    },
    {
      id: "cancel", title: "Changes and cancellations",
      body: (
        <ul>
          <li>You can move or cancel your appointment free of charge up to {window} hours before it starts, using the link in your confirmation message. Your deposit is then refunded.</li>
          <li>Cancellations made later than that, and missed appointments, forfeit the deposit.</li>
          <li>If we need to cancel or move your appointment, we will tell you as early as we can and refund your deposit in full or rebook you, as you prefer.</li>
        </ul>
      ),
    },
    {
      id: "shop", title: "Shop orders and delivery",
      body: (
        <ul>
          <li>An order is confirmed once payment is received (M-Pesa) or accepted for payment on delivery or collection. Items are held for you for a short time while you pay; if payment does not arrive the order is cancelled and the items go back on sale.</li>
          <li>Delivery fees and any free-delivery threshold are shown at checkout before you pay. For areas outside our usual delivery zones we will confirm the cost with you.</li>
          <li>Please check your order when it arrives and tell us straight away if anything is wrong, missing or damaged.</li>
          <li>Wigs and hair that have been worn, cut, coloured or installed cannot be returned. Unused items in their original condition can be returned within 7 days; contact us first so we can arrange it.</li>
          <li>If we cannot supply an item, we will refund what you paid for it in full.</li>
        </ul>
      ),
    },
    {
      id: "service", title: "Our service",
      body: <p>We take great care with every service. If you are unhappy with the result, please tell us within 7 days so that we can put it right. Results can vary with hair, skin and aftercare, and we are not liable for reactions to allergies you did not tell us about.</p>,
    },
    {
      id: "reviews", title: "Reviews and messages",
      body: <p>Reviews you submit may be shown on our website using your first name and the initial of your surname. We may decline to show reviews that are abusive or unrelated to your visit.</p>,
    },
    {
      id: "contact", title: "Contact",
      body: <p>Questions about these terms? {phone ? <>Call {phone} or </> : null}use our <A to="/contact">contact form</A>.</p>,
    },
    {
      id: "law", title: "Governing law",
      body: <p>These terms are governed by the laws of Kenya.</p>,
    },
  ];
  return (
    <Doc
      title="Terms of service"
      sections={sections}
      other={{ to: "/privacy", label: "Privacy policy" }}
      intro={<p>By booking an appointment or placing an order with {name} you agree to these terms.</p>}
    />
  );
}
