// Get involved form → one email to the team through Resend. Reply-To is the applicant, so answering the mail
// reaches them directly. Public (deploy with --no-verify-jwt); a hidden "website" field catches bots.
// Secrets: RESEND_API_KEY, MAIL_FROM (UBBW 2026 <hello@ubblockchainweek.net>), APPLY_TO (organiser@example.com, comma-separated).

const ROLES: Record<string, string> = { partner: "Partnership", speak: "Speakers", exhibit: "Exhibition", volunteer: "Volunteers" };
const ORIGINS = ["https://www.ubblockchainweek.net", "https://ubblockchainweek.net", "https://michealbuilds.site", "http://localhost:3000"];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const cors = {
    "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  const reply = (status: number, body: object) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "method" });

  const b = await req.json().catch(() => ({}));
  if (b.website) return reply(200, { ok: true });

  const role = ROLES[b.type] ? b.type : "";
  const name = clip(b.name, 120);
  const email = clip(b.email, 200);
  const org = clip(b.org, 200);
  const note = clip(b.note, 4000);
  if (!role || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: "invalid" });

  const to = (Deno.env.get("APPLY_TO") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const from = Deno.env.get("MAIL_FROM");
  const key = Deno.env.get("RESEND_API_KEY");
  if (!to.length || !from || !key) return reply(500, { error: "not configured" });

  const rows: [string, string][] = [["Role", ROLES[role]], ["Name", name], ["Email", email], ["Organisation", org || "—"], ["Note", note || "—"]];
  const html =
    `<h2 style="font-family:sans-serif">UBBW 2026 · ${ROLES[role]}</h2><table style="font-family:sans-serif;font-size:14px">` +
    rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#666;vertical-align:top">${k}</td><td style="white-space:pre-wrap">${esc(v)}</td></tr>`).join("") +
    `</table>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      reply_to: email,
      subject: `${ROLES[role]} application · ${name}${org ? ` (${org})` : ""}`,
      html,
      text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
    }),
  });
  if (!res.ok) {
    console.error("resend", res.status, await res.text());
    return reply(502, { error: "send failed" });
  }
  return reply(200, { ok: true });
});
