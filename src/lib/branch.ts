/**
 * Which side of the business (branch) the app is showing.
 *
 * Customers pick a branch by its web name (slug); it is remembered in this browser and sent with every public request.
 * Staff who may work across branches pick by id; the server checks the permission on every request.
 */
const PUBLIC_KEY = "salon.publicBranch";
const STAFF_KEY = "salon.activeBranch";

const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch {
    /* private mode: the choice lasts only until the page reloads */
  }
};

/** A link like /?branch=hair-wigs picks the branch for whoever opens it. */
export function rememberBranchFromUrl() {
  try {
    const slug = new URLSearchParams(window.location.search).get("branch");
    if (slug && /^[a-z0-9-]{1,60}$/i.test(slug)) write(PUBLIC_KEY, slug.toLowerCase());
  } catch {
    /* ignore */
  }
}

export const publicBranch = () => read(PUBLIC_KEY);
export const setPublicBranch = (slug: string | null) => write(PUBLIC_KEY, slug);

export const staffBranch = () => read(STAFF_KEY);
export const setStaffBranch = (id: string | null) => write(STAFF_KEY, id);
