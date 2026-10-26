// Get involved form → one email to the organiser through Resend (REST, no SDK). Sent from the verified
// ubblockchainweek.net domain; Reply-To is the applicant so the organiser can answer straight from the inbox.
// Needs RESEND_API_KEY in the Vercel project's environment variables.

const FROM = "UB Blockchain Week <contact@ubblockchainweek.net>";
const TO = "Gantsatsral@tngr.tv";

const roles: Record<string, { title: string; prompt: string }> = {
  partner: { title: "Partnership", prompt: "What would you like to support?" },
  speak: { title: "Speakers", prompt: "What would you talk about?" },
  exhibit: { title: "Exhibition", prompt: "What would you show?" },
  volunteer: { title: "Volunteers", prompt: "Which days are you free?" },
};

// 2025 brand in email-safe markup: tables + inline styles, navy header with the white lockup (PNG, not webp,
// for Outlook), green role tag and reply button with navy text, 4px corners.
const LOGO = "https://www.ubblockchainweek.net/assets/logo-white.png";
const FONT = "Poppins,'Segoe UI',Helvetica,Arial,sans-serif";

function letter({ role, name, email, fields }: { role: string; name: string; email: string; fields: [string, string][] }) {
  const field = ([k, v]: [string, string], i: number) =>
    `<tr><td style="padding:16px 0;${i ? "border-top:1px solid #e6e8f2" : ""}">` +
    `<div style="font:600 11px/1.4 ${FONT};letter-spacing:.08em;text-transform:uppercase;color:#6b7194">${esc(k)}</div>` +
    `<div style="padding-top:4px;font:400 16px/1.5 ${FONT};color:#010d58;white-space:pre-wrap">${esc(v)}</div></td></tr>`;
  return (
    `<!doctype html><html><body style="margin:0;padding:0;background:#eef0f7">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f7"><tr><td align="center" style="padding:32px 16px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-radius:4px;overflow:hidden;background:#ffffff">` +
    `<tr><td style="background:#010d58;padding:28px 32px">` +
    `<img src="${LOGO}" width="128" height="44" alt="UB Blockchain Week" style="display:block;border:0">` +
    `<div style="padding-top:28px;font:600 12px/1.4 ${FONT};letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.6)">New application</div>` +
    `<div style="padding-top:6px;font:700 26px/1.25 ${FONT};color:#ffffff">${esc(name)}</div>` +
    `<div style="padding-top:14px"><span style="display:inline-block;padding:5px 10px;border-radius:4px;background:#01fe6d;font:600 12px/1.2 ${FONT};letter-spacing:.04em;color:#010d58">${esc(role)}</span></div>` +
    `</td></tr>` +
    `<tr><td style="padding:12px 32px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${fields.map(field).join("")}</table></td></tr>` +
    `<tr><td style="padding:8px 32px 32px"><a href="mailto:${esc(email)}" style="display:inline-block;padding:13px 22px;border-radius:4px;background:#01fe6d;font:600 15px/1 ${FONT};color:#010d58;text-decoration:none">Reply to ${esc(name.split(" ")[0])}</a></td></tr>` +
    `</table>` +
    `<div style="max-width:560px;padding:16px 0 0;font:400 12px/1.5 ${FONT};color:#8a8fad">Sent from the Get involved form on ubblockchainweek.net</div>` +
    `</td></tr></table></body></html>`
  );
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function POST(request: Request) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return Response.json({ error: "Email is not configured" }, { status: 500 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Bad request" }, { status: 400 });
  // honeypot: people never see this field, bots fill it in
  if (clip(body.website, 200)) return Response.json({ ok: true });

  const role = roles[clip(body.type, 20)];
  const name = clip(body.name, 120);
  const email = clip(body.email, 200);
  const org = clip(body.org, 200);
  const note = clip(body.note, 4000);
  if (!role || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Please fill in your name and a valid email" }, { status: 400 });
  }

  const rows: [string, string][] = [["Role", role.title], ["Name", name], ["Email", email], ["Organisation", org || "—"], [role.prompt, note || "—"]];
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  const html = letter({ role: role.title, name, email, fields: rows.slice(2) });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [TO], reply_to: email, subject: `Get involved · ${role.title} · ${name}`, text, html }),
  });
  if (!res.ok) {
    console.error("Resend", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "Could not send, please try again" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
