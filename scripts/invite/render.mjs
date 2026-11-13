// Renders the invitation variants to looping GIF + MP4.
// One headless Chrome over the DevTools protocol: load the page, then for every frame call
// window.__seek(ms) and capture a screenshot, so frames are exact and evenly spaced.
// Usage: node scripts/invite/render.mjs <out-dir> [variant ...]
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FPS = 25; // GIF delays are in 1/100 s, so 25 fps (4 cs) keeps every frame the same length
const VARIANTS = {
  mark: { w: 1080, h: 1350 },
  blocks: { w: 1080, h: 1350 },
  chain: { w: 1080, h: 1920 },
  roll: { w: 1080, h: 1080 },
  "roll-16x9": { page: "roll", query: "&wide", w: 1920, h: 1080 },
  "roll-9x16": { page: "roll", query: "&tall", w: 1080, h: 1920 },
  city: { w: 1080, h: 1350 },
  pixel: { w: 1080, h: 1920 },
  cube: { w: 1080, h: 1350 },
  "cube-wide": { page: "cube", query: "&wide", w: 1920, h: 1004 },
  "cube-16x9": { page: "cube", query: "&f=169", w: 1920, h: 1080 },
  "cube-16x9-text": { page: "cube", query: "&f=169t", w: 1920, h: 1080 },
  "cube-4x3": { page: "cube", query: "&f=43", w: 1440, h: 1080 },
  "cube-9x16": { page: "cube", query: "&f=916", w: 1080, h: 1920 },
};

const out = resolve(process.argv[2] ?? "out");
const pick = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(VARIANTS);
mkdirSync(out, { recursive: true });

const port = 9333;
const profile = resolve(out, ".chrome");
const chrome = spawn(CHROME, ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars", "--allow-file-access-from-files",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch {}
  if (!wsUrl) await sleep(200);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
const events = [];
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else if (msg.method) events.push(msg.method);
});
const send = (method, params = {}) => new Promise((res, rej) => {
  const n = ++id;
  pending.set(n, (msg) => (msg.error ? rej(new Error(method + ": " + msg.error.message)) : res(msg.result)));
  ws.send(JSON.stringify({ id: n, method, params }));
});
const evaluate = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

await send("Page.enable");
try {
  for (const name of pick) {
    const { w, h, page = name, query = "" } = VARIANTS[name];
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    events.length = 0;
    await send("Page.navigate", { url: pathToFileURL(resolve(HERE, `invite-${page}.html`)).href + "?t=0" + query });
    while (!events.includes("Page.loadEventFired")) await sleep(50);
    await evaluate("document.fonts.ready.then(() => Promise.all([...document.images].map((i) => i.decode()))).then(() => true)");
    let loop;
    while (!(loop = await evaluate("window.__loop"))) await sleep(50); // play() builds once fonts are in
    const n = Math.round((loop / 1000) * FPS);
    const dir = resolve(out, `frames-${name}`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < n; i++) {
      await evaluate(`window.__seek(${(i * 1000) / FPS})`);
      const { data } = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
      writeFileSync(resolve(dir, `f${String(i).padStart(4, "0")}.png`), Buffer.from(data, "base64"));
    }
    const frames = resolve(dir, "f%04d.png");
    const base = resolve(out, `ubbw-2026-invite-${name}`);
    // one palette per variant; ordered (bayer) dither stays still between frames instead of crawling
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", frames, "-vf", "palettegen=max_colors=192:stats_mode=full", resolve(dir, "palette.png")]);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", frames, "-i", resolve(dir, "palette.png"),
      "-lavfi", "[0:v][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle", "-loop", "0", base + ".gif"]);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", frames, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-movflags", "+faststart", base + ".mp4"]);
    console.log(`${name}: ${n} frames → ${base}.gif`);
  }
} finally {
  ws.close();
  chrome.kill();
}
