// Shared harness for the invitation GIFs. A variant calls play(build, loopMs) where build()
// returns a paused anime.js timeline. Every timeline ends back on its first frame, so the GIF
// loops without a jump.
//   invite-x.html          → plays in a loop (preview)
//   invite-x.html?t=1.25   → frozen at 1.25 s
//   window.__seek(ms)      → used by render.mjs to step frame by frame
const { createTimeline, stagger, svg, utils } = anime;

const GLOBE = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.6 2.8 3.9 6 3.9 9.5s-1.3 6.7-3.9 9.5c-2.6-2.8-3.9-6-3.9-9.5s1.3-6.7 3.9-9.5z"/></svg>';
const ARROW = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

// pixel blocks on the 54px grid: [col, row, w, h, colour]
function pixels(host, list) {
  return list.map(([c, r, w, h, col]) => {
    const d = document.createElement("div");
    d.className = "px " + col;
    Object.assign(d.style, { left: c * 54 + "px", top: r * 54 + "px", width: w * 54 + "px", height: h * 54 + "px" });
    host.appendChild(d);
    return d;
  });
}

// the block-graph "B" (same geometry as src/components/Toono.tsx)
const B = {
  N: { t: [253, 91], ul: [110, 175], ur: [398, 175], c: [253, 252], ll: [110, 336], lr: [398, 336], b: [253, 421] },
  // in pen order: one stroke t → ur → c → lr → b → ll → ul, then the spine t → b
  solid: [["t", "ur"], ["ur", "c"], ["c", "lr"], ["lr", "b"], ["b", "ll"], ["ll", "ul"], ["t", "b"]],
  faint: [["t", "ul"], ["ul", "c"], ["ur", "lr"]],
};
function drawB(svgEl, { stroke = "#fff", width = 8, r = 14 } = {}) {
  const NS = "http://www.w3.org/2000/svg";
  const mk = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); p.appendChild(e); return e; };
  const g = mk("g", { stroke, "stroke-width": width, "stroke-linecap": "round", fill: "none" }, svgEl);
  const line = ([a, b], op) => mk("line", { x1: B.N[a][0], y1: B.N[a][1], x2: B.N[b][0], y2: B.N[b][1], opacity: op }, g);
  const faint = B.faint.map((e) => line(e, 0.35));
  const solid = B.solid.map((e) => line(e, 1));
  const ng = mk("g", { fill: stroke }, svgEl);
  const nodes = ["t", "ur", "c", "lr", "b", "ll", "ul"].map((k) => mk("circle", { cx: B.N[k][0], cy: B.N[k][1], r, style: `transform-origin:${B.N[k][0]}px ${B.N[k][1]}px` }, ng));
  return { faint, solid, nodes };
}

// the CTA row: "Register now" + the site, outlined
function ctaRow(el) {
  el.innerHTML = `<span class="btn fx">Register now ${ARROW}</span><span class="site fx">${GLOBE}ubblockchainweek.net</span>`;
}

// the split lockup: <div class="logo">${LOCKUP}</div>, revealed by lockupIn()
const LOGO = "../../public/brand/logo-white.webp";
const LOCKUP = `<span class="lock" role="img" aria-label="UB Blockchain Week"><img class="lk-mark" src="${LOGO}" alt=""><span class="lk-word"><img src="${LOGO}" alt=""></span></span><span class="year">2026</span>`;
function lockupIn(tl, at) {
  return tl.add(".lk-mark", { opacity: [0, 1], scale: [0.5, 1], ease: "outBack(2.2)", duration: 600 }, at)
    .add(".lk-word img", { opacity: [0, 1], translateX: ["-75%", "0%"], ease: "outExpo", duration: 900 }, at + 250)
    .add(".lock + .year", { opacity: [0, 1], translateX: [-16, 0], ease: "outExpo", duration: 600 }, at + 450);
}
const LOCKUP_PARTS = ".lk-mark, .lk-word img, .lock + .year";

// built once fonts are in, so layouts measured in build() are final
function play(build, loopMs) {
  document.fonts.ready.then(() => start(build, loopMs));
}
function start(build, loopMs) {
  const tl = build();
  tl.add({ duration: 1 }, loopMs - 1); // pin the timeline length to the loop
  window.__seek = (ms) => { tl.seek(ms % loopMs); return true; };
  window.__loop = loopMs;
  const q = new URLSearchParams(location.search).get("t");
  if (q !== null) { tl.seek(+q * 1000); return; }
  const t0 = performance.now();
  const tick = (now) => { tl.seek((now - t0) % loopMs); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
