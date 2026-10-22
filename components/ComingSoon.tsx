import Link from "next/link";
import { ArrowRight } from "lucide-react";

// The 2026 agenda isn't final yet: inner pages show this block in place of schedules and
// line-ups. One short line, what will appear here, and where to go meanwhile.

export function ComingSoon({ what, items, action }: { what: string; items: string[]; action?: { label: string; href: string } }) {
  return (
    <section className="t-band band-light t-soon">
      <div className="t-wrap t-soon-grid">
        <div>
          <span className="t-soon-badge"><i />Coming soon</span>
          <h2 className="t-title t-title-sm">{what}<span>is on its way</span></h2>
          <p>The 2026 plan is still being put together with our partners. It will appear here as soon as it is final.</p>
          <div className="t-soon-actions">
            <Link href="/get-involved" className="t-btn t-btn-fill">Get involved <ArrowRight size={16} /></Link>
            {action && <Link href={action.href} className="t-btn t-btn-line">{action.label}</Link>}
          </div>
        </div>
        <ul className="t-soon-list" aria-label="What will appear here">
          {items.map((t) => <li key={t}><b>{t}</b><span>Soon</span></li>)}
        </ul>
      </div>
    </section>
  );
}
