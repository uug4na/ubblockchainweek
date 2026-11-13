"use client";

import { useEffect, useState } from "react";
import { DoorOpen, Users } from "lucide-react";
import { usePolling } from "@/lib/usePolling";
import { page } from "@/lib/base";
import { site } from "@/data/site";
import { QrCode } from "@/components/QrCode";

type Door = { code: string; refreshAt: number; now: number; inToday: number };

// The live entrance code. Hold this phone up at the door: attendees scan it to come in.
// It changes every 30 s (a code works for about 2 minutes), so a photo shared in a group chat is no use.
export default function DoorPage() {
  const { data, error } = usePolling<Door>("/api/rpc/staff_door_code", 5_000);
  const [origin, setOrigin] = useState("");
  const [left, setLeft] = useState(30);
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (!data) return;
    const skew = data.now - Date.now();
    const tick = () => setLeft(Math.max(0, Math.ceil((data.refreshAt - (Date.now() + skew)) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [data]);

  return (
    <div className="reward-show">
      <article className="poster reward-poster">
        <div className="poster-top"><span>{site.short}</span><span>Entrance</span></div>
        <h2>Scan to come in</h2>
        <div className="poster-qr">
          {origin && data ? (
            <QrCode value={`${origin}${page("/app/scan")}?c=${encodeURIComponent(data.code)}`} size={300} label="Live entrance QR" />
          ) : (
            <div style={{ width: 300, height: 300 }} aria-busy="true" />
          )}
        </div>
        <p className="poster-cta"><DoorOpen size={18} /> Open the {site.short} app → Scan, or use the phone camera</p>
        <code className="poster-code">New code in {left}s · show the green &ldquo;You&apos;re in&rdquo; screen</code>
      </article>
      {error && <p className="form-error no-print" role="alert">{error}</p>}
      <div className="no-print rw-live">
        <Users size={16} /> <b>{data ? data.inToday.toLocaleString("en-US") : "–"}</b> in today
      </div>
    </div>
  );
}
