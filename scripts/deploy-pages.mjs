// Builds the static app and publishes it to the public Pages repo.
//   node scripts/deploy-pages.mjs            (add --no-push to only build into out/)
// Source stays in the private repo; only the compiled site (out/) goes to
// github.com/0xdmicheal/ubbw-2026 → https://michealbuilds.site/ubbw-2026/ (account domain + repo name).
// The browser talks straight to Supabase, so the publishable key is baked in from .env.local.
// Env is set here (not in an npm script) so Git Bash can't rewrite "/ubbw-2026" into a Windows path.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO = process.env.PAGES_REPO ?? "0xdmicheal/ubbw-2026";
const BASE = process.env.BASE_PATH ?? "/" + REPO.split("/")[1];
const push = !process.argv.includes("--no-push");

if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be in .env.local — the app can't sign anyone in without them.");
  process.exit(1);
}

fs.rmSync("out", { recursive: true, force: true });
execSync("npx next build", { stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_BASE_PATH: BASE } });

// GitHub Pages runs Jekyll by default, which hides the _next/ folder.
fs.writeFileSync("out/.nojekyll", "");

// The export writes route-segment payloads as folders (app/scan/__next.app/scan/__PAGE__.txt)
// but client navigation asks for one dotted file (app/scan/__next.app.scan.__PAGE__.txt).
// Add the flat copies so in-app navigation doesn't 404 and fall back to full page loads.
let flattened = 0;
function flatten(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith("__next.")) {
      const walk = (d, parts) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) walk(p, [...parts, e.name]);
          else {
            fs.copyFileSync(p, path.join(dir, [entry.name, ...parts, e.name].join(".")));
            flattened++;
          }
        }
      };
      walk(full, []);
    } else if (entry.name !== "_next") flatten(full);
  }
}
flatten("out");
console.log(`\nBuilt out/ for ${BASE}/ (${flattened} segment payloads flattened)`);
if (!push) process.exit(0);

const sh = (cmd) => execSync(cmd, { stdio: "inherit", cwd: "out" });
const commit = execSync("git rev-parse --short HEAD").toString().trim();
sh("git init -q -b main");
sh('git config user.name "0xdmicheal"');
sh('git config user.email "79036284+0xdmicheal@users.noreply.github.com"');
sh("git add -A");
sh(`git commit -q -m "Deploy from ubbw-2026-source@${commit}"`);
// Each deploy replaces the previous one; the site repo keeps no history worth keeping.
sh(`git push -q -f https://github.com/${REPO}.git main`);
console.log(`Pushed to ${REPO}. Live in a minute at https://michealbuilds.site${BASE}/`);
