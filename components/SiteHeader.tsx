"use client";

// TOKEN2049-style header: lockup + dates on the left, a short centred nav with a "More" menu,
// an outline button and one filled button on the right. Clear over the hero, solid once scrolled.
// Phones get their own menu sheet, animated with Motion: the page blurs, the glass card springs out
// of the menu button, the rows cascade in, the green button rises last; closing plays it back fast.
// While the sheet is open the bar's own green button fades out, so there is only one.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, type Variants } from "motion/react";
import { ChevronDown, Menu, X } from "lucide-react";
import { Logo } from "./Toono";

const nav = [
  { href: "/program", label: "Program" },
  { href: "/hackathon", label: "UB Hack" },
  { href: "/side-events", label: "Side events" },
];
const more = [
  { href: "/get-involved", label: "Get involved" },
  { href: "/get-involved#partner", label: "Partner with us" },
  { href: "/reports/2025", label: "2025 report" },
  { href: "/#faq", label: "FAQ" },
];

const ease = [0.22, 1, 0.36, 1] as const;
const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 } as const;
const card: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: -12, transition: { duration: 0.16, ease } },
  show: { opacity: 1, scale: 1, y: 0, transition: { ...spring, delayChildren: 0.1, staggerChildren: 0.045 } },
};
const row: Variants = {
  hidden: { opacity: 0, y: -10, filter: "blur(4px)", transition: { duration: 0.12 } },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { ...spring, stiffness: 500, damping: 38 } },
};
const cta: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.97, transition: { duration: 0.12 } },
  show: { opacity: 1, y: 0, scale: 1, transition: { ...spring, delay: 0.08 } },
};

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  const path = usePathname();

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => { setOpen(false); setMoreOpen(false); }, [path]);
  // the open phone menu covers the page: hold the page still underneath
  // closing: let the bar's glass snap back for a frame instead of fading in after the menu is gone
  const headerRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {   // before paint, so the first style pass already has no transition
    const h = headerRef.current;
    if (open || !h) return;
    h.classList.add("is-snap");
    const f = requestAnimationFrame(() => requestAnimationFrame(() => h.classList.remove("is-snap")));
    return () => cancelAnimationFrame(f);
  }, [open]);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [open]);

  return (
    // A floating glass bar, the same material as the attendee app's tab bar; a little denser once scrolled.
    <header ref={headerRef} className={`t-header ${solid || path !== "/" ? "is-solid" : ""} ${open ? "is-open" : ""}`}>
      <MotionConfig reducedMotion="user">
      <div className="t-wrap t-header-inner">
        <Link href="/" className="t-brand" aria-label="UB Blockchain Week 2026, home">
          <Logo />
        </Link>

        <nav className="t-nav" aria-label="Main">
          <div className="t-nav-card">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={path === n.href ? "is-active" : undefined}>{n.label}</Link>
          ))}
          <div className={`t-more ${moreOpen ? "is-open" : ""}`} onMouseLeave={() => setMoreOpen(false)}>
            <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)} onMouseEnter={() => setMoreOpen(true)}>
              More <ChevronDown size={16} />
            </button>
            <div className="t-more-menu">
              {more.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
            </div>
          </div>
          </div>
        </nav>

        <div className="t-header-actions">
          <Link href="/get-involved#partner" className="t-btn t-btn-fill">Become a partner</Link>
          <button className="t-menu" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={open ? "x" : "menu"} className="t-menu-icon"
                initial={{ opacity: 0, rotate: -90, scale: 0.6 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
                transition={{ duration: 0.16, ease }}>
                {open ? <X size={20} /> : <Menu size={20} />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* phones: a full-screen blurred layer under the bar, holding the glass card */}
      <AnimatePresence>
        {open && (
          <motion.div key="sheet" className="t-sheet" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
            initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.22, ease } }} exit={{ opacity: 0, transition: { duration: 0.2, ease, delay: 0.04 } }}>
            <motion.nav className="t-sheet-card" aria-label="Main" style={{ transformOrigin: "92% 0%" }} variants={card} initial="hidden" animate="show" exit="hidden">
              {nav.map((n) => (
                <motion.div key={n.href} variants={row}>
                  <Link href={n.href} className={path === n.href ? "is-active" : undefined}>{n.label}</Link>
                </motion.div>
              ))}
              <motion.p variants={row} className="t-sheet-label">More</motion.p>
              {more.map((n) => (
                <motion.div key={n.href} variants={row}>
                  <Link href={n.href} className="is-sub" onClick={() => setOpen(false)}>{n.label}</Link>
                </motion.div>
              ))}
              <motion.div variants={cta}>
                <Link href="/get-involved#partner" className="t-btn t-btn-fill t-sheet-cta" onClick={() => setOpen(false)}>Become a partner</Link>
              </motion.div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
      </MotionConfig>
    </header>
  );
}
