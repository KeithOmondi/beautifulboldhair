import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  images: string[];
  price: number;
  wasPrice: number | null;
  discountPct: number | null;
  inStock: boolean;
  /** Present only when very few are left. */
  left: number | null;
  isNew: boolean;
  featured: boolean;
}
export interface BagProduct extends Product { max: number }

export interface ShopList {
  products: Product[];
  total: number;
  categories: Array<{ name: string; count: number }>;
}
export interface ShopConfig {
  name: string;
  phone: string | null;
  address: string | null;
  whatsapp: string | null;
  deliveryFee: number;
  freeOver: number | null;
  codAllowed: boolean;
  mpesaEnabled: boolean;
}

export interface ShopFilters { category?: string; q?: string; sale?: boolean; sort?: "new" | "price_asc" | "price_desc"; featured?: boolean; limit?: number }

export const useShopProducts = (f: ShopFilters = {}) =>
  useQuery({
    queryKey: ["shop-products", f],
    queryFn: async () =>
      (await api.get<ShopList>("/public/shop/products", { params: { ...(f.category ? { category: f.category } : {}), ...(f.q ? { q: f.q } : {}), ...(f.sale ? { sale: "1" } : {}), ...(f.featured ? { featured: "1" } : {}), ...(f.sort ? { sort: f.sort } : {}), ...(f.limit ? { limit: f.limit } : {}) } })).data,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

export const useShopConfig = () =>
  useQuery({ queryKey: ["shop-config"], queryFn: async () => (await api.get<ShopConfig>("/public/shop/config")).data, staleTime: 5 * 60_000 });

/** Cloudinary photos are resized on the fly; anything else is used as-is. */
export const img = (url: string | undefined, w = 600) => (url ? url.replace("/image/upload/", `/image/upload/c_fill,w_${w},h_${Math.round(w * 1.25)},q_auto,f_auto/`) : "");
