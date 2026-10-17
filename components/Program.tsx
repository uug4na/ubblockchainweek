import { days, mailto } from "@/lib/site";

export default function Program() {
  return (
    <section className="section section--program" id="program" aria-labelledby="program-title">
      <div className="container">
        <div className="section__head">
          <h2 className="section__title" id="program-title">Five days in November</h2>
          <p className="section__intro">
            Monday to Friday, 23 to 27 November 2026. Sessions are being confirmed now and the full agenda will be published
            on this page.
          </p>
        </div>

        <ol className="days" aria-label="Event days">
          {days.map((day) => (
            <li className="day" key={day.num}>
              <span className="day__name">{day.name}</span>
              <b className="day__num">{day.num}</b>
              <span className="day__month">Nov</span>
            </li>
          ))}
        </ol>

        <div className="program__note">
          <p>Have a topic, a panel or a workshop in mind? Session proposals are open until the agenda is final.</p>
          <a className="btn btn--green" href={mailto("Session proposal")}>Propose a session</a>
        </div>
      </div>
    </section>
  );
}
