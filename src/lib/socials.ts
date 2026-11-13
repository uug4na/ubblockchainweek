// Optional social handles on a profile, and the business card QR (a vCard any phone camera can save).

export type Network = "instagram" | "x" | "linkedin" | "facebook";
export type Socials = Partial<Record<Network, string>>;

export const networks: { id: Network; label: string; placeholder: string; url: (h: string) => string }[] = [
  { id: "instagram", label: "Instagram", placeholder: "@yourname", url: (h) => `https://instagram.com/${h}` },
  { id: "x", label: "X", placeholder: "@yourname", url: (h) => `https://x.com/${h}` },
  { id: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/yourname", url: (h) => `https://www.linkedin.com/in/${h}` },
  { id: "facebook", label: "Facebook", placeholder: "facebook.com/yourname", url: (h) => `https://facebook.com/${h}` },
];

// "@name", "name" or a pasted profile link → "name" (the database keeps the same characters)
export function toHandle(input: string) {
  let s = input.trim();
  try {
    if (/^(https?:\/\/|www\.|[a-z]+\.(com|me)\/)/i.test(s)) {
      const u = new URL(s.startsWith("http") ? s : `https://${s}`);
      const parts = u.pathname.split("/").filter(Boolean);
      s = parts[0] === "in" || parts[0] === "pub" ? parts[1] ?? "" : parts[0] ?? "";
    }
  } catch {}
  return s.replace(/^@/, "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 60);
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

export function vcard(p: { name: string; about: string; interests?: string[]; socials: Socials }) {
  const words = p.name.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop()! : "";
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${esc(last)};${esc(words.join(" "))};;;`, `FN:${esc(p.name.trim())}`];
  const note = [p.about, p.interests?.length ? `Here for: ${p.interests.join(", ")}` : ""].filter(Boolean).join("\n");
  if (note) lines.push(`NOTE:${esc(note)}`);
  for (const n of networks) {
    const h = p.socials[n.id];
    if (h) lines.push(`URL;type=${n.label}:${n.url(h)}`);
  }
  lines.push("END:VCARD");
  return lines.join("\n");
}

// Hands the phone a .vcf file; iOS and Android open it as "Add to Contacts".
export function saveContact(p: { name: string; about: string; interests?: string[]; socials: Socials }) {
  const url = URL.createObjectURL(new Blob([vcard(p)], { type: "text/vcard" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${p.name.trim().replace(/[^\p{L}\p{N} _-]/gu, "") || "contact"}.vcf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
