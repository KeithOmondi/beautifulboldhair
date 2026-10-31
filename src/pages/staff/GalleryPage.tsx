import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Eye, EyeOff, ImagePlus, Loader2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { api, errorMessage } from "../../lib/api";
import { Button, Card, Confirm, Empty, ErrorNote, PageHeader, Spinner, cx } from "../../components/ui";

interface Image { id: string; url: string; publicId: string; caption: string | null; isPublished: boolean; sortOrder: number }
interface GalleryResponse { enabled: boolean; images: Image[] }
interface Signature { cloudName: string; apiKey: string; timestamp: number; folder: string; allowed_formats: string; signature: string }

const MAX_BYTES = 10 * 1024 * 1024;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];
const thumb = (url: string) => url.replace("/image/upload/", "/image/upload/c_fill,w_400,h_400,q_auto,f_auto/");

export default function GalleryPage() {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<Image | null>(null);

  const q = useQuery({ queryKey: ["gallery"], queryFn: async () => (await api.get<GalleryResponse>("/site/gallery")).data });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["gallery"] });
    void qc.invalidateQueries({ queryKey: ["landing"] });
  };

  const patch = useMutation({
    mutationFn: async ({ id, ...body }: { id: string; isPublished?: boolean; caption?: string | null; sortOrder?: number }) => (await api.patch(`/site/gallery/${id}`, body)).data,
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/site/gallery/${id}`)).data,
    onSuccess: () => { refresh(); toast.success("Photo deleted"); setDeleting(null); },
    onError: (e) => { toast.error(errorMessage(e)); setDeleting(null); },
  });

  const upload = async (file: File) => {
    if (!OK_TYPES.includes(file.type)) return toast.error(`${file.name}: please use a JPG, PNG or WebP photo`);
    if (file.size > MAX_BYTES) return toast.error(`${file.name}: photos must be under 10 MB`);

    setBusy((b) => [...b, file.name]);
    try {
      const sig = (await api.post<Signature>("/site/gallery/sign")).data;
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sig.apiKey);
      form.append("timestamp", String(sig.timestamp));
      form.append("folder", sig.folder);
      form.append("allowed_formats", sig.allowed_formats);
      form.append("signature", sig.signature);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: "POST", body: form });
      const uploaded = (await res.json()) as { public_id?: string; secure_url?: string; error?: { message: string } };
      if (!res.ok || !uploaded.public_id || !uploaded.secure_url) throw new Error(uploaded.error?.message ?? "Upload failed");

      await api.post("/site/gallery", { publicId: uploaded.public_id, url: uploaded.secure_url });
      refresh();
    } catch (err) {
      toast.error(`${file.name}: ${err instanceof Error && !("response" in err) ? err.message : errorMessage(err)}`);
    } finally {
      setBusy((b) => b.filter((n) => n !== file.name));
    }
  };

  const onPick = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) await upload(f);
    if (input.current) input.current.value = "";
  };

  const images = q.data?.images ?? [];
  const move = (index: number, by: number) => {
    const target = index + by;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target]!, next[index]!];
    next.forEach((img, i) => { if (img.sortOrder !== i) patch.mutate({ id: img.id, sortOrder: i }); });
  };

  return (
    <div>
      <PageHeader
        title="Gallery"
        subtitle="Show off your best work on your website. Clients love seeing real results."
        actions={
          <>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void onPick(e.target.files)} />
            <Button variant="gold" icon={<ImagePlus className="size-4" />} disabled={!q.data?.enabled || busy.length > 0} onClick={() => input.current?.click()}>Add photos</Button>
          </>
        }
      />

      {q.data && !q.data.enabled && (
        <div className="mb-5"><ErrorNote>Photo uploads need a free Cloudinary account. Add <code>CLOUDINARY_CLOUD_NAME</code>, <code>CLOUDINARY_API_KEY</code> and <code>CLOUDINARY_API_SECRET</code> to the server settings, then restart.</ErrorNote></div>
      )}

      {busy.length > 0 && (
        <p className="mb-4 flex items-center gap-2 text-sm text-stone-600" role="status"><Loader2 className="size-4 animate-spin" aria-hidden /> Uploading {busy.length} photo{busy.length > 1 ? "s" : ""}…</p>
      )}

      {q.isLoading ? <Spinner /> : images.length === 0 ? (
        <Card><Empty icon={<ImagePlus className="size-6" />} title="No photos yet" hint="Add before-and-after shots, finished styles or your studio. JPG, PNG or WebP up to 10 MB each." /></Card>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.id} className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
              <div className="relative aspect-square bg-stone-100">
                <img src={thumb(img.url)} alt={img.caption ?? "Gallery photo"} loading="lazy" className={cx("size-full object-cover", !img.isPublished && "opacity-40")} />
                {!img.isPublished && <span className="absolute top-2 left-2 rounded-full bg-ink/80 px-2 py-0.5 text-xs text-white">Hidden</span>}
              </div>
              <div className="space-y-2 p-3">
                <input
                  aria-label="Caption"
                  placeholder="Add a caption"
                  maxLength={120}
                  defaultValue={img.caption ?? ""}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v !== (img.caption ?? "")) patch.mutate({ id: img.id, caption: v || null }); }}
                  className="h-9 w-full rounded-lg border border-line px-2 text-sm"
                />
                <div className="flex items-center justify-between">
                  <span className="flex">
                    <button aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1.5 text-stone-500 hover:bg-stone-100 disabled:opacity-30"><ArrowLeft className="size-4" /></button>
                    <button aria-label="Move later" disabled={i === images.length - 1} onClick={() => move(i, 1)} className="rounded p-1.5 text-stone-500 hover:bg-stone-100 disabled:opacity-30"><ArrowRight className="size-4" /></button>
                  </span>
                  <span className="flex">
                    <button aria-label={img.isPublished ? "Hide from website" : "Show on website"} title={img.isPublished ? "Hide from website" : "Show on website"} onClick={() => patch.mutate({ id: img.id, isPublished: !img.isPublished })} className="rounded p-1.5 text-stone-500 hover:bg-stone-100">
                      {img.isPublished ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    </button>
                    <button aria-label="Delete photo" onClick={() => setDeleting(img)} className="rounded p-1.5 text-stone-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button>
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Confirm open={Boolean(deleting)} onClose={() => setDeleting(null)} title="Delete this photo?" danger confirmLabel="Delete" loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting.id)} body="It will be removed from your website and from image storage. This can't be undone." />
    </div>
  );
}
