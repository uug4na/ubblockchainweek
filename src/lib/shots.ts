"use client";

// Task screenshots: shrunk on the phone (long side 1600px, JPEG) and uploaded to the private
// task-proofs bucket under the person's own folder. Crew leads read them to review.
import { supabase } from "@/lib/supa/client";

const BUCKET = "task-proofs";
const MAX = 1600;

export async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close();
  return new Promise((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("Couldn't read that image."))), "image/jpeg", 0.82));
}

export async function uploadShot(taskId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Pick a screenshot (an image).");
  const { data } = await supabase().auth.getUser();
  if (!data.user) throw new Error("Sign in first.");
  const path = `${data.user.id}/${taskId}-${Date.now()}.jpg`;
  const { error } = await supabase().storage.from(BUCKET).upload(path, await shrink(file), { contentType: "image/jpeg" });
  if (error) throw new Error("Upload failed. Check your signal and try again.");
  return path;
}

// Short-lived links for the crew review screen (10 minutes).
export async function shotUrls(paths: string[]) {
  if (!paths.length) return {} as Record<string, string>;
  const { data } = await supabase().storage.from(BUCKET).createSignedUrls(paths, 600);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl]));
}
