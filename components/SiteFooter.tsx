import Brand from "./Brand";
import { navLinks } from "@/lib/site";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <Brand className="brand--footer" />
        <ul className="site-footer__links">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a href={link.href}>{link.label}</a>
            </li>
          ))}
        </ul>
        <p className="site-footer__note">16 to 20 November 2026, Ulaanbaatar. Hosted by TenGer HD.</p>
      </div>
    </footer>
  );
}
