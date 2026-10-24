import Link from "next/link";
import { ArrowRight, Ticket } from "lucide-react";
import { site, days, faqs } from "@/data/site";
import { partners2026, partnerTypes } from "@/data/partners";
import { withBase } from "@/lib/base";
import { Carousel, type Slide } from "@/components/Carousel";
import { QuoteCard } from "@/components/QuoteCard";
import { BlockPress } from "@/components/iso/BlockPress";
import { ValidatorRack } from "@/components/iso/ValidatorRack";
import { recap, stats2025, reel2025, reel2025b } from "@/data/recap2025";
import { Marquee } from "@/components/report/Marquee";
import { PartnerCards } from "@/components/PartnerCards";
import { ScrollFx } from "@/components/ScrollFx";
import { Faq } from "@/components/Faq";
import { PowerFx } from "@/components/PowerFx";

// Landing page, laid out like token2049.com/dubai: full-bleed hero with a stats strip, a light
// centred carousel, a bento gallery, a dark "attended by" band, a partner wall, three CTA cards.
// The hero and the dark band carry isometric figures built with the anatomy kit.

const img = (name: string) => withBase(`/brand/${name}`);

// a paragraph that fills in word by word as it scrolls up (ScrollFx)
const words = (text: string) => text.split(" ").map((w, i) => <span key={i}>{w} </span>);

// three rooms from 2025 under the "many hands" text (16:9, shown whole)
const gallery = [
  { photo: "hack/07", title: "Web3 Hackathon", alt: "The Web3 Hackathon room, 2025" },
  { photo: "research/08", title: "Research conference", alt: "Research conference prize winners, 2025" },
  { photo: "roundtable/03", title: "Policy roundtable", alt: "The stablecoin roundtable, 2025" },
];

// the four calls from the 2025 posters (Get involved section)
const involve = [
  { poster: "call-for-partnership", title: "Partnership", body: "Help shape the program with your expertise, technology, facilities, or financial support.", cta: "Discuss a partnership", href: "/get-involved#partner" },
  { poster: "call-for-speakers", title: "Speakers", body: "Lead a workshop, join a panel, or suggest a topic. Nominations are welcome.", cta: "Apply to speak", href: "/get-involved#speak" },
  { poster: "call-for-exhibition", title: "Exhibition", body: "Present your project and meet potential users, contributors, and partners.", cta: "Present your project", href: "/get-involved#partner" },
  { poster: "looking-for-volunteers", title: "Volunteers", body: "Help run the week and build new connections with the community.", cta: "Join as a volunteer", href: "/get-involved#volunteer" },
];

const stats = [
  { n: "5", label: "days" },
  { n: "30–4", label: "Nov–Dec" },
  { n: "Free", label: "entry" },
  { n: "Soon", label: "agenda" },
];

const slides: Slide[] = [
  {
    eyebrow: "Free with advance registration",
    title: "Join the ",
    accent: "community",
    body: "Builders, researchers, students, companies and policymakers meet in Ulaanbaatar for five days of learning, collaboration and discussion. Every event is free to attend with advance registration.",
    cta: { label: "Get involved", href: "/get-involved" },
    photo: withBase(recap("hack/07")), inset: withBase(recap("research/08", true)), alt: "A full room at UB Blockchain Week 2025",
  },
  {
    eyebrow: "Web3 Game Development Hackathon",
    title: "Build a ",
    accent: "Web3 game",
    body: "Students, young developers, designers and aspiring founders form teams of 2–4 to build a playable game with Web3 and a clear business model. Teams present their games to judges, industry and the community at Demo Day.",
    cta: { label: "Join the hackathon", href: "/hackathon" },
    photo: withBase(recap("hack/09")), inset: withBase(recap("hack/14", true)), alt: "Teams at the 2025 Web3 Hackathon",
  },
  {
    eyebrow: "All week",
    title: "Host a ",
    accent: "side event",
    body: "Breakfasts, meetups, roundtables and evenings across the city: if it brings people together, it belongs in the week. Submit yours and we'll add it to the calendar.",
    cta: { label: "Submit an event", href: "/get-involved" },
    photo: withBase(recap("roundtable/08")), inset: withBase(recap("roundtable/07", true)), alt: "A roundtable during UB Blockchain Week 2025",
  },
];

export default function Home() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="t-hero">
        <div className="t-wrap t-hero-grid">
          <div className="t-hero-copy">
            <Link href="/get-involved" className="t-pill"><Ticket size={15} /> Free to attend · get involved</Link>
            <h1 className="t-display"><span>The blockchain</span><span>week of</span><span>Mongolia</span></h1>
            <p className="t-hero-meta">{site.dates} • {site.city}</p>
            <div className="t-hero-actions">
              <Link href="/get-involved" className="t-btn t-btn-white">Get involved</Link>
              <Link href="/program" className="t-btn t-btn-line">See the program</Link>
            </div>
            <p className="t-powered">
              <span>Powered by</span>
              <img src={img("partners/tenger-hd.png")} alt="TenGer TV" width={127} height={58} />
            </p>
          </div>
          <div className="t-hero-art">
            <BlockPress />
          </div>
        </div>
        <div className="t-wrap">
          <ul className="t-stats" aria-label="The week in numbers">
            {stats.map((s) => <li key={s.label}><b>{s.n}</b><span>{s.label}</span></li>)}
          </ul>
        </div>
      </section>

      {/* ── Carousel ── */}
      <section className="t-band band-light t-dotted has-minis">
        <div className="t-wrap">
          <div data-reveal><Carousel slides={slides} /></div>
        </div>
      </section>

      {/* ── Gallery: text, a speaker, a quote; three 2025 rooms below ── */}
      <section className="t-band band-light t-band-tight has-minis">
        <div className="t-wrap">
          {/* every picture at its own shape — nothing is cropped (posters and photos carry text) */}
          <div className="t-gal">
            <div className="t-gal-text" data-reveal>
              <h2 className="t-title t-title-sm"><span>What is</span>UBBW 2026?</h2>
              <p data-words>
                {words("UB Blockchain Week is Mongolia's blockchain and crypto community gathering, initiated by TenGer TV for builders, developers, researchers, students, companies and policymakers. Over five days in Ulaanbaatar, it brings the ecosystem together through a Web3 hackathon, developer workshops, project AMAs, industry panels, an academic conference and a policy roundtable.")}
              </p>
            </div>
            <figure className="t-gal-portrait" data-reveal>
              <img src={img("2025/recap/hack/p01.webp")} alt="Web3 Hackathon poster, UB Blockchain Week 2025" loading="lazy" />
              <figcaption><small>2025</small><b>Web3 Hackathon</b><span>₮20,000,000 prize pool</span></figcaption>
            </figure>
            <QuoteCard
              by="UB Blockchain Week 2026"
              lines={[
                "Academic research, product development, business experience and policy discussions in one shared conversation.",
                "Exploring blockchain for the first time, or already working in the industry? Come to learn, contribute and meet potential collaborators.",
              ]}
            />
            <div className="t-gal-row" data-reveal="group">
              {gallery.map((g) => (
                <Link key={g.photo} href="/reports/2025" className="t-gal-photo">
                  <img src={withBase(recap(g.photo))} alt={g.alt} loading="lazy" />
                  <span><b>{g.title}</b>2025</span>
                  <ArrowRight className="t-gal-go" size={18} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Attended by builders ── */}
      <section className="t-band t-dark has-minis">
        <div className="t-wrap t-net">
          <div className="t-net-copy" data-reveal>
            <p className="t-eyebrow">Built for builders</p>
            <h2 className="t-title">Five days<span>one city</span></h2>
            <p className="t-net-lede">Explore emerging projects, meet the people building them, develop new ideas, and take part in conversations about the future of blockchain and crypto in Mongolia.</p>
            <dl className="t-net-stats">
              <div><dt>30 November – 4 December 2026</dt><dd>5 days</dd></div>
              <div><dt>Free with advance registration</dt><dd>Free entry</dd></div>
              <div><dt>Program and speakers to be announced</dt><dd>Agenda soon</dd></div>
            </dl>
            <Link href="/get-involved#partner" className="t-btn t-btn-fill">Become a partner</Link>
          </div>
          <div className="t-net-art" data-reveal>
            <ValidatorRack />
          </div>
          <ol className="t-week" data-reveal="group">
            {days.map((d) => (
              <li key={d.date}>
                <span className="t-week-day">{d.weekday} {d.short} {d.month}</span>
                <b>Coming soon</b>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Partners 2026: centred title + line, one grid of partner cards (host first, tagged), one button ── */}
      <section className="t-band t-partners" id="partners">
        <div className="t-wrap">
          <div className="t-partners-head" data-reveal>
            <p className="t-eyebrow">Partners 2026</p>
            <h2 className="t-title t-title-sm">Our partners</h2>
            <p>The people making the week possible. Announced as they sign.</p>
          </div>
          <div data-reveal><PartnerCards types={["host", "partner"].map((id) => partnerTypes.find((t) => t.id === id)!)} partners={partners2026} /></div>
          <div className="t-partners-cta">
            <Link href="/get-involved#partner" className="t-btn t-btn-fill">Become a partner</Link>
          </div>
        </div>
      </section>

      {/* ── 2025 report teaser, asymmetrical grid: copy (wide, top-left), the feature column of photos
             drifting up (tall, right), a column drifting down (tall, left), the figures (middle) and a
             photo row drifting right to left (wide, bottom). The photos carry the section. ── */}
      <section className="t-band band-light r-teaser-band" id="2025">
        <div className="t-wrap r-asym">
          <div className="r-asym-copy" data-reveal>
            <p className="t-eyebrow">2025 report</p>
            <h2 className="t-title">Relive<span>UBBW 2025</span></h2>
            <p>A hackathon, a research conference, a policy roundtable and a campus tour.</p>
            <Link href="/reports/2025" className="t-btn t-btn-fill">Read the report <ArrowRight size={16} /></Link>
          </div>
          <Link href="/reports/2025" className="r-asym-cell r-asym-feature" aria-label="Read the 2025 report">
            <Marquee axis="y" speed={22} className="r-asym-col">
              {reel2025.slice(0, 6).map((p) => <img key={p} src={withBase(recap(p))} alt="" loading="lazy" />)}
            </Marquee>
          </Link>
          <Link href="/reports/2025" className="r-asym-cell r-asym-left" aria-label="Read the 2025 report">
            <Marquee axis="y" speed={-18} className="r-asym-col">
              {reel2025b.slice(0, 6).map((p) => <img key={p} src={withBase(recap(p, true))} alt="" loading="lazy" />)}
            </Marquee>
          </Link>
          <dl className="r-asym-stats">
            {stats2025.slice(0, 4).map((s) => <div key={s.label}><dd>{s.n}</dd><dt>{s.label.replace("hackathon ", "")}</dt></div>)}
          </dl>
          <Link href="/reports/2025" className="r-asym-cell r-asym-bottom" aria-label="Read the 2025 report">
            <Marquee speed={30} className="r-reel">
              {[...reel2025.slice(6), ...reel2025b.slice(6)].map((p) => <img key={p} src={withBase(recap(p, true))} alt="" loading="lazy" />)}
            </Marquee>
          </Link>
        </div>
      </section>

      {/* ── Get involved: the four 2025 calls, each poster whole on a card with one line and its button ── */}
      <section className="t-band t-dark r-involve">
        <div className="t-wrap">
          <div className="r-involve-head" data-reveal>
            <div>
              <p className="t-eyebrow">Join us on 30 November – 4 December 2026</p>
              <h2 className="t-title">Get involved</h2>
              <p className="r-involve-mn">Технологийг дэмжигч та бүхнийг хамтран ажиллахыг урьж байна</p>
            </div>
          </div>
          <ul className="r-involve-cards" data-reveal="group">
            {involve.map((c, i) => (
              <li key={c.title}>
                <Link href={c.href} className="r-involve-card">
                  <span className="r-involve-poster"><img src={img(`2025/${c.poster}.jpg`)} alt={`${c.title} poster, 2025`} loading="lazy" /></span>
                  <span className="r-involve-body">
                    <small>{String(i + 1).padStart(2, "0")}</small>
                    <b>{c.title}</b>
                    <span>{c.body}</span>
                    <em className={i === 0 ? "is-fill" : undefined}>{c.cta} <ArrowRight size={16} /></em>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="t-band band-light t-band-tight has-minis" id="faq">
        <div className="t-wrap t-faq-wrap">
          <h2 className="t-title t-title-sm" data-reveal><span>Good questions</span>Answered.</h2>
          <Faq items={faqs} />
        </div>
      </section>

      <ScrollFx />
      <PowerFx />
    </>
  );
}
