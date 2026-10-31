import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Service, Settings, StaffMember } from "./types";

export const useStaffList = () =>
  useQuery({ queryKey: ["staff"], queryFn: async () => (await api.get<StaffMember[]>("/staff")).data, staleTime: 60_000 });

export const useServices = (includeInactive = false) =>
  useQuery({
    queryKey: ["services", includeInactive],
    queryFn: async () => (await api.get<Service[]>("/services", { params: includeInactive ? { includeInactive: true } : {} })).data,
    staleTime: 60_000,
  });

export const useSettings = (enabled = true) =>
  useQuery({ queryKey: ["settings"], queryFn: async () => (await api.get<Settings>("/settings")).data, enabled, staleTime: 60_000 });

export interface BranchRow { id: string; name: string; city: string | null; slug: string; sortOrder: number; isActive: boolean; phone: string | null; address: string | null }
export interface BranchList { homeBranchId: string; canSwitch: boolean; branches: BranchRow[] }

/** The branches this person may work on, and which one is open right now. */
export const useBranches = (enabled = true) =>
  useQuery({ queryKey: ["branches"], enabled, queryFn: async () => (await api.get<BranchList>("/branches")).data, staleTime: 60_000 });

export interface Access { reports: boolean; refunds: boolean; cashUp: boolean; staffPay: boolean }
const NO_ACCESS: Access = { reports: false, refunds: false, cashUp: false, staffPay: false };

/** What the signed-in person may do beyond the basics of their role. Until it loads, nothing sensitive is shown. */
export function useAccess(): Access & { loading: boolean } {
  const q = useQuery({ queryKey: ["access"], queryFn: async () => (await api.get<Access>("/settings/access")).data, staleTime: 60_000 });
  return { ...(q.data ?? NO_ACCESS), loading: q.isLoading };
}
