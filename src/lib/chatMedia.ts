"use client";

// Photos and GIFs in network chat (supabase/migrations/0034_chat_media.sql).
// Photos: shrunk on the phone, uploaded to the private chat-photos bucket under <pair folder>/<my id>/,
// shown through short-lived signed links. GIFs: searched on GIPHY; only the GIPHY id is sent.
import { supabase } from "@/lib/supa/client";
import { shrink } from "@/lib/shots";

const BUCKET = "chat-photos";
export const GIPHY_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? "";

export async function uploadChatPhoto(folder: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Pick a photo.");
  const { data } = await supabase().auth.getUser();
  if (!data.user) throw new Error("Sign in first.");
  const path = `${folder}/${data.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase().storage.from(BUCKET).upload(path, await shrink(file), { contentType: "image/jpeg" });
  if (error) throw new Error("Upload failed. Check your signal and try again.");
  return path;
}

// Signed links for a thread's photos (1 hour).
export async function chatPhotoUrls(paths: string[]) {
  if (!paths.length) return {} as Record<string, string>;
  const { data } = await supabase().storage.from(BUCKET).createSignedUrls(paths, 3600);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl]));
}

export const gifUrl = (id: string, size: "200w" | "giphy" = "200w") => `https://media.giphy.com/media/${id}/${size}.gif`;

export type Gif = { id: string; title: string; preview: string; w: number; h: number };

export async function searchGifs(q: string): Promise<Gif[]> {
  if (!GIPHY_KEY) throw new Error("The GIF library isn't set up yet.");
  const base = q.trim()
    ? `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(q.trim())}&`
    : "https://api.giphy.com/v1/gifs/trending?";
  const res = await fetch(`${base}api_key=${GIPHY_KEY}&limit=24&rating=pg-13`);
  if (!res.ok) throw new Error("Couldn't load GIFs. Try again.");
  const { data } = (await res.json()) as { data: { id: string; title: string; images: { fixed_width_small: { url: string; width: string; height: string } } }[] };
  return data.map((g) => ({ id: g.id, title: g.title, preview: g.images.fixed_width_small.url, w: +g.images.fixed_width_small.width, h: +g.images.fixed_width_small.height }));
}
