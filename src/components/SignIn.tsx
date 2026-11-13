"use client";

import { useState } from "react";
import { Mail, ArrowLeft } from "lucide-react";
import { supabase, supabaseReady } from "@/lib/supa/client";

// Attendees use Google only; crew use a one-time code by email only (method="code").
export function SignIn({ onSignedIn, method = "google" }: { onSignedIn?: () => void; method?: "google" | "code" }) {
  const [step, setStep] = useState<"start" | "code">("start");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"" | "google" | "send" | "verify">("");
  const [error, setError] = useState("");

  if (!supabaseReady) return <p className="form-error">Sign-in isn't connected yet. (Missing Supabase keys in this build.)</p>;

  async function google() {
    setBusy("google");
    setError("");
    // Come back to the page they started on; Supabase finishes the sign-in when it loads.
    const back = window.location.origin + window.location.pathname;
    const { error } = await supabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: back } });
    if (error) {
      setError(error.message);
      setBusy("");
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy("send");
    setError("");
    const { error } = await supabase().auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
    setBusy("");
    if (error) return setError(/rate/i.test(error.message) ? "Too many codes sent — wait a minute and try again." : error.message);
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy("verify");
    setError("");
    const { error } = await supabase().auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
    setBusy("");
    if (error) return setError(/expired|invalid/i.test(error.message) ? "That code didn't work — check it or send a new one." : error.message);
    onSignedIn?.();
  }

  return (
    <div className="signin">
      {step === "start" ? (
        <>
          {method === "google" ? (
            <button className="btn btn-lg google-btn" onClick={google} disabled={!!busy}>
              <GoogleMark /> {busy === "google" ? "Opening Google…" : "Continue with Google"}
            </button>
          ) : (
            <form className="form" onSubmit={send}>
              <div className="field">
                <label htmlFor="si-email">Email</label>
                <input id="si-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <button className="btn btn-primary btn-lg" type="submit" disabled={!!busy}>
                <Mail size={18} /> {busy === "send" ? "Sending…" : "Email me a code"}
              </button>
            </form>
          )}
        </>
      ) : (
        <form className="form" onSubmit={verify}>
          <p className="muted">We sent a code to <b>{email}</b>. It can take a minute — check spam too.</p>
          <div className="field">
            <label htmlFor="si-code">Code</label>
            <input
              id="si-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6,10}"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="code-input"
            />
          </div>
          <button className="btn btn-clay btn-lg" type="submit" disabled={!!busy}>{busy === "verify" ? "Checking…" : "Sign in"}</button>
          <button type="button" className="link-btn back-link" onClick={() => { setStep("start"); setCode(""); setError(""); }}>
            <ArrowLeft size={14} /> Use a different email
          </button>
        </form>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
