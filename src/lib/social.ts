"use client";

// Social panel helpers: photo upload (public bucket so Meta and X can fetch it) and calls to the
// `social` Edge Function, which holds the account tokens. See supabase/functions/social/README.md.
import { supabase } from "@/lib/supa/client";

export type Net = "facebook" | "instagram" | "x";
export const NETS: { id: Net; label: string }[] = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "x", label: "X" },
];
export type Media = { url: string; path: string; type: "image" };
export type NetResult = { id?: string; url?: string; error?: string };
export type Post = {
  id: string; body: string; media: Media[]; networks: Net[];
  status: "draft" | "scheduled" | "publishing" | "published" | "partial" | "failed";
  scheduledAt: string | null; results: Partial<Record<Net, NetResult>>; by: string | null; createdAt: string; publishedAt: string | null;
};
export type InboxItem = {
  id: string; network: Net; kind: "comment" | "dm" | "mention"; thread: string | null; authorName: string | null;
  authorHandle: string | null; body: string; postId: string | null; fromUs: boolean; at: string; read: boolean;
  repliedAt: string | null; repliedBy: string | null;
};
export type Account = { ok: boolean; name?: string; url?: string; error?: string };
export type SocialData = {
  posts: Post[]; inbox: InboxItem[]; unread: number;
  accounts: Partial<Record<Net, Account>> & { checkedAt?: string };
  errors: Record<string, string>;
};

// Instagram only takes JPEG, and big phone photos are slow to send: resize to 2048px and re-encode.
async function toJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("Couldn't read that photo."))), "image/jpeg", 0.9));
}

export async function uploadPhoto(file: File): Promise<Media> {
  if (!file.type.startsWith("image/")) throw new Error("Photos only for now.");
  const blob = await toJpeg(file);
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
  const bucket = supabase().storage.from("social-media");
  const { error } = await bucket.upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error(error.message);
  return { url: bucket.getPublicUrl(path).data.publicUrl, path, type: "image" };
}

export async function social<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().functions.invoke<T & { error?: string }>("social", { body });
  if (error) {
    const b = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(b?.error ?? "Couldn't reach the social service. Is it deployed?");
  }
  return data as T;
}
