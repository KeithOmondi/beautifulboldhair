import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarDays, Coins, ImageIcon, LineChart, LogOut, Menu, MessageSquareHeart, ReceiptText, Scissors, Settings, UserRound, Users, Wallet, X, CalendarOff, ExternalLink, PackageCheck, Boxes, Store, Megaphone } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import { Avatar, cx } from "../components/ui";
import { useAccess, useBranches, type Access } from "../lib/queries";
import { setStaffBranch, staffBranch } from "../lib/branch";
import type { Role } from "../lib/types";

type NavItem = { to: string; label: string; icon: typeof BarChart3; roles: Role[]; /** Only for an owner who manages all branches. */ spans?: boolean; /** Needs this permission (owners always have it; managers only if the owner allows it). */ needs?: keyof Access };

/** Grouped by what the person is trying to do, so the owner's menu reads top to bottom as a working day. */
const GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Today",
    items: [
      { to: "/app/dashboard", label: "Dashboard", icon: BarChart3, roles: ["OWNER", "MANAGER"], needs: "reports" },
      { to: "/app/calendar", label: "Calendar", icon: CalendarDays, roles: ["OWNER", "MANAGER", "RECEPTIONIST", "WORKER"] },
    ],
  },
  {
    title: "Clients",
    items: [
      { to: "/app/clients", label: "Clients", icon: UserRound, roles: ["OWNER", "MANAGER", "RECEPTIONIST"] },
      { to: "/app/feedback", label: "Feedback", icon: MessageSquareHeart, roles: ["OWNER", "MANAGER", "RECEPTIONIST"] },
    ],
  },
  {
    title: "Shop",
    items: [
      { to: "/app/orders", label: "Online orders", icon: PackageCheck, roles: ["OWNER", "MANAGER", "RECEPTIONIST"] },
      { to: "/app/products", label: "Products & stock", icon: Boxes, roles: ["OWNER", "MANAGER"] },
    ],
  },
  {
    title: "Money",
    items: [
      { to: "/app/money", label: "Till & balances", icon: Wallet, roles: ["OWNER", "MANAGER", "RECEPTIONIST"] },
      { to: "/app/payments", label: "All payments", icon: ReceiptText, roles: ["OWNER"] },
      { to: "/app/payroll", label: "Payroll", icon: Coins, roles: ["OWNER"] },
      { to: "/app/insights", label: "Reports", icon: LineChart, roles: ["OWNER", "MANAGER"], needs: "reports" },
    ],
  },
  {
    title: "Your salon",
    items: [
      { to: "/app/services", label: "Services", icon: Scissors, roles: ["OWNER", "MANAGER"] },
      { to: "/app/team", label: "Team", icon: Users, roles: ["OWNER", "MANAGER"] },
      { to: "/app/time-off", label: "Time off", icon: CalendarOff, roles: ["OWNER", "MANAGER"] },
      { to: "/app/banners", label: "Home page banners", icon: Megaphone, roles: ["OWNER", "MANAGER"] },
      { to: "/app/gallery", label: "Gallery", icon: ImageIcon, roles: ["OWNER", "MANAGER"] },
      { to: "/app/branches", label: "Branches", icon: Store, roles: ["OWNER"], spans: true },
    ],
  },
];
const SETTINGS_ITEM: NavItem = { to: "/app/settings", label: "Settings & hours", icon: Settings, roles: ["OWNER", "MANAGER"] };

const ROLE_LABEL: Record<Role, string> = { OWNER: "Owner", MANAGER: "Manager", RECEPTIONIST: "Reception", WORKER: "Stylist" };

export const useBrand = () =>
  useQuery({ queryKey: ["public-info"], queryFn: async () => (await api.get<{ name: string }>("/public/info")).data, staleTime: 5 * 60_000 });

export default function StaffLayout() {
  const { user, logout } = useAuth();
  const { data: brand } = useBrand();
  const branchList = useBranches(Boolean(user));
  const access = useAccess();
  const branches = branchList.data?.branches.filter((b) => b.isActive || b.id === branchList.data?.homeBranchId) ?? [];
  const activeId = staffBranch() ?? branchList.data?.homeBranchId ?? "";
  const active = branches.find((b) => b.id === activeId) ?? branches.find((b) => b.id === branchList.data?.homeBranchId);
  const brandName = active?.name ?? brand?.name ?? "Salon";
  const canPick = Boolean(branchList.data?.canSwitch) && branches.length > 1;
  // A remembered branch that is no longer allowed (or switched off) would make every request fail: drop it.
  useEffect(() => {
    if (branchList.data && staffBranch() && !branches.some((b) => b.id === staffBranch())) {
      setStaffBranch(null);
      window.location.reload();
    }
  });
  const switchTo = (id: string) => {
    setStaffBranch(id === branchList.data?.homeBranchId ? null : id);
    window.location.assign("/app/dashboard");
  };
  // New online orders waiting to be handled, shown as a badge so none is missed.
  const orders = useQuery({
    queryKey: ["shop-order-summary"],
    enabled: Boolean(user && user.role !== "WORKER"),
    queryFn: async () => (await api.get<{ toHandle: number }>("/shop/orders/summary")).data,
    refetchInterval: 30_000,
  });
  const [open, setOpen] = useState(false);
  const location = useLocation();
  if (!user) return null;

  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((n) => n.roles.includes(user.role) && (!n.spans || user.canSwitchBranches) && (!n.needs || access[n.needs])) })).filter((g) => g.items.length > 0);
  const showSettings = SETTINGS_ITEM.roles.includes(user.role);
  const current = [...groups.flatMap((g) => g.items), ...(showSettings ? [SETTINGS_ITEM] : [])].find((n) => location.pathname.startsWith(n.to));
  const section = current === SETTINGS_ITEM ? "Settings" : groups.find((g) => current && g.items.includes(current))?.title;
  const today = new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Nairobi" });

  const link = ({ to, label, icon: Icon }: NavItem) => {
    const badge = to === "/app/orders" ? (orders.data?.toHandle ?? 0) : 0;
    return (
    <NavLink
      key={to}
      to={to}
      onClick={() => setOpen(false)}
      className={({ isActive }) =>
        cx(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive ? "bg-gold-400 text-ink" : "text-stone-300 hover:bg-white/10 hover:text-white",
        )
      }
    >
      <Icon className="size-[18px]" aria-hidden />
      {label}
      {badge > 0 && <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{badge}</span>}
    </NavLink>
    );
  };

  const nav = (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4" aria-label="Main">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="mb-1 px-3 text-[11px] font-semibold tracking-widest text-stone-500 uppercase">{g.title}</p>
          <div className="flex flex-col gap-0.5">{g.items.map(link)}</div>
        </div>
      ))}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col bg-ink py-5">
      <div className="mb-6 px-6">
        <p className="font-display text-xl font-semibold text-gold-300">{brandName}</p>
        <p className="text-xs tracking-widest text-stone-400 uppercase">Studio manager</p>
        {canPick && (
          <label className="mt-3 block">
            <span className="sr-only">Branch</span>
            <select value={active?.id ?? ""} onChange={(e) => switchTo(e.target.value)} className="h-9 w-full rounded-lg border border-white/20 bg-white/10 px-2 text-sm text-white">
              {branches.map((b) => <option key={b.id} value={b.id} className="text-ink">{b.city ?? b.name}</option>)}
            </select>
          </label>
        )}
      </div>
      {nav}
      {showSettings && <div className="border-t border-white/10 px-3 pt-3 pb-3">{link(SETTINGS_ITEM)}</div>}
      <div className="border-t border-white/10 px-4 pt-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-stone-400">{ROLE_LABEL[user.role]}</p>
          </div>
          <button onClick={() => void logout()} aria-label="Sign out" title="Sign out" className="rounded-lg p-2 text-stone-400 hover:bg-white/10 hover:text-white">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 hover:bg-stone-100">
          <Menu className="size-5" />
        </button>
        <p className="font-display text-lg font-semibold text-ink">{current?.label ?? brandName}</p>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <div className="animate-sheet absolute inset-y-0 left-0 w-72">
            {sidebar}
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute top-4 right-3 rounded-lg p-2 text-stone-400 hover:bg-white/10">
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}

      {/* desktop top bar: where you are, today's date, and quick links */}
      <header className="sticky top-0 z-20 hidden h-16 items-center justify-between gap-4 border-b border-line bg-white/90 px-8 backdrop-blur lg:flex">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-widest text-stone-400 uppercase">{[brandName, section].filter(Boolean).join(" · ")}</p>
          <p className="truncate font-display text-lg leading-tight font-semibold text-ink">{current?.label ?? brand?.name}</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-stone-600">
          <span className="hidden xl:inline">{today}</span>
          <a href="/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 hover:bg-stone-50"><ExternalLink className="size-4" aria-hidden />View website</a>
          <div className="flex items-center gap-2 border-l border-line pl-4">
            <Avatar name={user.name} />
            <div className="leading-tight"><p className="text-sm font-medium text-ink">{user.name}</p><p className="text-xs text-stone-500">{ROLE_LABEL[user.role]}</p></div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
