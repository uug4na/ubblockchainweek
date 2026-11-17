// UB Blockchain Passport → Apple Wallet (.pkpass). Setup and secrets: README.md next to this file.
//   POST (signed in, Authorization: Bearer <user token>) → { url }: a link that works for 5 minutes.
//   GET  ?d=<data>&s=<sig> → the signed .pkpass. Safari opens it straight in Wallet ("Add").
// Two steps because Wallet only opens a pass that Safari navigates to (not one fetched by script), and a
// navigation can't carry the sign-in header. The link is signed, so nobody can make a pass for someone else.
// Deploy: supabase functions deploy wallet-pass --no-verify-jwt   (POST checks the user itself through app_me)
import forge from "npm:node-forge@1.3.1";
import { strToU8, zipSync } from "npm:fflate@0.8.2";
import { images } from "./images.ts";

const ORIGINS = ["https://www.ubblockchainweek.net", "https://ubblockchainweek.net", "https://michealbuilds.site", "http://localhost:3000"];
const env = (k: string) => Deno.env.get(k) ?? "";
const SITE = (env("SITE_URL") || "https://ubblockchainweek.net").replace(/\/+$/, "");

// ── the signed link ──
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", strToU8(env("WALLET_LINK_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", key, strToU8(data))));
}
type Holder = { pass: string; name: string; checkedIn: boolean; exp: number };

// ── the pass ──
function passJson(h: Holder) {
  const card = `${SITE}/card/?c=UBBW:U:${h.pass}`; // the same QR as the Passport in the app (door, merch, contact)
  return {
    formatVersion: 1,
    passTypeIdentifier: env("PASS_TYPE_ID"),
    teamIdentifier: env("APPLE_TEAM_ID"),
    serialNumber: h.pass,
    organizationName: "UB Blockchain Week",
    description: "UB Blockchain Passport",
    logoText: "Passport",
    // the 2025 brand: blue card, white type, green labels
    backgroundColor: "rgb(41, 69, 213)",
    foregroundColor: "rgb(255, 255, 255)",
    labelColor: "rgb(1, 254, 109)",
    relevantDate: "2026-11-30T09:00:00+08:00",
    expirationDate: "2026-12-06T23:59:00+08:00",
    eventTicket: {
      primaryFields: [{ key: "name", label: "UB BLOCKCHAIN PASSPORT", value: h.name }],
      secondaryFields: [
        { key: "dates", label: "DATES", value: "30 Nov – 5 Dec 2026" },
        { key: "city", label: "CITY", value: "Ulaanbaatar" },
      ],
      auxiliaryFields: [
        { key: "code", label: "CODE", value: h.pass },
        { key: "status", label: "ENTRANCE", value: h.checkedIn ? "Checked in" : "Show at the door" },
      ],
      backFields: [
        { key: "how", label: "How it works", value: "Show this QR at the entrance desk, at the merch desk, and to people you meet. It's the same QR as the Passport in the UBBW app." },
        { key: "app", label: "Attendee app", value: `${SITE}/app/`, attributedValue: `<a href="${SITE}/app/">Open the UBBW app</a>` },
      ],
    },
    barcodes: [{ format: "PKBarcodeFormatQR", message: card, messageEncoding: "iso-8859-1", altText: h.pass }],
  };
}

function sign(manifest: Uint8Array) {
  const cert = forge.pki.certificateFromPem(env("PASS_CERT_PEM"));
  // the key exported from Keychain is usually encrypted (PASS_KEY_PASSPHRASE); a plain PEM key works too
  const key = env("PASS_KEY_PASSPHRASE")
    ? forge.pki.decryptRsaPrivateKey(env("PASS_KEY_PEM"), env("PASS_KEY_PASSPHRASE"))
    : forge.pki.privateKeyFromPem(env("PASS_KEY_PEM"));
  if (!key) throw new Error("PASS_KEY_PEM / PASS_KEY_PASSPHRASE don't match");
  const wwdr = forge.pki.certificateFromPem(env("WWDR_PEM"));
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(String.fromCharCode(...manifest));
  p7.addCertificate(cert);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign({ detached: true });
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return Uint8Array.from(der, (c: string) => c.charCodeAt(0));
}

async function pkpass(h: Holder) {
  const files: Record<string, Uint8Array> = { "pass.json": strToU8(JSON.stringify(passJson(h))) };
  for (const [name, b64] of Object.entries(images)) files[name] = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const manifest: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(files)) {
    const sha1 = new Uint8Array(await crypto.subtle.digest("SHA-1", bytes));
    manifest[name] = Array.from(sha1, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  files["manifest.json"] = strToU8(JSON.stringify(manifest));
  files["signature"] = sign(files["manifest.json"]);
  return zipSync(files, { level: 6 });
}

const configured = () => ["PASS_TYPE_ID", "APPLE_TEAM_ID", "PASS_CERT_PEM", "PASS_KEY_PEM", "WWDR_PEM", "WALLET_LINK_SECRET"].every((k) => env(k));

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const cors = {
    "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!configured()) return reply(503, { error: "Apple Wallet isn't set up yet." });

  try {
    if (req.method === "POST") {
      // who is asking: the app's own "me", with the caller's sign-in
      const auth = req.headers.get("authorization") ?? "";
      const me = await fetch(`${env("SUPABASE_URL")}/rest/v1/rpc/app_me`, {
        method: "POST",
        headers: { Authorization: auth, apikey: env("SUPABASE_ANON_KEY"), "Content-Type": "application/json" },
        body: "{}",
      });
      if (!me.ok) return reply(401, { error: "Sign in first." });
      const u = (await me.json())?.user;
      if (!u?.id) return reply(401, { error: "Sign in first." });
      const h: Holder = { pass: u.id, name: String(u.name ?? "").slice(0, 60), checkedIn: !!u.verifiedAt, exp: Date.now() + 5 * 60_000 };
      const d = b64u(strToU8(JSON.stringify(h)));
      return reply(200, { url: `${env("SUPABASE_URL")}/functions/v1/wallet-pass?d=${d}&s=${await hmac(d)}` });
    }

    if (req.method === "GET") {
      const q = new URL(req.url).searchParams;
      const d = q.get("d") ?? "", s = q.get("s") ?? "";
      if (!d || s !== (await hmac(d))) return new Response("This link isn't valid. Open your Passport in the app and tap Add to Apple Wallet again.", { status: 403 });
      const h = JSON.parse(new TextDecoder().decode(unb64u(d))) as Holder;
      if (Date.now() > h.exp) return new Response("This link has expired. Open your Passport in the app and tap Add to Apple Wallet again.", { status: 410 });
      return new Response(await pkpass(h), {
        headers: {
          "Content-Type": "application/vnd.apple.pkpass",
          "Content-Disposition": `attachment; filename="UBBW-Passport-${h.pass}.pkpass"`,
          "Cache-Control": "no-store",
        },
      });
    }
    return reply(405, { error: "method" });
  } catch (e) {
    console.error("wallet-pass", e);
    return reply(500, { error: "Couldn't make the Wallet pass. Try again." });
  }
});
