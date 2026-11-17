"use client";

// Apple Wallet: ask the wallet-pass Edge Function (signed in) for a 5-minute link to this person's signed .pkpass,
// then let Safari open it — Wallet shows its "Add" sheet. See supabase/functions/wallet-pass/README.md.
import { supabase } from "@/lib/supa/client";

export const canUseWallet = () =>
  typeof navigator !== "undefined" && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

export async function addToAppleWallet() {
  const { data, error } = await supabase().functions.invoke<{ url?: string; error?: string }>("wallet-pass", { body: {} });
  if (error) {
    // the function's own message ("Sign in first.", "Apple Wallet isn't set up yet.") when there is one
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(body?.error ?? "Couldn't reach Apple Wallet. Check your signal and try again.");
  }
  if (!data?.url) throw new Error(data?.error ?? "Couldn't make the Wallet pass. Try again.");
  window.location.href = data.url;
}
