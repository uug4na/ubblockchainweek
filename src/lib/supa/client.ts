"use client";

// The browser's Supabase client: sign-in (Google, email code) and calls to the app's
// database functions. Uses the public publishable/anon key — every rule is enforced
// inside the database functions (supabase/migrations/0002_app.sql).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const supabaseReady = !!(URL_ && KEY);

let client: SupabaseClient | undefined;
export function supabase() {
  if (!supabaseReady) throw new Error("The app isn't connected to its database yet (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).");
  client ??= createClient(URL_, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce", storageKey: "ubbw.auth" },
  });
  return client;
}
