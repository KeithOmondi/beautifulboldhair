import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Slot } from "../../lib/types";

export interface PublicInfo {
  name: string;
  phone: string | null;
  address: string | null;
  depositRequired: boolean;
  depositAmount: number;
  cancelWindowHours: number;
  showStylists: boolean;
  maxAheadDays: number;
  minNoticeHours: number;
}
export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  price: number;
  /** The normal price, present only while an offer is running (price is then the offer price). */
  wasPrice: number | null;
  category: string | null;
  imageUrl: string | null;
  requiresPatchTest: boolean;
}
export interface PublicStaff {
  id: string;
  name: string;
  title: string | null;
}

export const usePublicInfo = () =>
  useQuery({ queryKey: ["public-info-full"], queryFn: async () => (await api.get<PublicInfo>("/public/info")).data, staleTime: 5 * 60_000 });
export const usePublicServices = () =>
  useQuery({ queryKey: ["public-services"], queryFn: async () => (await api.get<PublicService[]>("/public/services")).data, staleTime: 60_000 });
export const usePublicStaff = (serviceId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ["public-staff", serviceId],
    enabled: enabled && Boolean(serviceId),
    queryFn: async () => (await api.get<PublicStaff[]>("/public/staff", { params: { serviceId } })).data,
    staleTime: 60_000,
  });

export const usePublicSlots = (serviceId: string | undefined, staffId: string, date: string | undefined) =>
  useQuery({
    queryKey: ["public-slots", serviceId, staffId, date],
    enabled: Boolean(serviceId && date),
    queryFn: async () =>
      (await api.get<{ slots: Slot[] }>("/public/availability", { params: { serviceId, date, ...(staffId !== "any" ? { staffId } : {}) } })).data.slots,
    staleTime: 10_000,
  });

/** Builds a downloadable calendar event so the client can add the booking to their phone. */
export function downloadIcs(opts: { title: string; startAt: string; endAt: string; location?: string | null; description?: string }) {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/[,;\\]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${stamp(opts.startAt)}-${Math.random().toString(36).slice(2)}@booking`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(opts.startAt)}`,
    `DTEND:${stamp(opts.endAt)}`,
    `SUMMARY:${esc(opts.title)}`,
    ...(opts.location ? [`LOCATION:${esc(opts.location)}`] : []),
    ...(opts.description ? [`DESCRIPTION:${esc(opts.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "appointment.ics";
  a.click();
  URL.revokeObjectURL(url);
}
