// SAMPLE LINEUP — fictional people used as placeholders until speakers are confirmed.

export type Speaker = { id: string; name: string; role: string; topic: string; hue: number };

export const speakers: Speaker[] = [
  { id: "anu", name: "Anu Batbayar", role: "Founder, community fintech", topic: "Ecosystem", hue: 14 },
  { id: "temuulen", name: "Temuulen Ganbold", role: "Remittance researcher", topic: "Finance", hue: 36 },
  { id: "saruul", name: "Saruul Erdene", role: "Lawyer, digital assets policy", topic: "Policy", hue: 205 },
  { id: "bilguun", name: "Bilguun Dorj", role: "Smart contract engineer", topic: "Builders", hue: 95 },
  { id: "nomin", name: "Nomin Tsogt", role: "Community lead, UB meetups", topic: "Community", hue: 340 },
  { id: "enkhjin", name: "Enkhjin Bat-Erdene", role: "Supply-chain product lead", topic: "Ecosystem", hue: 24 },
  { id: "lena", name: "Lena Fischer", role: "Cryptography researcher", topic: "Research", hue: 200 },
  { id: "kenji", name: "Kenji Morita", role: "Infrastructure engineer", topic: "Builders", hue: 120 },
  { id: "priya", name: "Priya Raman", role: "Public goods funding", topic: "Ecosystem", hue: 44 },
  { id: "daniel", name: "Daniel Okafor", role: "Founder, payments", topic: "Finance", hue: 8 },
  { id: "sofia", name: "Sofia Marín", role: "Artist & onchain curator", topic: "Culture", hue: 320 },
  { id: "minjun", name: "Min-jun Park", role: "Product designer, wallets", topic: "Design", hue: 180 },
];

export const speakerById = Object.fromEntries(speakers.map((s) => [s.id, s]));

export function initials(name: string) {
  return name
    .split(/\s|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
}
