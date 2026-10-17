import Pixels from "./Pixels";
import { contactPixels, site } from "@/lib/site";

const PhoneIcon = () => (
  <svg className="card__icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1L6.6 10.8z" />
  </svg>
);
const MailIcon = () => (
  <svg className="card__icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2.4V18h16V7.4l-8 5.3-8-5.3zM4.9 7l7.1 4.7L19.1 7H4.9z" />
  </svg>
);
const PinIcon = () => (
  <svg className="card__icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2a7 7 0 0 1 7 7c0 5.2-7 13-7 13S5 14.2 5 9a7 7 0 0 1 7-7zm0 4.5A2.5 2.5 0 1 0 12 11.5 2.5 2.5 0 0 0 12 6.5z" />
  </svg>
);

export default function Contact() {
  return (
    <section className="section section--contact" id="contact" aria-labelledby="contact-title">
      <div className="container">
        <div className="section__head">
          <h2 className="section__title" id="contact-title">Contact</h2>
        </div>
        <div className="card">
          <Pixels className="card__pixels" cells={contactPixels} />
          <div className="card__body">
            <h3 className="card__name">Oyunbileg Baatar</h3>
            <p className="card__role">UB Blockchain Week Co-Host</p>
            <ul className="card__lines">
              <li>
                <PhoneIcon />
                <a href="tel:+97691119578">+976 9111 9578</a>
              </li>
              <li>
                <MailIcon />
                <a href={`mailto:${site.email}`}>{site.email}</a>
              </li>
              <li>
                <PinIcon />
                <span>{site.city}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
