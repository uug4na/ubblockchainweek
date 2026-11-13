"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Logo } from "@/components/Toono";
import { SignIn } from "@/components/SignIn";
import { api } from "@/lib/me";
import { supabase, supabaseReady } from "@/lib/supa/client";
import { page } from "@/lib/base";
import { IsoArt } from "@/components/iso/IsoArt";
import vaultArt from "@/components/iso/figures/minis/vault";

// Was this session started with an email code? (Reads the session token's sign-in methods.)
function signedInByCode(accessToken: string) {
  try {
    const b64 = accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const amr: { method?: string }[] = JSON.parse(atob(b64)).amr ?? [];
    return amr.some((a) => a.method === "otp");
  } catch {
    return false;
  }
}

// Crew sign in with an email code only (attendees use Google); the crew list (by email) decides the role.
// A Google session from the attendee app doesn't count here, so it gets the code form. The database enforces this too.
export default function StaffLogin() {
  const [state, setState] = useState<"checking" | "signin" | "not-crew">("checking");
  const [email, setEmail] = useState("");

  const check = useCallback(async () => {
    if (!supabaseReady) return setState("signin");
    const { data } = await supabase().auth.getSession();
    if (!data.session || !signedInByCode(data.session.access_token)) return setState("signin");
    setEmail(data.session.user.email ?? "");
    try {
      await api("/api/staff/me");
      window.location.replace(page("/staff"));
    } catch {
      setState("not-crew");
    }
  }, []);

  useEffect(() => {
    check();
    if (!supabaseReady) return;
    const { data } = supabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") check();
    });
    return () => data.subscription.unsubscribe();
  }, [check]);

  return (
    <main className="staff-login">
      <IsoArt mini={vaultArt} width={240} className="staff-login-art" />
      {state !== "checking" && (
        <div className="panel form staff-login-card">
          <Logo />
          {state === "signin" ? (
            <>
              <div>
                <span className="eyebrow">Staff & volunteers</span>
                <h1 className="app-h1">Crew sign-in</h1>
                <p className="muted">Use your crew email.</p>
              </div>
              <SignIn onSignedIn={check} method="code" />
            </>
          ) : (
            <>
              <div className="not-crew">
                <ShieldAlert size={28} />
                <h1 className="app-h1">Not on the crew yet</h1>
                <p className="muted">
                  <b>{email}</b> isn&apos;t on the crew list. Ask an admin.
                </p>
              </div>
              <button className="btn btn-primary" onClick={check}>I&apos;ve been added — try again</button>
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  await supabase().auth.signOut();
                  setState("signin");
                }}
              >
                Use a different account
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}
