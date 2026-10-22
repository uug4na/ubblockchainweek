import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { withBase } from "@/lib/base";
import { recap, week2025, stats2025, reel2025, reel2025b, hackTeams, partners2025, binanceTour } from "@/data/recap2025";
import { Marquee } from "@/components/report/Marquee";
import { TeamWall } from "@/components/report/TeamWall";
import { Room } from "@/components/report/Room";
import { PosterRing } from "@/components/report/PosterRing";
import { TokenStacker } from "@/components/iso/TokenStacker";

// The 2025 report, laid out like token2049.com/dubai/reports/2025-report: a hero over the
// landing's drifting photo block, a "peek inside" band with the token-stacker figure, then one
// chapter per event, each with its own motion (team strips, a crossfading stage, a dealt deck), a
// partner strip and a closing call for 2026. Strip pattern after Watermelon UI's team-5.

export const metadata: Metadata = {
  title: "2025 report",
  description: "UB Blockchain Week 2025 in numbers and photos: the Web3 hackathon, the student research conference, the stablecoin roundtable and the Binance campus tour.",
};

const src = (p: string, small = false) => withBase(recap(p, small));

function Figures({ items }: { items: { n: string; label: string }[] }) {
  return (
    <dl className="r-figures">
      {items.map((s) => <div key={s.label}><dt>{s.label}</dt><dd>{s.n}</dd></div>)}
    </dl>
  );
}

export default function Report2025() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="r-hero">
        <div className="t-wrap r-hero-top">
          <div>
            <p className="t-eyebrow">UB Blockchain Week · 2025 report</p>
            <h1 className="r-display">Last November<span>in Ulaanbaatar</span></h1>
            <p className="r-hero-lede">Five days, four flagship events and a city of first-timers. This is what happened.</p>
          </div>
          <dl className="r-hero-meta">
            <div><dt>When</dt><dd>{week2025.dates}</dd></div>
            <div><dt>Where</dt><dd>Ulaanbaatar</dd></div>
            <div><dt>Events</dt><dd>4 flagship</dd></div>
          </dl>
        </div>
        {/* the 2025 photo block: narrow columns drifting down / up / down, a row drifting right to
            left and the figures; tablets and phones keep two columns and leave out the third (phones
            the figures too) */}
        <div className="t-wrap r-hero-mosaic">
          <div className="r-asym-cell r-hm-left">
            <Marquee axis="y" speed={-18} className="r-asym-col">
              {reel2025b.slice(0, 6).map((p) => <img key={p} src={src(p, true)} alt="" loading="lazy" />)}
            </Marquee>
          </div>
          <div className="r-asym-cell r-hm-right">
            <Marquee axis="y" speed={22} className="r-asym-col">
              {reel2025.slice(0, 6).map((p) => <img key={p} src={src(p)} alt="" loading="lazy" />)}
            </Marquee>
          </div>
          <div className="r-asym-cell r-hm-mid">
            <Marquee axis="y" speed={-15} className="r-asym-col">
              {reel2025b.slice(6).map((p) => <img key={p} src={src(p, true)} alt="" loading="lazy" />)}
            </Marquee>
          </div>
          <div className="r-asym-cell r-hm-row">
            <Marquee speed={30} className="r-reel">
              {reel2025.slice(6).map((p) => <img key={p} src={src(p, true)} alt="" loading="lazy" />)}
            </Marquee>
          </div>
          <dl className="r-asym-stats r-hm-stats">
            {stats2025.slice(0, 4).map((s) => <div key={s.label}><dd>{s.n}</dd><dt>{s.label.replace("hackathon ", "")}</dt></div>)}
          </dl>
        </div>
      </section>

      {/* ── A peek inside: the token stacker builds the numbers as stacks, the numbers sit beside it ── */}
      <section className="t-band t-dark r-peek">
        <div className="t-wrap">
          <div className="r-peek-grid">
            <div className="r-peek-side">
              <p className="t-eyebrow">A peek inside</p>
              <h2 className="t-title">The week<span>in numbers</span></h2>
              <p className="r-peek-lede">One week, four flagship events, a city of first-timers.</p>
              <div className="r-peek-panel"><TokenStacker className="r-peek-art" /></div>
            </div>
            <dl className="r-numbers">
              {stats2025.map((s) => <div key={s.label}><dt>{s.label}</dt><dd>{s.n}</dd><dd className="r-numbers-sub">{s.sub}</dd></div>)}
            </dl>
          </div>
        </div>
      </section>

      {/* ── 01 Web3 Hackathon: intro and its 11 teams, one navy band ── */}
      <section className="t-dark r-chapter r-hack">
        <div className="t-wrap">
          <div className="r-split">
            <div className="r-copy">
              <span className="r-index" aria-hidden="true">01</span>
              <p className="t-eyebrow">Web3 Hackathon</p>
              <h2 className="t-title">Let me show you<span>the game</span></h2>
              <p>Students and young builders made Web3 games in teams, then pitched them to a full room.</p>
              <Figures items={[{ n: "₮20M", label: "prize pool" }, { n: "11", label: "teams" }, { n: "Web3", label: "games" }]} />
              <Link href="/hackathon" className="r-link">Build with us at UB Hack 2026 <ArrowRight size={16} /></Link>
            </div>
            <img className="r-poster" src={src("hack/p01")} alt="Web3 Hackathon poster, 2025" loading="lazy" />
          </div>
        </div>
        <TeamWall items={hackTeams.map((t, i) => ({
        src: src(t.photo), alt: `Team ${t.name}`, title: t.name, tag: `Team ${String(i + 1).padStart(2, "0")}`,
        }))} />
      </section>

      {/* ── 02 Research conference: copy beside three columns of photos drifting up, down, up ── */}
      <section className="t-band band-light r-chapter">
        <div className="t-wrap r-research">
          <div className="r-copy">
            <span className="r-index" aria-hidden="true">02</span>
            <p className="t-eyebrow">27 November · with UFE</p>
            <h2 className="t-title">Blockchain<span>and its uses</span></h2>
            <p>Bachelor&apos;s and master&apos;s students presented their own research to a jury.</p>
            <Figures items={[{ n: "₮2M", label: "first prize" }, { n: "₮1M", label: "second prize" }, { n: "BA · MA", label: "students" }]} />
          </div>
          <div className="r-columns">
            <Marquee axis="y" speed={20} className="r-col">
              {["research/08", "research/01", "research/04", "research/07"].map((p) => <img key={p} src={src(p, true)} alt="" loading="lazy" />)}
            </Marquee>
            <Marquee axis="y" speed={-14} className="r-col is-mid">
              <img src={src("research/p01")} alt="Student research conference poster, 2025" loading="lazy" className="is-poster" />
              {["research/09", "research/02", "research/06"].map((p) => <img key={p} src={src(p, true)} alt="" loading="lazy" />)}
            </Marquee>
            <Marquee axis="y" speed={26} className="r-col">
              {["research/05", "research/11", "research/03", "research/10"].map((p) => <img key={p} src={src(p, true)} alt="" loading="lazy" />)}
            </Marquee>
          </div>
        </div>
      </section>

      {/* ── 03 Stablecoin roundtable (owner's sketch): the big photo on the left; beside it the
             number, the title and two big cards drifting left, all within the photo's height ── */}
      <section className="t-band t-dark r-chapter r-round">
        <Room shots={["08", "03", "05", "07", "09", "10"].map((n) => ({ src: src(`roundtable/${n}`), thumb: src(`roundtable/${n}`, true), alt: "Stablecoin roundtable, UB Blockchain Week 2025" }))}>
          <span className="r-room-num" aria-hidden="true">03</span>
          <p className="t-eyebrow">Policy roundtable</p>
          <h2 className="t-title">Stablecoins<span>and Mongolia</span></h2>
        </Room>
      </section>

      {/* ── 04 Binance Web3 University Tour ── */}
      <section className="t-band t-dark r-chapter r-tour">
        <div className="t-wrap">
          <div className="r-split">
            <div className="r-copy">
              <span className="r-index" aria-hidden="true">04</span>
              <p className="t-eyebrow">Binance Web3 University Tour</p>
              <h2 className="t-title">Two campuses<span>one evening each</span></h2>
              <p>Binance brought blockchain basics to students. Every student left with a gift.</p>
              <ul className="r-stops">
                <li><span>Tuesday · 18:00</span><b>МУИС</b><small>National University of Mongolia</small></li>
                <li><span>Friday · 18:00</span><b>СЭЗИС</b><small>University of Finance and Economics</small></li>
              </ul>
            </div>
            <img className="r-poster" src={src(binanceTour)} alt="Binance Web3 University Tour poster, 2025" loading="lazy" />
          </div>
        </div>
      </section>

      {/* ── Partners 2025: every partner poster, whole ── */}
      <section className="t-band band-light r-partners">
        <div className="t-wrap">
          <div className="r-head r-head-row">
            <div>
              <p className="t-eyebrow">Partners 2025</p>
              <h2 className="t-title t-title-sm">The names<span>behind the week</span></h2>
            </div>
            <p>Exchanges, universities and studios.</p>
          </div>
        </div>
        <PosterRing items={partners2025.map((p) => ({ src: src(p.src), alt: p.name ? `${p.name}, partner of UB Blockchain Week 2025` : "Partner poster, UB Blockchain Week 2025" }))} />
      </section>

    </>
  );
}
