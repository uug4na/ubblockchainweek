"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Handshake, Star, X } from "lucide-react";
import { api, setMe, useMe, type Me } from "@/lib/me";
import { haptic } from "@/lib/haptics";
import { fireBurst } from "@/lib/burst";
import type { MeetRequest } from "@/lib/types";

type Answer = Me & { result: { status: string; person?: { name: string }; stars?: number; bonus?: boolean; vip?: string | null } };

// Someone scanned my connect code → "Accept connection?" Polls while the app is open.
function useInbox(enabled: boolean, ms: number) {
  const [incoming, setIncoming] = useState<MeetRequest[]>([]);
  const load = useCallback(
    () => api<{ incoming: MeetRequest[] }>("/api/rpc/app_meet_inbox", {}).then((r) => setIncoming(r.incoming)).catch(() => {}),
    [],
  );
  useEffect(() => {
    if (!enabled) return;
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), ms);
    return () => clearInterval(t);
  }, [enabled, ms, load]);
  return { incoming, setIncoming, reload: load };
}

async function answer(r: MeetRequest, accept: boolean) {
  const res = await api<Answer>("/api/rpc/app_meet_answer", { request_id: r.requestId, accept });
  setMe(res);
  if (accept) {
    haptic.reward();
    fireBurst(window.innerWidth / 2, window.innerHeight * 0.55, "win");
  }
  return res.result;
}

function RequestCard({ r, onDone }: { r: MeetRequest; onDone: (text: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="meet-req">
      <Handshake size={22} />
      <div className="meet-req-who">
        <b>{r.name}</b>
        <span>{[r.handle, r.about].filter(Boolean).join(" · ") || "wants to connect"}</span>
      </div>
      <div className="meet-req-actions">
        <button
          className="btn btn-clay"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await answer(r, true);
              onDone(`Connected with ${r.name}${res.stars ? ` · +${res.stars} stars${res.vip ? " (speaker/crew bonus)" : res.bonus ? " (×2)" : ""}` : ""}`);
            } catch (e) {
              onDone((e as Error).message);
            }
          }}
        >
          Accept
        </button>
        <button className="icon-btn" aria-label="Decline" disabled={busy} onClick={async () => { setBusy(true); await answer(r, false).catch(() => {}); onDone(""); }}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// Inline list on the Proof of Meet page.
export function MeetInbox({ onChange }: { onChange?: () => void }) {
  const { status } = useMe();
  const { incoming, setIncoming, reload } = useInbox(status === "in", 4000);
  const [toast, setToast] = useState("");
  if (!incoming.length && !toast) return null;
  return (
    <section className="panel meet-inbox">
      {toast && <p className="toast ok"><Star size={16} fill="currentColor" /> {toast}</p>}
      {incoming.length > 0 && <div className="panel-head"><h2>Accept connection?</h2></div>}
      {incoming.map((r) => (
        <RequestCard
          key={r.requestId}
          r={r}
          onDone={(t) => {
            setIncoming((l) => l.filter((x) => x.requestId !== r.requestId));
            setToast(t);
            onChange?.();
            reload();
          }}
        />
      ))}
    </section>
  );
}

// App-wide pop-up so a request is seen whichever screen they're on.
export function MeetPrompt() {
  const { status } = useMe();
  const onMeetPage = usePathname().startsWith("/app/games/meet");
  const { incoming, setIncoming } = useInbox(status === "in" && !onMeetPage, 6000);
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (incoming.length) haptic.success();
  }, [incoming.length]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  if (onMeetPage || (!incoming.length && !toast)) return null;
  return (
    <div className="meet-sheet" role="dialog" aria-label="Connection request">
      {toast ? (
        <p className="meet-sheet-toast"><Star size={16} fill="currentColor" /> {toast}</p>
      ) : (
        <>
          <p className="meet-sheet-title">Accept connection?</p>
          <RequestCard r={incoming[0]} onDone={(t) => { setIncoming((l) => l.slice(1)); setToast(t); }} />
        </>
      )}
    </div>
  );
}
