// Configures Supabase Auth for UBBW through the Management API (no dashboard clicking):
//   npx tsx scripts/auth-setup.mts
// Reads from .env.local: SUPABASE_URL, SUPABASE_ACCESS_TOKEN (sbp_…), and optionally
// GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, RESEND_API_KEY + MAIL_FROM, APP_URL. Applies whatever is present.
// Prints only what changed — never the secrets.
import fs from "node:fs";
import dns from "node:dns/promises";

for (const f of [".env.local"]) if (fs.existsSync(f)) process.loadEnvFile(f);
const e = process.env;
const ref = e.SUPABASE_URL?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!ref || !e.SUPABASE_ACCESS_TOKEN) {
  console.error("Need SUPABASE_URL and SUPABASE_ACCESS_TOKEN in .env.local.");
  process.exit(1);
}

// Where the app is served. Vercel since 2026-11-09 (was GitHub Pages at michealbuilds.site/ubbw-2026).
const SITE = (e.APP_URL || "https://ubbw-2026.vercel.app").replace(/\/+$/, "");
const codeEmail = (heading: string) => `
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#2b1e17;background:#fbf5ec;border-radius:16px">
  <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#9c3b1d">UB Blockchain Week 2026</p>
  <h1 style="margin:0 0 16px;font-size:22px">${heading}</h1>
  <p style="margin:0 0 8px">Your code:</p>
  <p style="margin:0 0 20px;font-size:34px;font-weight:700;letter-spacing:.25em;font-family:ui-monospace,monospace">{{ .Token }}</p>
  <p style="margin:0;font-size:13px;color:#8b7463">It works for a few minutes. If you didn't ask for it, ignore this email.</p>
</div>`;

const patch: Record<string, unknown> = {
  site_url: `${SITE}/app/`,
  // live, Vercel preview deploys, local dev, and the old Pages address (harmless)
  uri_allow_list: [`${SITE}/**`, "https://ubbw-2026-*.vercel.app/**", "http://localhost:3000/**", "https://michealbuilds.site/ubbw-2026/**"].join(","),
  // Email code sign-in (no magic links — codes work when the email opens in another app).
  mailer_otp_length: 6,
  mailer_subjects_magic_link: "Your UBBW 2026 sign-in code",
  mailer_templates_magic_link_content: codeEmail("Sign in to UBBW 2026"),
  mailer_subjects_confirmation: "Your UBBW 2026 sign-in code",
  mailer_templates_confirmation_content: codeEmail("Welcome to UBBW 2026"),
};
const applied = [`return URLs (${SITE} + previews + localhost)`, "6-digit email codes + UBBW email design"];

if (e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET) {
  Object.assign(patch, { external_google_enabled: true, external_google_client_id: e.GOOGLE_CLIENT_ID, external_google_secret: e.GOOGLE_CLIENT_SECRET });
  applied.push("Google sign-in");
}
// Resend only sends from a verified domain; its DKIM record proves it. Without it every code email bounces.
const fromAddr = e.MAIL_FROM?.match(/<(.+)>/)?.[1] ?? e.MAIL_FROM ?? "";
const mailDomain = fromAddr.split("@")[1];
const verified = mailDomain ? await dns.resolveTxt(`resend._domainkey.${mailDomain}`).then(() => true, () => false) : false;
if (e.RESEND_API_KEY && e.MAIL_FROM && !verified) {
  applied.push(`NOT switching email to Resend yet — ${mailDomain} isn't verified in Resend (no resend._domainkey record)`);
}
if (e.RESEND_API_KEY && e.MAIL_FROM && verified) {
  const m = e.MAIL_FROM.match(/^(.*)<(.+)>$/);
  Object.assign(patch, {
    smtp_host: "smtp.resend.com",
    smtp_port: "465",
    smtp_user: "resend",
    smtp_pass: e.RESEND_API_KEY,
    smtp_admin_email: (m ? m[2] : e.MAIL_FROM).trim(),
    smtp_sender_name: (m ? m[1] : "UBBW 2026").trim(),
    rate_limit_email_sent: 60,
  });
  applied.push(`email through Resend from ${e.MAIL_FROM}`);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${e.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify(patch),
});
if (!res.ok) {
  console.error(`Supabase said ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
const cfg = (await res.json()) as Record<string, unknown>;
console.log("Applied:\n  · " + applied.join("\n  · "));
console.log(`Now: google=${cfg.external_google_enabled} · smtp=${cfg.smtp_host ?? "Supabase built-in (a few emails/hour)"} · site=${cfg.site_url}`);
