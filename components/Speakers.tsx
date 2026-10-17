import Image from "next/image";
import { mailto } from "@/lib/site";

function PlaceholderSpeaker() {
  return (
    <li className="speaker speaker--tba" aria-label="Speaker to be announced">
      <div className="speaker__ghost">
        <Image src="/assets/logo-mark.png" alt="" width={310} height={349} />
      </div>
      <div className="speaker__meta">
        <h3 className="speaker__name">To be announced</h3>
        <p className="speaker__role">Speaker</p>
      </div>
    </li>
  );
}

export default function Speakers() {
  return (
    <section className="section section--speakers" id="speakers" aria-labelledby="speakers-title">
      <div className="container">
        <div className="section__head section__head--row">
          <div>
            <h2 className="section__title" id="speakers-title">Speakers</h2>
            <p className="section__intro">
              The first speakers for 2026 are being confirmed. Announced names appear here as they are locked in.
            </p>
          </div>
          <a className="btn btn--ghost" href={mailto("Call for Speakers")}>Apply to speak</a>
        </div>

        <ul className="speakers">
          <li className="speaker">
            <Image
              className="speaker__poster"
              src="/assets/posters/speaker-undral.jpg"
              alt="Speaker poster: A. Undral, Zahiral at TenGer tv"
              width={785}
              height={982}
            />
            <div className="speaker__meta">
              <h3 className="speaker__name">A. Undral</h3>
              <p className="speaker__role">Zahiral at TenGer tv</p>
            </div>
          </li>
          <PlaceholderSpeaker />
          <PlaceholderSpeaker />
          <PlaceholderSpeaker />
        </ul>
      </div>
    </section>
  );
}
