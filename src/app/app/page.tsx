"use client";

import Link from "next/link";
import { ChevronRight, Gift, GraduationCap, ScanLine, Star, Trophy } from "lucide-react";
import { site } from "@/data/site";
import { sessions, sessionTime } from "@/data/schedule";
import { useMe, type Me } from "@/lib/me";
import { merch, DESK_STARS, starsFor } from "@/data/rewards";
import { StarChip } from "@/components/AppShell";
import { InstallPrompt } from "@/components/Pwa";
import { InPass } from "@/components/InPass";
import { HACK_DETAILS_PUBLIC, HACK_SECTION_OPEN } from "@/data/hackathon";
import { useMerchCatalog } from "@/lib/merchCatalog";
import { MERCH_OPEN, STARS_OPEN } from "@/data/open";
import { useNow } from "@/lib/time";
import { IsoArt } from "@/components/iso/IsoArt";
import stopwatchArt from "@/components/iso/figures/minis/stopwatch";
import { PartnerWheel, PinnedPartners } from "@/components/PartnerWheel";

const start = new Date(site.startISO).getTime();
const end = new Date(site.endISO).getTime();

// "Mon 30 Nov" for a session's day, in Ulaanbaatar time.
const dayLabel = (d: string) => new Date(`${d}T12:00:00+08:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: site.tz });

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
  // Merch is closed for now: no strip at all (owner, 18 Nov: "Your stars are saved" was unnecessary).
  if (!MERCH_OPEN) return null;
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
  // Home › Agenda: the next four sessions that haven't ended yet.
  const next = sessions.filter((s) => now == null || sessionTime(s).end > now).sort((a, b) => sessionTime(a).start - sessionTime(b).start).slice(0, 4);

  return (
    <>
      <h1 className="app-h1 home-h1">Welcome to UB Blockchain Week{firstName ? `, ${firstName}` : ""}.</h1>
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
        <PinnedPartners />
      </section>

      <PartnerWheel />

      {/* PC (>=1100px): main column left, shortcuts rail right. Phones: the wrappers vanish (display: contents). */}
      <div className="desk is-home">
      <div className="desk-main">

      {me?.inToday && <div style={{ marginTop: 16 }}><InPass name={me.user.name} pass={me.user.id} since={me.inToday} /></div>}
      {me ? (
        <PassStatus me={me} />
      ) : status === "out" ? (
        <section className="pass-strip is-todo">
          <Star size={26} />
          <div>
            <b>Get your UB Blockchain Passport</b>
            <span>Your door QR and stars</span>
          </div>
          <Link href="/app/profile" className="btn btn-clay">Get Passport</Link>
        </section>
      ) : null}
      </div>

      <div className="desk-rail">
      <div className="quick">
        <Link href="/app/scan"><ScanLine size={22} /><span>Scan<small>Posters</small></span></Link>
        <Link href="/app/stars"><Star size={22} /><span>Earn stars<small>{STARS_OPEN ? "Tasks" : "Soon"}</small></span></Link>
        <Link href="/app/merch"><Gift size={22} /><span>Merch<small>{MERCH_OPEN ? "Limited" : "Soon"}</small></span></Link>
      </div>

      {/* The two competitions, each its own section */}
      <nav className="settings-group home-compete" aria-label="Compete">
        {HACK_SECTION_OPEN && <Link href="/app/hack"><i className="tile t-klein"><Trophy size={18} /></i><span>Hackathon<small>{HACK_DETAILS_PUBLIC ? "UB Hack · ₮15.5M" : "UB Hack"}</small></span><ChevronRight size={18} /></Link>}
        <Link href="/app/research"><i className="tile t-fushia"><GraduationCap size={18} /></i><span>Research conference<small>The Future of Money · ₮3M</small></span><ChevronRight size={18} /></Link>
      </nav>
      </div>

      <div className="desk-main is-low">
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
        <div className="panel-head"><h2>Agenda</h2><Link href="/app/agenda" className="inline-link">See all</Link></div>
        <div className="mini-list">
          {next.map((s) => (
            <Link href="/app/agenda" className="mini" key={s.id}>
              <time>{s.start}</time>
              <div>
                <b>{s.title}</b>
                <span>{dayLabel(s.day)}{s.room ? ` · ${s.room}` : ""}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      </div>
      </div>
    </>
  );
}
