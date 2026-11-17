"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Radio } from "lucide-react";
import { api } from "@/lib/me";
import { site } from "@/data/site";

type Live = { session: string; title: string; code: string; refreshAt: number; now: number; open: boolean };

// The stream code for an online event. Put this screen (or this browser window) on the livestream:
// viewers type the 6 digits in the app → Scan → Watching online. A new code every minute, and only the
// last few minutes' codes count, so a code passed around in a chat stops working almost at once.
export default function LivePage() {
  const [id, setId] = useState("");
  const [data, setData] = useState<Live | null>(null);
  const [error, setError] = useState("");
  const [left, setLeft] = useState(60);

  useEffect(() => setId(new URLSearchParams(window.location.search).get("s") ?? ""), []);
  const load = useCallback(() => {
    if (!id) return;
    api<Live>("/api/rpc/staff_live_code", { session_id: id }).then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 5_000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    if (!data) return;
    const skew = data.now - Date.now();
    const tick = () => setLeft(Math.max(0, Math.ceil((data.refreshAt - (Date.now() + skew)) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [data]);

  return (
    <div className="stream-show">
      <Link href="/staff/posters" className="back-link no-print"><ChevronLeft size={18} /> Posters</Link>
      <article className="stream-card">
        <div className="poster-top"><span>{site.short}</span><span><Radio size={14} /> Live</span></div>
        <h2>{data?.title ?? "Stream code"}</h2>
        <p className="stream-how">Watching online? Open the {site.short} app → Scan → type this code for stars</p>
        <b className="stream-code" aria-live="polite">{data ? `${data.code.slice(0, 3)} ${data.code.slice(3)}` : "––– –––"}</b>
        <div className="stream-bar" aria-hidden><i style={{ width: `${(left / 60) * 100}%` }} /></div>
        <small className="stream-left">New code in {left}s</small>
      </article>
      {data && !data.open && <p className="notice no-print">This event isn&apos;t live now: codes only count from 15 minutes before it starts until 30 minutes after it ends.</p>}
      {error && <p className="form-error no-print" role="alert">{error}</p>}
      {!id && <p className="form-error no-print">Open this from Posters → an online event → Stream code.</p>}
    </div>
  );
}
