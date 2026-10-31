import { api } from "./api";

interface Signature { cloudName: string; apiKey: string; timestamp: number; folder: string; allowed_formats: string; signature: string }

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** Uploads one photo straight to Cloudinary using a short-lived signature from our server; returns its https URL. */
export async function uploadPhoto(file: File): Promise<string> {
  if (!PHOTO_TYPES.includes(file.type)) throw new Error(`${file.name}: please use a JPG, PNG or WebP photo`);
  if (file.size > MAX_PHOTO_BYTES) throw new Error(`${file.name}: photos must be under 10 MB`);

  const sig = (await api.post<Signature>("/site/gallery/sign")).data;
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("allowed_formats", sig.allowed_formats);
  form.append("signature", sig.signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: "POST", body: form });
  const uploaded = (await res.json()) as { secure_url?: string; error?: { message: string } };
  if (!res.ok || !uploaded.secure_url) throw new Error(uploaded.error?.message ?? "Upload failed");
  return uploaded.secure_url;
}
