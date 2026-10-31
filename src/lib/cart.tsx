import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/** The shopping bag lives in this browser only (no account needed) and survives a refresh. */
export interface BagLine { id: string; qty: number }

import { publicBranch } from "./branch";

// Each side of the business has its own bag, so wigs and lash services never get mixed up.
const keyNow = () => `salon.bag.${publicBranch() ?? "default"}`;
const MAX_QTY = 20;

const read = (): BagLine[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(keyNow()) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((l): l is BagLine => Boolean(l) && typeof (l as BagLine).id === "string" && Number.isInteger((l as BagLine).qty) && (l as BagLine).qty > 0)
      .map((l) => ({ id: l.id, qty: Math.min(l.qty, MAX_QTY) }))
      .slice(0, 30);
  } catch {
    return [];
  }
};

interface BagApi {
  lines: BagLine[];
  count: number;
  add: (id: string, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const Ctx = createContext<BagApi | null>(null);

export function BagProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<BagLine[]>(read);

  useEffect(() => {
    try {
      localStorage.setItem(keyNow(), JSON.stringify(lines));
    } catch {
      /* private mode: the bag still works for this visit */
    }
  }, [lines]);

  // Another tab changed the bag.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === keyNow()) setLines(read()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((id: string, qty = 1) => setLines((cur) => {
    const found = cur.find((l) => l.id === id);
    return found ? cur.map((l) => (l.id === id ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l)) : [...cur, { id, qty: Math.min(MAX_QTY, qty) }];
  }), []);
  const setQty = useCallback((id: string, qty: number) => setLines((cur) => (qty <= 0 ? cur.filter((l) => l.id !== id) : cur.map((l) => (l.id === id ? { ...l, qty: Math.min(MAX_QTY, qty) } : l)))), []);
  const remove = useCallback((id: string) => setLines((cur) => cur.filter((l) => l.id !== id)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<BagApi>(() => ({ lines, count: lines.reduce((n, l) => n + l.qty, 0), add, setQty, remove, clear }), [lines, add, setQty, remove, clear]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBag() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBag must be used inside BagProvider");
  return v;
}
