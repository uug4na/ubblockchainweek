"use client";

import Link from "next/link";
import { ChevronRight, Gift, GraduationCap, Megaphone, ScanLine, Star, Trophy } from "lucide-react";
import { site } from "@/data/site";
import { sessions, sessionTime } from "@/data/schedule";
import { useMe, type Me } from "@/lib/me";
import { merch, DESK_STARS, starsFor } from "@/data/rewards";
import { StarChip } from "@/components/AppShell";
import { InstallPrompt } from "@/components/Pwa";
import { InPass } from "@/components/InPass";
import { useMerchCatalog } from "@/lib/merchCatalog";
import { useNow } from "@/lib/time";
import { IsoArt } from "@/components/iso/IsoArt";
import stopwatchArt from "@/components/iso/figures/minis/stopwatch";

const start = new Date(site.startISO).getTime();
const end = new Date(site.endISO).getTime();

const announcements = [
  { when: "Oct 18", text: "Stars are live: check in, do tasks, swap for merch." },
  { when: "Oct 16", text: "The app is live." },
  { when: "Oct 02", text: "Student travel grants open with registration." },
];

function PassStatus({ me }: { me: Me }) {
  useMerchCatalog();
  if (!me.user.verifiedAt)
    return (
      <section className="pass-strip is-todo">
        <ScanLine size={26} />
        <div>
          <b>Check in at the door</b>
          <span>Scan the entrance QR · +{DESK_STARS}★</span>
        </div>
        <Link href="/app/scan" className="btn btn-primary">Scan</Link>
      </section>
    );
  const mine = me.claims.find((c) => c.status !== "cancelled" && c.source === "swap");
  const mineItem = mine && merch.find((m) => m.id === mine.itemId);
  if (mine && mineItem)
    return (
      <section className="pass-strip">
        <StarChip n={me.balance} />
        <div>
          <b>{mine.status === "reserved" ? `Your ${mineItem.name.toLowerCase()} is waiting` : `You collected the ${mineItem.name.toLowerCase()}`}</b>
          <span>{mine.status === "reserved" ? "Show the QR at the merch desk" : `${me.attended.length} sessions`}</span>
        </div>
        <Link href="/app/merch" className="btn btn-ghost">{mine.status === "reserved" ? "Show QR" : "Merch"}</Link>
      </section>
    );
  const next = merch.filter((m) => m.cost > me.balance).sort((a, b) => a.cost - b.cost)[0];
  return (
    <section className="pass-strip">
      <StarChip n={me.balance} />
      <div>
        <b>{next ? `${next.cost - me.balance} more for the ${next.name.toLowerCase()}` : "You can afford anything on the shelf"}</b>
        <span>{me.attended.length} session{me.attended.length === 1 ? "" : "s"}</span>
      </div>
      <Link href="/app/merch" className="btn btn-ghost">Merch</Link>
    </section>
  );
}

// Before the clock is read (first paint) the boxes are already there, so the card never jumps.
function Countdown({ now }: { now: number | null }) {
  const diff = now == null ? 0 : Math.max(0, start - now);
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const n = (v: number) => (now == null ? "–" : v);
  return (
    <div className="countdown-nums" aria-label={now == null ? undefined : `${d} days ${h} hours ${m} minutes to go`}>
      <div><b>{n(d)}</b><span>days</span></div>
      <div><b>{n(h)}</b><span>hours</span></div>
      <div><b>{n(m)}</b><span>min</span></div>
    </div>
  );
}

export default function AppHome() {
  const now = useNow();
  const { status, me } = useMe();

  const phase = now == null ? "loading" : now < start ? "before" : now > end ? "after" : "during";
  const live = now == null ? [] : sessions.filter((s) => { const t = sessionTime(s); return t.start <= now && now < t.end; });

  const firstName = me?.user.name.trim().split(" ")[0];

  return (
    <>
      <h1 className="app-h1">Hello{firstName ? `, ${firstName}` : ""}.</h1>
      <InstallPrompt app="attendee" />

      <section className="countdown">
        <IsoArt mini={stopwatchArt} width={150} className="countdown-art" />
        <div style={{ position: "relative" }}>
          {phase === "during" ? (
            <>
              <h2>The week is on.</h2>
              <p>{live.length ? `${live.length} thing${live.length > 1 ? "s" : ""} happening right now.` : "Between sessions — grab a tea."}</p>
            </>
          ) : phase === "after" ? (
            <>
              <h2>Баярлалаа. That was the week.</h2>
              <p>Thank you for building it with us. See you next year.</p>
            </>
          ) : (
            <>
              <h2>Doors open soon.</h2>
              <p>{site.dates} · {site.city}</p>
            </>
          )}
        </div>
        {(phase === "before" || phase === "loading") && <Countdown now={now} />}
      </section>

      {me?.inToday && <div style={{ marginTop: 16 }}><InPass name={me.user.name} pass={me.user.id} since={me.inToday} /></div>}
      {me ? (
        <PassStatus me={me} />
      ) : status === "out" ? (
        <section className="pass-strip is-todo">
          <Star size={26} />
          <div>
            <b>Get your pass</b>
            <span>Your door QR and stars</span>
          </div>
          <Link href="/app/profile" className="btn btn-clay">Get pass</Link>
        </section>
      ) : null}

      <div className="quick">
        <Link href="/app/scan"><ScanLine size={22} /><span>Scan<small>Posters</small></span></Link>
        <Link href="/app/stars"><Star size={22} /><span>Earn stars<small>Tasks</small></span></Link>
        <Link href="/app/merch"><Gift size={22} /><span>Merch<small>Limited</small></span></Link>
      </div>

      {/* The two competitions, each its own section */}
      <nav className="settings-group home-compete" aria-label="Compete">
        <Link href="/app/hack"><i className="tile t-klein"><Trophy size={18} /></i><span>Hackathon<small>UB Hack · ₮15.5M</small></span><ChevronRight size={18} /></Link>
        <Link href="/app/research"><i className="tile t-fushia"><GraduationCap size={18} /></i><span>Research conference<small>The Future of Money · ₮3M</small></span><ChevronRight size={18} /></Link>
      </nav>

      {live.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Happening now</h2></div>
          <div className="mini-list">
            {live.map((s) => (
              <div className="mini" key={s.id}>
                <time>{s.start}</time>
                <div>
                  <b>{s.title}</b>
                  <span>
                    {s.room ? `${s.room} · ` : ""}
                    {me?.attended.includes(s.id) ? "checked in" : <Link href="/app/scan" className="inline-link">scan the poster for {starsFor(s)} stars</Link>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head"><h2>News</h2></div>
        <div className="mini-list">
          {announcements.map((a) => (
            <div className="mini" key={a.text}>
              <time>{a.when}</time>
              <div style={{ display: "flex", gap: 10 }}>
                <Megaphone size={16} style={{ flex: "none", marginTop: 3, color: "var(--clay)" }} />
                <span style={{ fontSize: 15, color: "var(--ink-2)" }}>{a.text}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

    </>
  );
}
