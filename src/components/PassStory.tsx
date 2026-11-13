"use client";

// "Share to story": draws the attendee's pass as a 1080×1920 Instagram story (PNG) on a canvas, then hands it
// to the phone's share sheet (Instagram, WhatsApp, …) or saves it. Everything is drawn here, on the device.
// The QR is left off on purpose: it is the check-in pass, and a story is public.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Share2, X } from "lucide-react";
import { COLS, ROWS, pixels, type CardPerson } from "@/components/BusinessCard";
import { days, site } from "@/data/site";
import { withBase } from "@/lib/base";
import { haptic } from "@/lib/haptics";

const W = 1080, H = 1920;
const NAVY = "#02073a", BLUE = "#2945d5", WHITE = "#ffffff", LIME = "#c6fc1f";
const TAGS = ["#13effd", "#c6fc1f", "#e81bfe", "#01fe6d"]; // same order as the card's tags
const first = days[0], last = days[days.length - 1];
const RUN = `${first.short} ${first.month} – ${last.short} ${last.month} ${last.date.slice(0, 4)}`.toUpperCase();

function img(src: string) {
  return new Promise<HTMLImageElement>((ok, fail) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = fail;
    i.src = src;
  });
}

// word-wrap into at most `max` lines; the last line gets an ellipsis if it overflows
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > max) {
    lines.length = max;
    let l = lines[max - 1];
    while (l && ctx.measureText(l + "…").width > width) l = l.slice(0, -1);
    lines[max - 1] = l.trimEnd() + "…";
  }
  return lines;
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function drawStory(u: CardPerson): Promise<Blob> {
  const family = getComputedStyle(document.body).fontFamily || "Poppins, system-ui, sans-serif";
  await Promise.all(["500", "600", "700", "800"].map((w) => document.fonts.load(`${w} 40px ${family}`).catch(() => null)));
  const font = (w: number, px: number) => `${w} ${px}px ${family}`;

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.textBaseline = "alphabetic";

  // page: brand navy with the app's faint grid
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,.045)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // measure everything first, so the whole block sits centred inside Instagram's safe area
  // (its top bar covers ≈ the first 220 px, the reply bar ≈ the last 240 px)
  const X = 90, CW = W - 2 * X, PAD = 64, IW = CW - 2 * PAD;
  const name = u.name.trim().toUpperCase();
  // biggest size where every word fits the card and the name takes at most 2 lines
  let nameSize = 52;
  for (const px of [92, 82, 72, 62]) {
    ctx.font = font(800, px);
    if (name.split(/\s+/).every((w) => ctx.measureText(w).width <= IW) && wrap(ctx, name, IW, 9).length <= 2) { nameSize = px; break; }
  }
  ctx.font = font(800, nameSize);
  const nameLines = wrap(ctx, name, IW, 2);
  const nameLH = Math.round(nameSize * 1.05);
  ctx.font = font(500, 36);
  const aboutLines = u.about ? wrap(ctx, u.about, IW, 2) : [];
  const tags = u.interests.slice(0, 4);
  ctx.font = font(600, 30);
  const chipW = (t: string) => 18 + 22 + 16 + ctx.measureText(t).width + 26;
  const tagRows: string[][] = [];
  for (const t of tags) {
    const row = tagRows[tagRows.length - 1];
    if (row && row.reduce((a, x) => a + chipW(x) + 14, 0) + chipW(t) <= IW) row.push(t);
    else tagRows.push([t]);
  }
  const cell = IW / COLS, fieldH = cell * ROWS;
  const faceH = PAD + 44 + 44 + fieldH + 50 + nameLines.length * nameLH + (aboutLines.length ? 22 + aboutLines.length * 50 : 0) + (tagRows.length ? 36 + tagRows.length * 78 - 14 : 0) + PAD;
  const stubH = 230;
  const LOGO_H = 92;
  const blockH = LOGO_H + 56 + 46 + 34 + faceH + stubH + 60 + 90;
  let y = Math.round(Math.max(230, 230 + (1680 - 230 - blockH) / 2));

  // logo, top left (white)
  try {
    const logo = await img(withBase("/brand/logo-2026.webp"));
    const lh = LOGO_H, lw = (logo.width / logo.height) * lh;
    const t = document.createElement("canvas");
    t.width = lw;
    t.height = lh;
    const tc = t.getContext("2d")!;
    tc.drawImage(logo, 0, 0, lw, lh);
    tc.globalCompositeOperation = "source-in";
    tc.fillStyle = WHITE;
    tc.fillRect(0, 0, lw, lh);
    ctx.drawImage(t, X, y);
  } catch { /* the story still works without the logo */ }
  y += LOGO_H + 56;

  // eyebrow
  ctx.fillStyle = LIME;
  ctx.font = font(700, 40);
  ctx.letterSpacing = "6px";
  ctx.fillText("I'M GOING", X, y + 40);
  ctx.letterSpacing = "0px";
  y += 46 + 34;

  // ── the card face (blue) ──
  const top = y;
  ctx.fillStyle = BLUE;
  round(ctx, X, top, CW, faceH + stubH, 14);
  ctx.fill();

  let cy = top + PAD;
  ctx.fillStyle = "rgba(255,255,255,.75)";
  ctx.font = font(600, 32);
  ctx.letterSpacing = "4px";
  ctx.fillText("UB BLOCKCHAIN WEEK", X + PAD, cy + 32);
  ctx.textAlign = "right";
  ctx.fillText("2026", X + CW - PAD, cy + 32);
  ctx.textAlign = "left";
  ctx.letterSpacing = "0px";
  cy += 44 + 44;

  // the pixel field from the pass code, coloured by the person's interests (same as the card)
  for (const p of pixels(u.id, tags.length)) {
    ctx.fillStyle = p.c < 0 ? "rgba(255,255,255,.14)" : TAGS[p.c];
    ctx.fillRect(X + PAD + p.x * cell + cell * 0.06, cy + p.y * cell + cell * 0.06, cell * 0.88, cell * 0.88);
  }
  cy += fieldH + 50;

  ctx.fillStyle = WHITE;
  ctx.font = font(800, nameSize);
  for (const l of nameLines) { cy += nameLH; ctx.fillText(l, X + PAD, cy - Math.round(nameSize * 0.08)); }

  if (aboutLines.length) {
    cy += 22;
    ctx.fillStyle = "rgba(255,255,255,.82)";
    ctx.font = font(500, 36);
    for (const l of aboutLines) { cy += 44; ctx.fillText(l, X + PAD, cy); cy += 6; }
  }

  if (tagRows.length) {
    cy += 36;
    ctx.font = font(600, 30);
    let n = 0;
    for (const row of tagRows) {
      let tx = X + PAD;
      for (const t of row) {
        const w = chipW(t);
        ctx.fillStyle = "rgba(1,13,88,.38)";
        round(ctx, tx, cy, w, 64, 10);
        ctx.fill();
        ctx.fillStyle = TAGS[n++];
        ctx.fillRect(tx + 18, cy + 21, 22, 22);
        ctx.fillStyle = WHITE;
        ctx.fillText(t, tx + 18 + 22 + 16, cy + 43);
        tx += w + 14;
      }
      cy += 78;
    }
  }

  // ── the stub (white), with the ticket perforation ──
  const sy = top + faceH;
  ctx.save();
  round(ctx, X, top, CW, faceH + stubH, 14);
  ctx.clip();
  ctx.fillStyle = WHITE;
  ctx.fillRect(X, sy, CW, stubH);
  ctx.restore();
  ctx.fillStyle = NAVY;
  for (const nx of [X, X + CW]) { ctx.beginPath(); ctx.arc(nx, sy, 22, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = "rgba(1,13,88,.35)";
  ctx.setLineDash([14, 12]);
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(X + 40, sy); ctx.lineTo(X + CW - 40, sy); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#010d58";
  ctx.font = font(800, 60);
  ctx.fillText(RUN, X + PAD, sy + 104);
  ctx.fillStyle = "rgba(1,13,88,.7)";
  ctx.font = font(600, 34);
  ctx.letterSpacing = "3px";
  ctx.fillText(`${site.city.toUpperCase()} · FREE ENTRY`, X + PAD, sy + 164);
  ctx.letterSpacing = "0px";

  // call to action under the card
  y = top + faceH + stubH + 60;
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ctx.font = font(500, 36);
  ctx.fillText("Get your free pass", X, y + 30);
  ctx.fillStyle = LIME;
  ctx.font = font(700, 40);
  ctx.fillText(location.host + withBase("/app"), X, y + 84);

  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("Couldn't make the image."))), "image/png"));
}

/** Button + preview sheet: make the story image, then share it (or save it where sharing files isn't supported). */
export function ShareStory({ person }: { person: CardPerson }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function make() {
    setBusy(true);
    setError("");
    try {
      const blob = await drawStory(person);
      const f = new File([blob], "ubbw-2026-pass.png", { type: "image/png" });
      setFile(f);
      setUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const canShare = !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });
  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: "UB Blockchain Week 2026" });
      haptic.success();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Couldn't open sharing. Save the image instead.");
    }
  }
  function save() {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "ubbw-2026-pass.png";
    a.click();
    haptic.success();
  }
  const close = () => { setFile(null); setUrl(""); setError(""); };

  return (
    <>
      <button className="btn btn-primary wide" style={{ marginTop: 16 }} onClick={make} disabled={busy}>
        <Share2 size={16} /> {busy ? "Making your story…" : "Share to story"}
      </button>
      {error && !url && <p className="form-error">{error}</p>}
      {url &&
        createPortal(
          <div className="sheet-wrap" onClick={close}>
            <div className="sheet story-sheet" role="dialog" aria-label="Share your pass" onClick={(e) => e.stopPropagation()}>
              <button className="icon-btn sheet-x" aria-label="Close" onClick={close}><X size={16} /></button>
              <h2>Share your pass</h2>
              <img src={url} alt="Your UB Blockchain Week 2026 story" className="story-preview" />
              {error && <p className="form-error">{error}</p>}
              <div className="story-actions">
                {canShare && <button className="btn btn-primary wide" onClick={share}><Share2 size={16} /> Share</button>}
                <button className={canShare ? "btn btn-ghost wide" : "btn btn-primary wide"} onClick={save}><Download size={16} /> Save image</button>
              </div>
              <small className="story-hint">Instagram: Share → Stories. No QR on it — your pass stays private.</small>
            </div>
          </div>,
          document.querySelector(".app-shell") ?? document.body,
        )}
    </>
  );
}
