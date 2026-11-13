"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CircleCheck, CircleAlert, UserPlus, Star, Handshake } from "lucide-react";
import { QrScanner } from "@/components/QrScanner";
import { InPass } from "@/components/InPass";
import { AuthPanel } from "@/components/AuthPanel";
import { api, setMe, useMe, type Me } from "@/lib/me";
import { useContacts } from "@/lib/store";
import { parseCode } from "@/lib/codes";
import { sessionById } from "@/data/schedule";
import { page } from "@/lib/base";
import { haptic } from "@/lib/haptics";
import { fireBurst } from "@/lib/burst";

const PENDING = "ubbw.pendingScan";

type Person = { id: string; name: string; handle: string; about: string; interests: string[] };
type Result =
  | { kind: "checkin"; title: string; room: string; stars: number; already: boolean }
  | { kind: "person"; person: Person }
  | { kind: "entry"; at: number; stars: number }
  | { kind: "meet"; person: Person; code: { id: string; w: number; sig: string }; connected: boolean }
  | { kind: "met"; person: Person; status: "requested" | "connected"; stars?: number; bonus?: boolean }
  | { kind: "error"; message: string };

export default function ScanPage() {
  const { status, me } = useMe();
  const [contacts, setContacts] = useContacts();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [note, setNote] = useState("");
  const fromUrl = useRef(false);

  const handle = useCallback(
    async (text: string) => {
      const scanned = parseCode(text);
      setBusy(true);
      setNote("");
      try {
        if (!scanned) throw new Error("That isn't a UBBW code. Look for the toono posters at each room's door.");
        if (scanned.kind === "claim") throw new Error("That's a merch claim — show it at the merch desk.");
        if (scanned.kind === "meet") {
          const r = await api<{ person: Person; connected: boolean }>("/api/rpc/app_meet_peek", { pass_code: scanned.id, w: scanned.w, sig: scanned.sig });
          setResult({ kind: "meet", person: r.person, code: { id: scanned.id, w: scanned.w, sig: scanned.sig }, connected: r.connected });
          haptic.success();
          return;
        }
        if (scanned.kind === "user") {
          if (scanned.id === me?.user.id) throw new Error("That's your own pass.");
          const person = await api<Person>(`/api/people/${scanned.id}`);
          setResult({ kind: "person", person });
          haptic.success();
          return;
        }
        const res = await api<Me & { result: { session?: string; reward?: string; entry?: boolean; title?: string; stars: number; already: boolean; at?: number } }>("/api/me/checkin", { code: text });
        setMe(res);
        if (res.result.entry) {
          setResult({ kind: "entry", at: res.result.at ?? Date.now(), stars: res.result.stars });
          window.scrollTo({ top: 0, behavior: "smooth" });
          if (res.result.stars > 0) haptic.reward();
          else haptic.success();
        } else if (res.result.reward) {
          setResult({ kind: "checkin", title: res.result.title ?? "Reward", room: "Reward", stars: res.result.stars, already: res.result.already });
          if (res.result.stars > 0) haptic.reward();
          else haptic.success();
        } else {
          // the database can know a session the bundled schedule doesn't (added after this build)
          const s = sessionById[res.result.session!];
          setResult({ kind: "checkin", title: s?.title ?? res.result.title ?? "Session", room: s?.room ?? "", stars: res.result.stars, already: res.result.already });
          if (res.result.stars > 0) haptic.reward();
          else haptic.success();
        }
      } catch (e) {
        setResult({ kind: "error", message: (e as Error).message });
        haptic.error();
      } finally {
        setBusy(false);
      }
    },
    [me?.user.id],
  );

  // Phone cameras open poster / reward URLs straight into this page: /app/scan/?c=UBBW:E:…
  // If they're not signed in on this browser yet (common: the camera opens the browser, not
  // the home-screen app), keep the code through sign-in — Google sends them back without it.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c");
    try {
      if (c) localStorage.setItem(PENDING, JSON.stringify({ c, at: Date.now() }));
      const saved = JSON.parse(localStorage.getItem(PENDING) ?? "null") as { c: string; at: number } | null;
      // A code left over for more than 30 minutes is stale — the poster's window has likely moved on.
      if (saved && Date.now() - saved.at < 30 * 60_000) setPending(saved.c);
      else localStorage.removeItem(PENDING);
    } catch {
      if (c) setPending(c);
    }
    if (c) window.history.replaceState(null, "", page("/app/scan"));
  }, []);
  useEffect(() => {
    if (status !== "in" || !pending || fromUrl.current) return;
    fromUrl.current = true;
    try { localStorage.removeItem(PENDING); } catch {}
    handle(pending);
  }, [status, pending, handle]);

  async function connect(r: Extract<Result, { kind: "meet" }>) {
    setBusy(true);
    try {
      const res = await api<Me & { result: { status: "requested" | "connected"; stars?: number; bonus?: boolean } }>("/api/rpc/app_meet_request", { pass_code: r.code.id, w: r.code.w, sig: r.code.sig });
      setMe(res);
      setResult({ kind: "met", person: r.person, status: res.result.status, stars: res.result.stars, bonus: res.result.bonus });
      if (res.result.status === "connected" && res.result.stars) {
        haptic.reward();
        fireBurst(window.innerWidth / 2, window.innerHeight * 0.45, res.result.bonus ? "jackpot" : "win");
      }
      else haptic.success();
    } catch (e) {
      setResult({ kind: "error", message: (e as Error).message });
      haptic.error();
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") return null;
  if (status === "out")
    return (
      <AuthPanel
        title={pending ? "Sign in to collect your stars" : "Sign in to check in"}
        lead={pending ? "You scanned a UBBW code. Sign in and we'll check you in straight away." : "Scanning session posters earns stars. You'll need a pass first."}
      />
    );

  const known = result?.kind === "person" && contacts.some((c) => c.code === result.person.id);

  return (
    <>
      <span className="eyebrow">Scan</span>
      <h1 className="app-h1">Point it at a poster.</h1>
      <p className="app-sub">Entrance, session posters, rewards, friends.</p>

      {me && !me.user.verifiedAt && (
        <div className="notice-card">
          <CircleAlert size={20} />
          <p>Scan the <b>entrance QR</b> first.</p>
        </div>
      )}

      {/* At the door the green screen is the whole point — show it first, camera tucked away. */}
      {result?.kind === "entry" && me && (
        <div className="entry-view">
          <InPass name={me.user.name} pass={me.user.id} since={result.at} welcomeStars={result.stars} />
          <button className="btn btn-ghost wide" onClick={() => setResult(null)}>Done — scan something else</button>
        </div>
      )}
      <div className="scan-layout" style={result?.kind === "entry" ? { display: "none" } : undefined}>
        <QrScanner onResult={handle} busy={busy} manualLabel="Or type the code" manualPlaceholder="UBBW:E:…" />

        <div aria-live="polite">
          {result?.kind === "meet" && (
            <div className="scan-result">
              <Handshake size={28} />
              <h2>{result.person.name}</h2>
              <p>{[result.person.handle, result.person.about].filter(Boolean).join(" · ") || "No bio yet"}</p>
              {result.person.interests.length > 0 && <p className="muted small">Here for {result.person.interests.join(", ")}</p>}
              {result.connected ? (
                <p className="muted">You&apos;re already connected.</p>
              ) : (
                <div className="scan-result-actions">
                  <button className="btn btn-clay" disabled={busy} onClick={() => connect(result)}>Connect</button>
                  <button className="btn btn-ghost" onClick={() => setResult(null)}>Not now</button>
                </div>
              )}
            </div>
          )}
          {result?.kind === "met" && (
            <div className={`scan-result ${result.status === "connected" && result.stars ? "is-win" : ""}`}>
              <Handshake size={28} />
              {result.status === "connected" ? (
                <>
                  <h2>{result.stars ? <><Star size={24} fill="currentColor" /> +{result.stars} stars</> : "Connected"}</h2>
                  <p>You and <b>{result.person.name}</b> are connected{result.bonus ? " — different worlds, ×2!" : "."}</p>
                </>
              ) : (
                <>
                  <h2>Request sent</h2>
                  <p>Waiting for <b>{result.person.name}</b> to accept on their phone. You&apos;ll both get stars.</p>
                </>
              )}
              <div className="scan-result-actions">
                <Link href="/app/games/meet" className="btn btn-primary">My connections</Link>
                <button className="btn btn-ghost" onClick={() => setResult(null)}>Scan another</button>
              </div>
            </div>
          )}
          {result?.kind === "checkin" && (
            <div className={`scan-result ${result.already ? "" : "is-win"}`}>
              <CircleCheck size={30} />
              {result.already ? <h2>{result.room === "Reward" ? "Already claimed" : "Already checked in"}</h2> : <h2><Star size={26} fill="currentColor" /> +{result.stars} stars</h2>}
              <p><b>{result.title}</b><br />{result.room}</p>
              <div className="scan-result-actions">
                <Link href="/app/stars" className="btn btn-primary">See my stars</Link>
                <button className="btn btn-ghost" onClick={() => setResult(null)}>Scan another</button>
              </div>
            </div>
          )}
          {result?.kind === "person" && (
            <div className="scan-result">
              <UserPlus size={28} />
              <h2>{result.person.name}</h2>
              <p>{[result.person.handle, result.person.about].filter(Boolean).join(" · ") || "No bio yet"}</p>
              {known ? (
                <p className="muted">You already have a note on them. See it under ⓘ in your chat.</p>
              ) : (
                <form
                  className="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setContacts((p) => [{ code: result.person.id, name: result.person.name, note: note.trim(), at: Date.now() }, ...p]);
                    setResult(null);
                  }}
                >
                  <div className="field">
                    <label htmlFor="pnote">Note to self</label>
                    <input id="pnote" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Met at the khuushuur table" />
                  </div>
                  <button className="btn btn-clay" type="submit">Save note</button>
                </form>
              )}
            </div>
          )}
          {result?.kind === "error" && (
            <div className="scan-result is-error">
              <CircleAlert size={28} />
              <p>{result.message}</p>
              <button className="btn btn-ghost" onClick={() => setResult(null)}>Try again</button>
            </div>
          )}
          {!result && (
            <div className="scan-hint">
              <b>{me?.attended.length ?? 0}</b>
              <span>sessions checked in</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
