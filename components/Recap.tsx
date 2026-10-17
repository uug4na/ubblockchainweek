import Image from "next/image";
import { keyVisuals2025 } from "@/lib/site";

export default function Recap() {
  /* the strip is rendered twice so the marquee loops without a gap;
     the copy is hidden from assistive tech and from reduced-motion users */
  const strips: ("visible" | "copy")[] = ["visible", "copy"];
  return (
    <section className="section section--recap" id="recap" aria-labelledby="recap-title">
      <div className="container">
        <div className="section__head section__head--row">
          <div>
            <h2 className="section__title" id="recap-title">Last year</h2>
            <p className="section__intro">
              UB Blockchain Week 2025 ran from 3 to 7 November at The Corporate Hotel &amp; Convention Centre in Ulaanbaatar.
            </p>
          </div>
        </div>
      </div>
      <div className="marquee" aria-label="Key visuals from UB Blockchain Week 2025">
        <div className="marquee__track">
          {strips.map((strip) =>
            keyVisuals2025.map((visual) => (
              <Image
                key={`${strip}-${visual.src}`}
                src={visual.src}
                alt={strip === "copy" ? "" : visual.alt}
                aria-hidden={strip === "copy" ? true : undefined}
                width={visual.width}
                height={visual.height}
              />
            )),
          )}
        </div>
      </div>
    </section>
  );
}
