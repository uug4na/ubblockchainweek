"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { api } from "@/lib/me";
import { withBase, page } from "@/lib/base";
import { sessionById } from "@/data/schedule";
import { days, site } from "@/data/site";
import { starsFor } from "@/data/rewards";
import { QrCode } from "@/components/QrCode";
import { PrintButton } from "./PrintButton";
import { IsoArt } from "@/components/iso/IsoArt";
import printerArt from "@/components/iso/figures/minis/printer";

type Res = { day: string; entrance: string; posters: { sessionId: string; code: string }[] };

// One poster per session, for the door. The QR is a link to the app's scan page,
// so a phone's built-in camera works as well as the in-app scanner.
export function PostersView() {
  const [day, setDay] = useState(days[0].date);
  const [data, setData] = useState<Res | null>(null);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin + withBase("")), []);
  useEffect(() => {
    setData(null);
    api<Res>(`/api/staff/posters?day=${day}`).then(setData).catch((e) => setError(e.message));
  }, [day]);

  return (
    <>
      <div className="staff-head no-print">
        <div>
          <span className="eyebrow">Session posters</span>
          <h1 className="app-h1">Posters</h1>
          <p className="muted">The entrance code is live on Door, not printed.</p>
        </div>
        <PrintButton />
      </div>
      <div className="day-tabs no-print" style={{ marginBottom: 24 }}>
        {days.map((d) => (
          <button key={d.date} onClick={() => setDay(d.date)} className={`day-tab ${d.date === day ? "is-on" : ""}`}>
            <small>{d.weekday}</small>
            <b>{d.short}</b>
          </button>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="posters">
        {origin && data?.entrance && (
          <article className="poster is-entrance" key="entrance">
            <IsoArt mini={printerArt} width={140} className="poster-art" />
            <div className="poster-top"><span>{site.short}</span><span>Entrance</span></div>
            <h2>Scan to come in</h2>
            <p className="poster-when">{(() => { const d = days.find((x) => x.date === data.day); return d ? `${d.weekday} ${d.short} ${d.month} · ${d.label}` : data.day; })()} — today only</p>
            <div className="poster-qr">
              <QrCode value={`${window.location.origin}${page("/app/scan")}?c=${encodeURIComponent(data.entrance)}`} size={300} label="Entrance check-in QR" />
            </div>
            <p className="poster-cta"><Star size={18} fill="currentColor" /> Open the UBBW app → Scan, or use your phone camera</p>
            <code className="poster-code">Show the green &ldquo;You&apos;re in&rdquo; screen at the door</code>
          </article>
        )}
        {origin &&
          data?.posters.map(({ sessionId, code }) => {
            const s = sessionById[sessionId];
            return (
              <article className="poster" key={sessionId}>
                <IsoArt mini={printerArt} width={140} className="poster-art" />
                <div className="poster-top"><span>{site.short}</span><span>{s.room}</span></div>
                <h2>{s.title}</h2>
                <p className="poster-when">{days.find((d) => d.date === s.day)?.weekday} {days.find((d) => d.date === s.day)?.short} {days.find((d) => d.date === s.day)?.month} · {s.start}–{s.end === "23:59" ? "late" : s.end}</p>
                <div className="poster-qr">
                  <QrCode value={`${window.location.origin}${page("/app/scan")}?c=${encodeURIComponent(code)}`} size={260} label={`Check-in QR for ${s.title}`} />
                </div>
                <p className="poster-cta"><Star size={18} fill="currentColor" /> Scan to check in · {starsFor(s)} stars</p>
                <code className="poster-code">{code}</code>
              </article>
            );
          })}
      </div>
    </>
  );
}
