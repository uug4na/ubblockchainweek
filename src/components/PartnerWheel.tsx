"use client";

// App Home: partners as small cards on a 3D wheel (owner's reference video, 18 Nov 2026).
// The centre card faces you and is sharp; the others curve away, blur and fade. Drag / swipe / arrow keys
// spin it, it settles on a card. It also moves on its own, one card every AUTO_MS (owner, 18 Nov); it pauses
// while someone drags, hovers or focuses it, for IDLE_MS after they let go, while it is off screen, and with
// reduced motion. Tap the centre card → partner site; tap a side card → it comes to the centre.
// Sizes live in CSS (.pwheel: --pw-card, --pw-gap); the radius follows them.

import { useEffect, useRef } from "react";
import { partners2026, type Partner } from "@/data/partners";
import { withBase } from "@/lib/base";

// Every card says what they are, above the name: the app label (appTag, e.g. "Media partner"), else their own tag
// ("Powered by"), else their type (owner, 18 Nov).
const TYPE_TAG: Record<Partner["type"], string> = { host: "Host", partner: "Partner", media: "Media partner", sponsor: "Sponsor", supporter: "Supporter", collaboration: "Collaboration" };
const tagOf = (p: Partner) => p.appTag ?? p.tag ?? TYPE_TAG[p.type];

// Order and tag strength by importance (owner, 18 Nov): Host first, then Powered by, then media partners, then the
// rest (each group in partners.ts order). The card's dot background is strongest for Powered by, then Host, Media,
// Partner, all kept low so bright brand colours don't glare.
const rank = (p: Partner) => (p.type === "host" ? 0 : p.tag === "Powered by" ? 1 : tagOf(p) === "Media partner" ? 2 : 3);
const LEVEL = ["is-host", "is-powered", "is-media", "is-plain"] as const;
const list = partners2026
  .filter((p) => (p.type === "host" || p.type === "partner") && (p.icon || p.logo))
  .map((p, i) => ({ p, i }))
  .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i)
  .map(({ p }) => p);

// Host and Powered by, also pinned above the wheel.
const pinned = list.filter((p) => rank(p) <= 1);

// Enough slots for a full ring, so it loops with no gap: the list is repeated.
const copies = Math.max(1, Math.ceil(12 / Math.max(list.length, 1)));
const slots = Array.from({ length: list.length * copies }, (_, i) => list[i % list.length]);
const STEP = 360 / Math.max(slots.length, 1);  // average angle per card (for the blur / fade fall-off)
const AUTO_MS = 2800;  // one card along
const IDLE_MS = 5000;  // wait after a drag / tap / key before moving on its own again

// The SVG mark (p.svg) in its own colours sits straight on the card, no tile. In dark mode the brand's
// dark-background version (p.svgDark) is used when there is one; marks made for dark backgrounds only
// (p.onDark) keep a navy tile in light mode.
// appSvg / appSvgDark: a wordmark for this card only (the website keeps p.svg), shown wide.
function Mark({ p: base }: { p: Partner }) {
  const p = base.appSvg ? { ...base, svg: base.appSvg, svgDark: base.appSvgDark, wide: true } : base;
  if (p.svg) {
    const cls = `pwheel-mark is-svg${p.wide || (!p.icon && p.logo) ? " is-wide" : ""}${p.onDark ? " is-on-dark" : ""}`;
    return (
      <span className={cls}>
        {p.svgDark ? (
          <>
            <img className="on-light" src={withBase(`/brand/${p.svg}`)} alt="" draggable={false} />
            <img className="on-dark" src={withBase(`/brand/${p.svgDark}`)} alt="" draggable={false} />
          </>
        ) : (
          <img src={withBase(`/brand/${p.svg}`)} alt="" draggable={false} />
        )}
      </span>
    );
  }
  const word = !p.icon && !!p.logo;
  return (
    <span className={`pwheel-mark${p.wide ? " is-wide" : ""}${word ? " is-word" : ""}`} style={p.iconBg ? { background: p.iconBg } : undefined}>
      <img src={withBase(`/brand/${p.icon ?? p.logo}`)} alt="" draggable={false} />
    </span>
  );
}

// Card contents, shared by the wheel and the pinned cards.
function CardBody({ p }: { p: Partner }) {
  const tag = tagOf(p);
  return (
    <>
      {/* dot texture in the partner's colour (owner's reference video, 18 Nov): drifting, fades out under the name */}
      <span className="pwheel-dots" aria-hidden="true" />
      <Mark p={p} />
      <span className="pwheel-text">
        {tag && <small className="pwheel-tag">{tag}</small>}
        <b>{p.name}</b>
      </span>
    </>
  );
}

// Host and Powered by as two slim cards, pinned inside the Home countdown card (owner, 18 Nov). They stay in the wheel too.
export function PinnedPartners() {
  if (!pinned.length) return null;
  return (
    <div className="pwheel-pinned" aria-label="Host and Powered by">
      {pinned.map((p, i) => (
        <a
          key={p.name}
          className={`pwheel-card is-pinned ${LEVEL[rank(p)]}`}
          href={p.href ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={p.name}
          style={{ ["--tint" as string]: p.tint ?? "var(--label-3)", ["--i" as string]: i + 3 }}
        >
          <CardBody p={p} />
        </a>
      ))}
    </div>
  );
}

export function PartnerWheel() {
  const stage = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const el = stage.current;
    if (!el || !slots.length) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let R = 300;          // ring radius, px
    let rot = 0;          // current angle, deg
    let target = 0;       // angle we settle to
    let raf = 0;
    let drag: { x: number; rot: number; lastX: number; lastT: number; v: number; moved: boolean; i: number } | null = null;
    // Cards could differ in width, so each slot has its own centre angle and half-width.
    let ang = slots.map((_, i) => i * STEP);
    let half = slots.map(() => STEP / 2);
    const n = slots.length;

    const measure = () => {
      const w = cards.current.map((c) => c?.offsetWidth ?? 0);
      if (!w[0]) return;
      const gap = parseFloat(getComputedStyle(el).getPropertyValue("--pw-gap")) || 10;
      const total = w.reduce((s, x) => s + x + gap, 0);
      R = total / (2 * Math.PI);
      const deg = 180 / (Math.PI * R);
      let at = 0;
      ang = w.map((x, i) => { const c = i === 0 ? 0 : at + (x + gap) / 2 * deg; at = c + (x + gap) / 2 * deg; return c; });
      half = w.map((x) => (x + gap) / 2 * deg);
      el.style.setProperty("--pw-r", `${R}px`);
    };

    const norm = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
    const paint = () => {
      cards.current.forEach((c, i) => {
        if (!c) return;
        const a = norm(ang[i] + rot);
        const d = Math.abs(a);
        const blur = Math.min(6, Math.max(0, (d - half[i]) / STEP) * 1.6);
        c.style.transform = `rotateY(${a}deg) translateZ(${R}px)`;
        c.style.opacity = d > 95 ? "0" : String(Math.max(0, 1 - Math.pow(d / 100, 2)));
        c.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "";
        c.style.zIndex = String(200 - Math.round(d));
        c.style.pointerEvents = d > 70 ? "none" : "";
        c.tabIndex = d < half[i] ? 0 : -1;
        c.setAttribute("aria-hidden", d < half[i] ? "false" : "true");
      });
    };
    // slot nearest the centre for a given rotation
    const nearest = (r: number) => { let best = 0, bd = 999; for (let i = 0; i < n; i++) { const d = Math.abs(norm(ang[i] + r)); if (d < bd) { bd = d; best = i; } } return best; };
    // rotation that puts the nearest card exactly in the centre
    const snap = (a: number) => a - norm(ang[nearest(a)] + a);
    // from rotation a, move k cards along (k > 0 = next card, as the wheel turns on its own)
    const stepBy = (a: number, k: number) => {
      const c = nearest(a);
      const t = (((c + k) % n) + n) % n;
      const delta = k > 0 ? (((ang[t] - ang[c]) % 360) + 360) % 360 : -((((ang[c] - ang[t]) % 360) + 360) % 360);
      return snap(a) - delta;
    };

    const tick = () => {
      raf = 0;
      if (!drag) {
        const diff = target - rot;
        rot = Math.abs(diff) < 0.02 ? target : rot + diff * (reduce ? 1 : 0.14);
      }
      paint();
      if (drag || rot !== target) raf = requestAnimationFrame(tick);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    // bring slot i to the centre by the shortest way
    const toSlot = (i: number) => { target = rot - norm(ang[i] + rot); kick(); };
    const centred = () => nearest(rot);

    const degPerPx = () => 180 / (Math.PI * R);
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const i = Number((e.target as HTMLElement).closest<HTMLElement>("[data-i]")?.dataset.i ?? -1);
      drag = { x: e.clientX, rot, lastX: e.clientX, lastT: e.timeStamp, v: 0, moved: false, i };
      kick();
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 6) { drag.moved = true; el.setPointerCapture(e.pointerId); el.classList.add("is-dragging"); }
      if (!drag.moved) return;
      const dt = Math.max(1, e.timeStamp - drag.lastT);
      drag.v = 0.8 * ((e.clientX - drag.lastX) / dt) + 0.2 * drag.v;   // px per ms
      drag.lastX = e.clientX; drag.lastT = e.timeStamp;
      rot = target = drag.rot + dx * degPerPx();
    };
    const up = () => {
      if (!drag) return;
      const d = drag; drag = null;
      el.classList.remove("is-dragging");
      if (d.moved) {
        target = snap(rot + (reduce ? 0 : d.v * 260 * degPerPx()));   // fling, then settle on a card
        kick();
        return;
      }
      if (d.i < 0) return;
      if (d.i === centred() && Math.abs(norm(ang[d.i] + rot)) < half[d.i]) {
        const href = slots[d.i].href;
        if (href) window.open(href, "_blank", "noopener,noreferrer");
      } else toSlot(d.i);
    };
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;   // leave vertical page scroll alone
      e.preventDefault();
      rot = target = rot - e.deltaX * degPerPx();
      kick();
      clearTimeout(wheelEnd);
      wheelEnd = window.setTimeout(() => { target = snap(rot); kick(); }, 120);
    };
    let wheelEnd = 0;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      target = stepBy(target, e.key === "ArrowLeft" ? -1 : 1);
      kick();
      requestAnimationFrame(() => cards.current[nearest(target)]?.focus({ preventScroll: true }));
    };

    // moving on its own
    let lastTouch = 0, hover = false, focus = false, onScreen = true;
    const touched = () => { lastTouch = performance.now(); };
    const auto = window.setInterval(() => {
      if (reduce || drag || hover || focus || !onScreen || document.hidden) return;
      if (performance.now() - lastTouch < IDLE_MS) return;
      target = stepBy(target, 1);
      kick();
    }, AUTO_MS);
    const io = new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; });
    io.observe(el);
    const enter = (e: PointerEvent) => { if (e.pointerType === "mouse") hover = true; };
    const leave = () => { hover = false; };
    const fin = () => { focus = true; };
    const fout = () => { focus = el.contains(document.activeElement); };
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointerdown", touched);
    el.addEventListener("pointerup", touched);
    el.addEventListener("wheel", touched, { passive: true });
    el.addEventListener("keydown", touched);
    el.addEventListener("focusin", fin);
    const fdefer = () => setTimeout(fout);
    el.addEventListener("focusout", fdefer);

    measure(); paint();
    // Reveal once (owner, 25 Nov: partners "load weird" on refresh): before this runs the cards sit in one pile, so the
    // ring stays invisible (its space is already reserved) until it's placed and its logos are in, then fades in once.
    // Never waits more than 800 ms for slow logos.
    let shown = false;
    const show = () => { if (shown) return; shown = true; measure(); paint(); el.classList.add("is-ready"); };
    const pending = Array.from(el.querySelectorAll("img")).filter((im) => !im.complete)
      .map((im) => new Promise<void>((ok) => { im.addEventListener("load", () => ok(), { once: true }); im.addEventListener("error", () => ok(), { once: true }); }));
    Promise.all(pending).then(show);
    const revealCap = setTimeout(show, 800);
    const ro = new ResizeObserver(() => { measure(); paint(); });
    ro.observe(el);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(raf); clearTimeout(wheelEnd); clearTimeout(revealCap); ro.disconnect();
      clearInterval(auto); io.disconnect();
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointerdown", touched);
      el.removeEventListener("pointerup", touched);
      el.removeEventListener("wheel", touched);
      el.removeEventListener("keydown", touched);
      el.removeEventListener("focusin", fin);
      el.removeEventListener("focusout", fdefer);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("keydown", key);
    };
  }, []);

  if (!slots.length) return null;
  return (
    <section className="pwheel" aria-label="Partners">
      <div className="pwheel-stage" ref={stage} aria-roledescription="carousel">
        <div className="pwheel-ring">
          {slots.map((p, i) => {
            return (
              <a
                key={i}
                data-i={i}
                ref={(n) => { cards.current[i] = n; }}
                className={`pwheel-card ${LEVEL[rank(p)]}`}
                href={p.href ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                draggable={false}
                aria-label={p.name}
                style={{ ["--tint" as string]: p.tint ?? "var(--label-3)", ["--i" as string]: i }}
                // pointer taps are handled above (tap centre = open, tap side = bring it in); Enter still opens
                onClick={(e) => { if (e.detail !== 0 || !p.href) e.preventDefault(); }}
              >
                <CardBody p={p} />
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
