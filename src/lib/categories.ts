/** The two sides of the business. Services are grouped under these first, then any custom group, then "Other". */
export const SERVICE_CATEGORIES = ["Lashes", "Hair & Wigs"] as const;
export const OTHER = "Other";

const rank = (c: string) => {
  const i = (SERVICE_CATEGORIES as readonly string[]).indexOf(c);
  return i >= 0 ? i : c === OTHER ? 1000 : 100;
};

/** Category names in display order: Lashes, Hair & Wigs, anything custom (A to Z), then Other. */
export function orderedCategories(items: Array<{ category: string | null }>): string[] {
  return [...new Set(items.map((i) => i.category ?? OTHER))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** Items split into ordered groups; uncategorised ones go under "Other". */
export function groupByCategory<T extends { category: string | null }>(items: T[]): Array<{ name: string; items: T[] }> {
  return orderedCategories(items).map((name) => ({ name, items: items.filter((i) => (i.category ?? OTHER) === name) }));
}
