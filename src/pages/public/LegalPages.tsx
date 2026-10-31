import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "../../lib/track";
import PublicShell from "./PublicShell";
import { usePublicInfo } from "./publicApi";

const UPDATED = "29 October 2026";

function Doc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PublicShell>
      <article className="space-y-4 text-sm leading-relaxed text-stone-700 [&_h2]:mt-6 [&_h2]:mb-1 [&_h2]:font-sans [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        <h1 className="text-3xl font-semibold text-ink">{title}</h1>
        <p className="text-xs text-stone-500">Last updated {UPDATED}</p>
        {children}
      </article>
    </PublicShell>
  );
}

function useContact() {
  const { data } = usePublicInfo();
  return { name: data?.name ?? "the salon", phone: data?.phone, window: data?.cancelWindowHours ?? 24 };
}

export function PrivacyPage() {
  usePageMeta("Privacy policy");
  const { name, phone } = useContact();
  return (
    <Doc title="Privacy policy">
      <p>{name} ("we", "us") respects your privacy. This policy explains what personal information we collect when you book with us, why, and the choices you have. We handle your information in line with the Data Protection Act, 2019 of Kenya.</p>

      <h2>What we collect</h2>
      <ul>
        <li>Your name and phone number, so we can confirm and manage your appointment.</li>
        <li>Allergies or sensitivities you tell us about, so we can keep you safe.</li>
        <li>Your booking history (services, dates, prices) and payment records, including M-Pesa receipt numbers.</li>
        <li>Messages you send us, such as a review or complaint.</li>
      </ul>

      <h2>What we do not collect</h2>
      <p>Our website does not use advertising cookies or trackers. We count visits in a way that stores no cookies, no IP address and nothing that identifies you.</p>

      <h2>How we use it</h2>
      <ul>
        <li>To provide the service you booked, including SMS confirmations and reminders.</li>
        <li>To take and record payments, and to handle refunds.</li>
        <li>To respond to your questions, reviews and complaints.</li>
        <li>To keep our records, as the law requires.</li>
      </ul>
      <p>We do not sell your information, and we only send marketing messages if you have agreed to receive them.</p>

      <h2>Who we share it with</h2>
      <p>Only the service providers who help us run the booking service: Safaricom (M-Pesa payments), our SMS provider, our image host for gallery photos, and our hosting and database provider. They may only use your information to provide that service to us.</p>

      <h2>How long we keep it</h2>
      <p>We keep client and payment records for as long as needed to serve you and to meet our legal and accounting duties. You may ask us to delete your details sooner, unless we must keep them by law.</p>

      <h2>Your rights</h2>
      <p>You may ask to see the information we hold about you, correct it, or ask us to delete it. You may also object to how we use it. To do any of these, {phone ? <>call us on {phone} or </> : null}use our <Link to="/contact" className="text-gold-700 underline">contact form</Link>. You also have the right to complain to the Office of the Data Protection Commissioner.</p>

      <h2>Security</h2>
      <p>Our systems use encrypted connections, restrict access by role, and keep a record of important changes. No system is perfectly secure, so please tell us at once if you think your information has been misused.</p>

      <h2>Changes</h2>
      <p>If we change this policy we will update the date above.</p>
    </Doc>
  );
}

export function TermsPage() {
  usePageMeta("Terms of service");
  const { name, phone, window } = useContact();
  return (
    <Doc title="Terms of service">
      <p>By booking an appointment with {name} you agree to these terms.</p>

      <h2>Bookings</h2>
      <ul>
        <li>An appointment is confirmed once you receive our confirmation message. Please arrive a few minutes early.</li>
        <li>If you arrive late, we may need to shorten or reschedule your service so that other clients are not kept waiting.</li>
        <li>Please tell us about any allergies, skin conditions or sensitivities before your appointment. Some services may need a patch test.</li>
      </ul>

      <h2>Deposits and payment</h2>
      <ul>
        <li>We may ask for a deposit by M-Pesa to secure your time. The deposit counts toward the price of your service.</li>
        <li>The remaining balance is paid at the salon, by cash, M-Pesa or card.</li>
      </ul>

      <h2>Changes and cancellations</h2>
      <ul>
        <li>You can move or cancel your appointment free of charge up to {window} hours before it starts, using the link in your confirmation message. Your deposit is then refunded.</li>
        <li>Cancellations made later than that, and missed appointments, forfeit the deposit.</li>
        <li>If we need to cancel or move your appointment, we will tell you as early as we can and refund your deposit in full or rebook you, as you prefer.</li>
      </ul>

      <h2>Our service</h2>
      <p>We take great care with every service. If you are unhappy with the result, please tell us within 7 days so that we can put it right. Results can vary with hair, skin and aftercare, and we are not liable for reactions to allergies you did not tell us about.</p>

      <h2>Reviews and messages</h2>
      <p>Reviews you submit may be shown on our website using your first name and the initial of your surname. We may decline to show reviews that are abusive or unrelated to your visit.</p>

      <h2>Contact</h2>
      <p>Questions about these terms? {phone ? <>Call {phone} or </> : null}use our <Link to="/contact" className="text-gold-700 underline">contact form</Link>.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of Kenya.</p>
    </Doc>
  );
}
