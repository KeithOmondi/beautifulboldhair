import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { publicBranch, staffBranch } from "./branch";

const baseURL = import.meta.env.VITE_API_URL || "/api/v1";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// Public requests name the branch by its web name; staff requests by id (the server checks they may use it).
api.interceptors.request.use((config) => {
  const url = config.url ?? "";
  if (url.startsWith("/public")) {
    const slug = publicBranch();
    if (slug && !(config.params && "branch" in config.params)) config.params = { ...(config.params ?? {}), branch: slug };
  } else if (!url.startsWith("/auth")) {
    const id = staffBranch();
    if (id && !config.headers.has("X-Branch-Id")) config.headers.set("X-Branch-Id", id);
  }
  return config;
});

type Retryable = InternalAxiosRequestConfig & { _retry?: boolean };
const NO_REFRESH = ["/auth/login", "/auth/refresh", "/auth/logout", "/auth/request-password-reset", "/auth/reset-password"];

// One refresh at a time, however many requests fail together.
let refreshing: Promise<void> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as Retryable | undefined;
    const url = original?.url ?? "";

    if (error.response?.status === 401 && original && !original._retry && !NO_REFRESH.some((p) => url.startsWith(p))) {
      original._retry = true;
      try {
        refreshing ??= axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true }).then(() => undefined);
        await refreshing;
        return api(original);
      } catch {
        window.dispatchEvent(new Event("session-expired"));
      } finally {
        refreshing = null;
      }
    }
    return Promise.reject(error);
  },
);

/** Turns any thrown value into a sentence a person can act on. */
export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; issues?: Array<{ message?: string }> } | undefined;
    if (data?.message) return data.message;
    if (data?.issues?.[0]?.message) return data.issues[0].message;
    if (!error.response) return "Can't reach the server. Check your internet connection.";
  }
  return fallback;
}

export const errorCode = (error: unknown): string | undefined =>
  axios.isAxiosError(error) ? (error.response?.data as { error?: string } | undefined)?.error : undefined;
