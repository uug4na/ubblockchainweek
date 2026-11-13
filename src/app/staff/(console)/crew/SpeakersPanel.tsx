"use client";

import { useState } from "react";
import { Mic, X, Plus } from "lucide-react";
import { api } from "@/lib/me";
import { usePolling } from "@/lib/usePolling";

type Speaker = { email: string; name: string; joined: boolean };
type Res = { speakers: Speaker[] };

// Speakers, by the email they sign in to the app with: meeting one in Proof of Meet pays the speaker/crew multiplier (meet_vip_mult).
// (Crew members count too, straight from the crew list.)
export function SpeakersPanel() {
  const { data, error, setData } = usePolling<Res>("/api/rpc/staff_speakers", 60_000);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function call(fn: string, body: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    try {
      setData(await api<Res>(`/api/rpc/${fn}`, body));
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cw-speakers">
      <div className="cw-sec-head">
        <h2 className="h-icon"><Mic size={18} /> Speakers</h2>
        <span className="muted small">Meeting one pays a bonus</span>
      </div>
      {(err || error) && <p className="form-error" role="alert">{err || error}</p>}
      {adding ? (
        <form
          className="panel form cw-add"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget));
            if (await call("staff_speaker_add", { name: f.name, email: f.email })) setAdding(false);
          }}
        >
          <div className="panel-head"><h2>Add speaker</h2><button type="button" className="icon-btn" aria-label="Close" onClick={() => setAdding(false)}><X size={18} /></button></div>
          <div className="field"><label htmlFor="s-name">Name</label><input id="s-name" name="name" required maxLength={60} autoFocus autoComplete="off" /></div>
          <div className="field"><label htmlFor="s-email">Email they use in the app</label><input id="s-email" name="email" type="email" inputMode="email" required autoCapitalize="none" autoComplete="off" spellCheck={false} /></div>
          <button className="btn btn-clay btn-lg wide" type="submit" disabled={busy}><Plus size={18} /> Add speaker</button>
        </form>
      ) : (
        <button className="btn btn-ghost btn-lg wide cw-new" onClick={() => setAdding(true)}><Plus size={18} /> Add speaker</button>
      )}
      <div className="cw-list">
        {data?.speakers.length === 0 && <p className="muted cw-none">No speakers yet.</p>}
        {data?.speakers.map((s) => (
          <article className="cw-card" key={s.email}>
            {removing === s.email ? (
              <div className="cw-body cw-confirm">
                <p>Remove <b>{s.name}</b> from speakers?</p>
                <div className="cw-btns">
                  <button className="btn btn-ghost" onClick={() => setRemoving(null)}>Keep</button>
                  <button className="btn rw-end-yes" disabled={busy} onClick={async () => { if (await call("staff_speaker_remove", { email: s.email })) setRemoving(null); }}>Remove</button>
                </div>
              </div>
            ) : (
              <div className="cw-head is-static">
                <span className="att-avatar cw-av" style={{ ["--h" as string]: 280 }}><Mic size={16} /></span>
                <span className="cw-who"><b>{s.name}</b><small>{s.email}</small><small>{s.joined ? "Has a pass" : "No pass yet"}</small></span>
                <button className="btn btn-ghost cw-remove cw-x" onClick={() => setRemoving(s.email)}>Remove</button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
