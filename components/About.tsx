export default function About() {
  return (
    <section className="section section--about" id="about" aria-labelledby="about-title">
      <div className="container">
        <div className="section__head">
          <h2 className="section__title" id="about-title">One week, the whole ecosystem in one place</h2>
          <p className="section__intro">
            UB Blockchain Week brings Mongolia&apos;s founders, developers, investors, regulators and the curious together in
            Ulaanbaatar for five days every November. Talks on stage, companies on the exhibition floor, and meetups around
            the edges.
          </p>
        </div>

        <div className="blocks" role="list">
          <article className="blocks__item blocks__item--blue" role="listitem">
            <h3>Talks and panels</h3>
            <p>Founders, builders, policy makers and investors on one stage, in Mongolian and English.</p>
          </article>
          <article className="blocks__item blocks__item--navy" role="listitem">
            <h3>Meetups</h3>
            <p>Side events across the city all week.</p>
          </article>
          <article className="blocks__item blocks__item--green" role="listitem">
            <h3>Exhibition</h3>
            <p>Stands for exchanges, wallets, infrastructure teams and local startups. Meet the people building the products.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
