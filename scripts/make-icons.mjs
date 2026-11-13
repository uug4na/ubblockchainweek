// Renders the app icons in public/icons from the UBBW block-graph "B" mark.
// Run: node scripts/make-icons.mjs   (re-run after changing the mark or colours)
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const out = path.resolve("public/icons");
fs.mkdirSync(out, { recursive: true });

// The block-graph "B": seven nodes on a hexagon, three back edges faint (same as Toono.tsx).
const N = { t: [253, 91], ul: [110, 175], ur: [398, 175], c: [253, 252], ll: [110, 336], lr: [398, 336], b: [253, 421] };
const line = ([a, b]) => `<line x1="${N[a][0]}" y1="${N[a][1]}" x2="${N[b][0]}" y2="${N[b][1]}"/>`;
const mark = (stroke) => `
  <g transform="scale(${100 / 360}) translate(-76 -76)">
    <g stroke="${stroke}" stroke-width="10" stroke-linecap="round">
      <g opacity=".35">${[["t", "ul"], ["ul", "c"], ["ur", "lr"]].map(line).join("")}</g>
      ${[["t", "ur"], ["t", "b"], ["ul", "ll"], ["ll", "b"], ["b", "lr"], ["c", "ur"], ["c", "lr"]].map(line).join("")}
    </g>
    <g fill="${stroke}">${Object.values(N).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="17"/>`).join("")}</g>
  </g>`;

// scale < 1 shrinks the mark into the centre — maskable icons need it inside the 80% safe zone.
const svg = ({ bg, fg, scale = 0.86 }) => {
  const off = (100 - 100 * scale) / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="${bg}"/>
      <g transform="translate(${off} ${off}) scale(${scale})">${mark(fg)}</g>
    </svg>`,
  );
};

const app = { bg: "#010d58", fg: "#ffffff" };
const crew = { bg: "#c6fc1f", fg: "#010d58" };

const jobs = [
  ["app-192.png", 192, app],
  ["app-512.png", 512, app],
  ["app-maskable-512.png", 512, { ...app, scale: 0.62 }],
  ["apple-touch-icon.png", 180, { ...app, scale: 0.74 }],
  ["crew-192.png", 192, crew],
  ["crew-512.png", 512, crew],
  ["crew-maskable-512.png", 512, { ...crew, scale: 0.62 }],
  ["crew-apple-touch-icon.png", 180, { ...crew, scale: 0.74 }],
];

for (const [name, size, opts] of jobs) {
  await sharp(svg(opts), { density: 400 }).resize(size, size).png().toFile(path.join(out, name));
  console.log("wrote", name);
}
