import Image from "next/image";
import { mailto } from "@/lib/site";

export default function Partners() {
  return (
    <section className="section section--partners" id="partners" aria-labelledby="partners-title">
      <div className="container">
        <div className="section__head">
          <h2 className="section__title" id="partners-title">Partners</h2>
        </div>

        <div className="partners">
          <div className="partners__group">
            <h3 className="partners__label">Hosted by</h3>
            <ul className="partners__logos">
              <li>
                <Image className="partners__logo partners__logo--tenger" src="/assets/logos/tenger-hd.png" alt="TenGer HD" width={127} height={58} />
              </li>
            </ul>
          </div>
          <div className="partners__group">
            <h3 className="partners__label">In collaboration with</h3>
            <ul className="partners__logos">
              <li>
                <Image className="partners__logo partners__logo--krypto" src="/assets/logos/krypto-mn.png" alt="Krypto.mn" width={144} height={32} />
              </li>
            </ul>
          </div>
          <div className="partners__group">
            <h3 className="partners__label">2025 partners and supporters</h3>
            <ul className="partners__logos">
              <li>
                <Image className="partners__logo partners__logo--fonte" src="/assets/logos/caffe-fonte.png" alt="Caffe Fonte" width={327} height={380} />
              </li>
            </ul>
          </div>
          <div className="partners__cta">
            <p>2026 partner and supporter places are open.</p>
            <a className="btn btn--green" href={mailto("Call for Partnership")}>Become a partner</a>
          </div>
        </div>
      </div>
    </section>
  );
}
