// Local server for the carousel maker. Serves the repo root (so public/brand images and fonts load
// same-origin) and stores everything the editor makes on disk:
//   scripts/carousel/projects/<name>.json   carousels (autosaved by the editor)
//   scripts/carousel/uploads/<id>.<ext>     uploaded photos and logos
//   scripts/carousel/out/<name>/...         PNG / PDF exports ("Save to folder")
// Usage: node scripts/carousel/serve.mjs [port] [--lan]   →  http://localhost:4321/scripts/carousel/
//   --lan also listens on your network address so teammates on the same Wi-Fi can edit.
import { createServer } from "node:http";
import { readFile, writeFile, stat, mkdir, readdir, unlink } from "node:fs/promises";
import { resolve, extname, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { networkInterfaces } from "node:os";
import { randomBytes } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const DIRS = { projects: resolve(HERE, "projects"), uploads: resolve(HERE, "uploads"), out: resolve(HERE, "out") };
const args = process.argv.slice(2);
const PORT = +(args.find((a) => /^\d+$/.test(a)) ?? 4321);
const LAN = args.includes("--lan");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".woff2": "font/woff2", ".pdf": "application/pdf",
};
for (const d of Object.values(DIRS)) await mkdir(d, { recursive: true });

// project names become file names: keep them plain
const safe = (s) => String(s || "").normalize("NFC").replace(/[^\p{L}\p{N} _.-]/gu, "").replace(/^\.+/, "").trim().slice(0, 80);
const inside = (base, file) => file === base || file.startsWith(base + sep);
async function body(req, limit = 80 * 1024 * 1024) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > limit) throw Object.assign(new Error("too large"), { code: 413 }); chunks.push(c); }
  return Buffer.concat(chunks);
}
const json = (res, code, data) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(data)); };

async function api(req, res, path) {
  const [, , kind, rawName] = path.split("/"); // /api/<kind>/<name>
  const name = safe(rawName && decodeURIComponent(rawName));

  if (kind === "projects" && !rawName && req.method === "GET") {
    const files = (await readdir(DIRS.projects)).filter((f) => f.endsWith(".json"));
    const list = await Promise.all(files.map(async (f) => ({ name: f.slice(0, -5), updated: (await stat(resolve(DIRS.projects, f))).mtimeMs })));
    return json(res, 200, list.sort((a, b) => b.updated - a.updated));
  }
  if (kind === "projects" && name) {
    const file = resolve(DIRS.projects, name + ".json");
    if (!inside(DIRS.projects, file)) return json(res, 400, { error: "bad name" });
    if (req.method === "GET") return res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }).end(await readFile(file));
    if (req.method === "PUT") {
      const buf = await body(req);
      JSON.parse(buf.toString("utf8")); // refuse anything that isn't JSON
      await writeFile(file, buf);
      return json(res, 200, { ok: true, name });
    }
    if (req.method === "DELETE") { await unlink(file); return json(res, 200, { ok: true }); }
  }
  if (kind === "upload" && req.method === "POST") {
    const { data } = JSON.parse((await body(req, 30 * 1024 * 1024)).toString("utf8"));
    const m = /^data:image\/(png|jpeg|webp|svg\+xml);base64,(.+)$/s.exec(data || "");
    if (!m) return json(res, 400, { error: "not an image" });
    const ext = { png: "png", jpeg: "jpg", webp: "webp", "svg+xml": "svg" }[m[1]];
    const file = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}.${ext}`;
    await writeFile(resolve(DIRS.uploads, file), Buffer.from(m[2], "base64"));
    return json(res, 200, { path: "/scripts/carousel/uploads/" + file });
  }
  if (kind === "export" && name && req.method === "POST") {
    const { files } = JSON.parse((await body(req, 200 * 1024 * 1024)).toString("utf8"));
    const dir = resolve(DIRS.out, name);
    if (!inside(DIRS.out, dir)) return json(res, 400, { error: "bad name" });
    const written = [];
    for (const f of files || []) {
      const file = resolve(dir, String(f.name).split("/").map(safe).join(sep));
      if (!inside(dir, file)) continue;
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, f.base64 ? Buffer.from(f.base64, "base64") : String(f.text ?? ""));
      written.push(file);
    }
    return json(res, 200, { ok: true, dir, count: written.length });
  }
  return json(res, 404, { error: "unknown api" });
}

createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.startsWith("/api/")) return await api(req, res, path);
    if (path === "/") { res.writeHead(302, { location: "/scripts/carousel/" }); return res.end(); }
    let file = resolve(ROOT, "." + path);
    if (!inside(ROOT, file) || /[\\/]\.(env|git|data)/.test(file.slice(ROOT.length))) throw 0; // repo only, no secrets
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(data);
  } catch (e) {
    if (e?.code === 413) return json(res, 413, { error: "too large" });
    if (req.url.startsWith("/api/")) return json(res, 500, { error: String(e?.message || e) });
    res.writeHead(404).end("not found");
  }
}).listen(PORT, LAN ? "0.0.0.0" : "127.0.0.1", () => {
  const url = `http://localhost:${PORT}/scripts/carousel/`;
  console.log(`Carousel maker → ${url}`);
  if (LAN) for (const nets of Object.values(networkInterfaces())) for (const n of nets || [])
    if (n.family === "IPv4" && !n.internal) console.log(`  on your network → http://${n.address}:${PORT}/scripts/carousel/`);
  console.log(`Projects → ${DIRS.projects}\nExports  → ${DIRS.out}`);
  if (process.platform === "win32" && !process.env.NO_OPEN) exec(`start "" "${url}"`);
});
