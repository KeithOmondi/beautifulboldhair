import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Privacy-friendly analytics: no cookies, no IP address, no personal data.
 * A random id lives in this tab only (sessionStorage) so we can count unique visits and build the booking funnel.
 * Respects the browser's "Do Not Track" setting.
 */
type EventType = "page_view" | "service_selected" | "slot_selected" | "details_view" | "booking_submitted" | "booking_confirmed";

function sessionId(): string {
  try {
    let id = sessionStorage.getItem("sid");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("sid", id);
    }
    return id;
  } catch {
    return "anonymous-session";
  }
}

export function track(type: EventType, path = window.location.pathname) {
  if (navigator.doNotTrack === "1") return;
  try {
    const body = JSON.stringify({ type, path, sessionId: sessionId(), ...(document.referrer ? { referrer: document.referrer } : {}) });
    // Never throws and never blocks the page: analytics must not be able to break booking.
    void fetch("/api/v1/public/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Counts a page view for public pages; staff pages are never tracked. */
export function usePageViewTracking() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname.startsWith("/app") || pathname.startsWith("/login") || pathname.startsWith("/change-password") || pathname.startsWith("/forgot-password")) return;
    // Booking-page paths contain secrets (manage/review links); only record the page type.
    const safe = pathname.startsWith("/manage/") ? "/manage" : pathname.startsWith("/review/") ? "/review" : pathname;
    track("page_view", safe);
  }, [pathname]);
}

/** Sets the browser tab title and meta description for a page. */
export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    document.title = title;
    if (description) {
      let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!tag) {
        tag = document.createElement("meta");
        tag.name = "description";
        document.head.appendChild(tag);
      }
      tag.content = description;
    }
  }, [title, description]);
}
