import Image from "next/image";
import Countdown from "./Countdown";
import Pixels from "./Pixels";
import { heroPixelsBottomRight, heroPixelsTopLeft, mailto, site } from "@/lib/site";

export default function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="rings rings--tl" aria-hidden="true" />
      <div className="rings rings--br" aria-hidden="true" />
      <Pixels className="pixels pixels--tl" cells={heroPixelsTopLeft} />
      <Pixels className="pixels pixels--br" cells={heroPixelsBottomRight} />

      <div className="container hero__inner">
        <div className="hero__stage">
          <div className="block block--teal" aria-hidden="true" />
          <div className="block block--blue-sm" aria-hidden="true" />
          <div className="block block--blue-main" aria-hidden="true" />
          <div className="block block--blue-r" aria-hidden="true" />
          <div className="block block--green" aria-hidden="true" />

          <p className="hero__where">{site.city}</p>
          <h1 className="hero__title" id="hero-title">
            <span className="hero__line">UB</span>
            <span className="hero__line">Blockchain</span>
            <span className="hero__line">
              Week <span className="year-badge">{site.year}</span>
            </span>
          </h1>
          <p className="hero__date">
            <time dateTime="2026-11-23">2026 11.23</time>
            <span className="hero__date-dash">-</span>
            <time dateTime="2026-11-27">27</time>
          </p>
          <p className="hero__lede">Five days of talks, exhibition and meetups for Mongolia&apos;s blockchain community.</p>
          <div className="hero__actions">
            <a className="btn btn--green" href="#get-involved">Become a partner</a>
            <a className="btn btn--ghost" href={mailto("Call for Speakers")}>Apply to speak</a>
          </div>
        </div>

        <aside className="hero__side">
          <Countdown start={site.start} end={site.end} />
          <div className="hosted">
            <p className="hosted__row">
              <span className="hosted__label">Hosted by</span>
              <Image className="hosted__logo hosted__logo--tenger" src="/assets/logos/tenger-hd.png" alt="TenGer HD" width={127} height={58} />
            </p>
            <p className="hosted__row">
              <span className="hosted__label">With</span>
              <Image className="hosted__logo hosted__logo--krypto" src="/assets/logos/krypto-mn.png" alt="Krypto.mn" width={144} height={32} />
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
