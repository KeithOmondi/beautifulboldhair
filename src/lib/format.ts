const TZ = "Africa/Nairobi";
const OFFSET_MS = 3 * 60 * 60 * 1000;

export const money = (n: number) => `KES ${Math.round(n).toLocaleString("en-KE")}`;
export const moneyShort = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n));

/** "YYYY-MM-DD" for an instant, in Nairobi. */
export const toDateStr = (d: Date | string) => new Date(new Date(d).getTime() + OFFSET_MS).toISOString().slice(0, 10);
export const todayStr = () => toDateStr(new Date());

export function addDays(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** Parse "YYYY-MM-DD" as a calendar date (UTC midnight) so formatting never shifts a day. */
const asUtc = (dateStr: string) => new Date(`${dateStr}T00:00:00Z`);

export const fmtDateLong = (dateStr: string) =>
  asUtc(dateStr).toLocaleDateString("en-KE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
export const fmtDateShort = (dateStr: string) =>
  asUtc(dateStr).toLocaleDateString("en-KE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
export const fmtDay = (dateStr: string) => asUtc(dateStr).toLocaleDateString("en-KE", { timeZone: "UTC", weekday: "short" });
export const fmtDayNum = (dateStr: string) => asUtc(dateStr).getUTCDate();
export const fmtMonth = (monthStr: string) =>
  asUtc(`${monthStr}-01`).toLocaleDateString("en-KE", { timeZone: "UTC", month: "long", year: "numeric" });

export const fmtTime = (iso: string | Date) =>
  new Date(iso).toLocaleTimeString("en-KE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

export const fmtDateTime = (iso: string | Date) =>
  new Date(iso).toLocaleString("en-KE", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

export const fmtClock12 = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h! >= 12 ? "pm" : "am";
  return `${h! % 12 === 0 ? 12 : h! % 12}:${String(m).padStart(2, "0")} ${suffix}`;
};

export const minutesOfDay = (iso: string | Date) => {
  const local = new Date(new Date(iso).getTime() + OFFSET_MS);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
};

export const fmtDuration = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ");
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

export function ymFromDate(dateStr: string) {
  return dateStr.slice(0, 7);
}

/** Phone -> a wa.me / tel friendly number. */
export const telHref = (phone: string) => `tel:${phone.replace(/\s/g, "")}`;

/** What a client pays today for a service: the offer price when one is set and lower, otherwise the normal price. */
export const todayPrice = (s: { price: number; salePrice?: number | null }) => (s.salePrice != null && s.salePrice < s.price ? s.salePrice : s.price);
