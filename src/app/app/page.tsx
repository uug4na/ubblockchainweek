"use client";

import Link from "next/link";
import { Bookmark, ChevronRight, Gift, GraduationCap, ScanLine, Star, Trophy } from "lucide-react";
import { site } from "@/data/site";
import { sessions, sessionTime } from "@/data/schedule";
import { useMe, type Me } from "@/lib/me";
import { merch, DESK_STARS, starsFor } from "@/data/rewards";
import { StarChip } from "@/components/AppShell";
import { InstallPrompt } from "@/components/Pwa";
import { HomeSkeleton } from "@/components/Skeleton";
import { HACK_DETAILS_PUBLIC, HACK_SECTION_OPEN } from "@/data/hackathon";
import { useMerchCatalog } from "@/lib/merchCatalog";
import { useOpen } from "@/lib/open";
import { useNow } from "@/lib/time";
import { useSaved } from "@/lib/saved";
import { useEventPlaces } from "@/lib/eventPlaces";
import { IsoArt } from "@/components/iso/IsoArt";
import stopwatchArt from "@/components/iso/figures/minis/stopwatch";
import { PartnerWheel, PinnedPartners } from "@/components/PartnerWheel";
import { AppGuide } from "@/components/AppGuide";

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
          <b>Finish signing up</b>
          <span>Get your Passport · +{DESK_STARS}★</span>
        </div>
        <Link href="/app/profile" className="btn btn-primary">Open</Link>
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
  // No stars/merch strip on Home (owner, 18 Nov and again 25 Nov: "you can afford anything on the shelf" isn't wanted).
  return null;
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
  const open = useOpen();

  const phase = now == null ? "loading" : now < start ? "before" : now > end ? "after" : "during";
  const live = now == null ? [] : sessions.filter((s) => { const t = sessionTime(s); return t.start <= now && now < t.end; });

  const firstName = me?.user.name.trim().split(" ")[0];
  // Home › Agenda: the next four sessions that haven't ended yet.
  const next = sessions.filter((s) => now == null || sessionTime(s).end > now).sort((a, b) => sessionTime(a).start - sessionTime(b).start).slice(0, 4);
  // Home › My agenda: what you bookmarked in the Agenda that hasn't ended yet, soonest first.
  const saved = useSaved();
  const places = useEventPlaces();
  const mine = sessions
    .filter((s) => saved.ids.includes(s.id) && (now == null || sessionTime(s).end > now))
    .sort((a, b) => sessionTime(a).start - sessionTime(b).start);

  // Owner, 25 Nov (screen recording): on refresh Home first drew the signed-out page (no name, "— days", "Soon"),
  // then everything jumped. Wait for the Passport and the clock, in a skeleton of the same shape.
  if (status === "loading" || now == null) return <HomeSkeleton />;

  return (
    <>
      <h1 className="app-h1 home-h1">Welcome to UB Blockchain Week{firstName ? `, ${firstName}` : ""}.</h1>
      {/* floats above the tab bar: the browser only offers install a moment after load, so inline it pushed the page down */}
      <div className="install-float"><InstallPrompt app="attendee" /></div>

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

      {me ? (
        <PassStatus me={me} />
      ) : status === "out" ? (
        <section className="pass-strip is-todo">
          <Star size={26} />
          <div>
            <b>Get your UB Blockchain Passport</b>
            <span>Your QR and stars</span>
          </div>
          <Link href="/app/profile" className="btn btn-clay">Get Passport</Link>
        </section>
      ) : null}
      </div>

      <div className="desk-rail">
      <div className="quick">
        <Link href="/app/scan"><ScanLine size={22} /><span>Scan<small>Posters</small></span></Link>
        <Link href="/app/stars"><Star size={22} /><span>Earn stars<small>{open.stars ? "Tasks" : "Soon"}</small></span></Link>
        <Link href="/app/merch"><Gift size={22} /><span>Merch<small>{open.merch ? "Limited" : "Soon"}</small></span></Link>
      </div>

      {/* The two competitions, each its own section */}
      <nav className="settings-group home-compete" aria-label="Compete">
        {HACK_SECTION_OPEN && <Link href="/app/hack" className="is-special" style={{ ["--tint" as string]: "#2945d5", ["--i" as string]: 0 }}><span className="pwheel-dots compete-dots" aria-hidden="true" /><i className="tile t-klein"><Trophy size={18} /></i><span>Hackathon<small>{HACK_DETAILS_PUBLIC ? "Real World Mining · ₮5M" : "UB Hack"}</small></span><ChevronRight size={18} /></Link>}
        <Link href="/app/research" className="is-special" style={{ ["--tint" as string]: "#d415ea", ["--i" as string]: 3 }}><span className="pwheel-dots compete-dots" aria-hidden="true" /><i className="tile t-fushia"><GraduationCap size={18} /></i><span>Research conference<small>The Future of Money · ₮3M</small></span><ChevronRight size={18} /></Link>
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

      {mine.length > 0 && (
        <section className="panel my-agenda">
          <div className="panel-head"><h2>My agenda</h2><Link href="/app/agenda" className="inline-link">Edit</Link></div>
          <div className="mini-list">
            {mine.map((s) => {
              const t = sessionTime(s);
              const isLive = now != null && t.start <= now && now < t.end;
              const where = s.room || places?.[s.id]?.name || (places?.[s.id]?.mode === "online" ? "Online" : "");
              return (
                <div className={`mini ${isLive ? "is-live" : ""}`} key={s.id}>
                  <time>{s.start}</time>
                  <div>
                    <b>{s.title}</b>
                    <span>
                      {isLive ? "Now" : dayLabel(s.day)}{where ? ` · ${where}` : ""}
                      {isLive && !me?.attended.includes(s.id) && <> · <Link href="/app/scan" className="inline-link">scan for {starsFor(s)} stars</Link></>}
                      {me?.attended.includes(s.id) && " · checked in"}
                    </span>
                  </div>
                  <Bookmark size={16} fill="currentColor" className="my-agenda-mark" aria-hidden />
                </div>
              );
            })}
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

      <AppGuide />
      </div>
      </div>
    </>
  );
}
