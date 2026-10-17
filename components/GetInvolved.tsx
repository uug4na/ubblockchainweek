import Image from "next/image";
import { calls, mailto } from "@/lib/site";

export default function GetInvolved() {
  return (
    <section className="section section--calls" id="get-involved" aria-labelledby="calls-title">
      <div className="container">
        <div className="section__head">
          <h2 className="section__title" id="calls-title">Get involved</h2>
          <p className="section__intro section__intro--cyr" lang="mn">
            Технологийг дэмжигч та бүхнийг хамтран ажиллахыг урьж байна
          </p>
          <p className="section__intro">
            Partners, speakers, exhibitors and volunteers make the week happen. Pick the one that fits you and write to the
            team.
          </p>
        </div>

        <ul className="calls">
          {calls.map((call) => (
            <li className="call" key={call.title}>
              <Image className="call__poster" src={call.poster.src} alt={call.poster.alt} width={call.poster.width} height={call.poster.height} />
              <div className="call__body">
                <h3 className="call__title">{call.title}</h3>
                <p>{call.blurb}</p>
                <a className={`btn btn--small ${call.primary ? "btn--green" : "btn--ghost"}`} href={mailto(call.subject)}>
                  {call.action}
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
