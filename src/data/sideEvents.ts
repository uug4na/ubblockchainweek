// Example side events — replace with real submissions as they're approved.

export type SideEvent = {
  id: string;
  day: string;
  start: string;
  end: string;
  title: string;
  host: string;
  area: string;
  tag: "Breakfast" | "Roundtable" | "Workshop" | "Meetup" | "Party" | "Outdoors";
  description: string;
};

export const sideEvents: SideEvent[] = [
  { id: "se1", day: "2026-12-01", start: "08:30", end: "10:00", title: "Women builders' breakfast", host: "UB Women Builders", area: "Sükhbaatar district", tag: "Breakfast", description: "Pancakes, introductions and a warm room. All women and non-binary folks in or curious about Web3." },
  { id: "se2", day: "2026-12-01", start: "10:00", end: "12:00", title: "Stablecoins & remittances roundtable", host: "Finance working group", area: "Chingeltei district", tag: "Roundtable", description: "Banks, fintechs and builders on moving money home. Chatham House rules." },
  { id: "se3", day: "2026-12-01", start: "11:00", end: "13:00", title: "Students' first dApp", host: "University blockchain clubs", area: "Bayanzürkh district", tag: "Workshop", description: "Run by students, for students. Laptops required, experience not." },
  { id: "se4", day: "2026-12-01", start: "13:00", end: "15:00", title: "Cashmere, provenance & traceability", host: "Supply-chain circle", area: "Khan-Uul district", tag: "Roundtable", description: "Herders' co-ops, brands and builders on proving origin." },
  { id: "se5", day: "2026-12-01", start: "15:00", end: "17:00", title: "Nomad devs coffee", host: "Remote builders crew", area: "Sükhbaatar district", tag: "Meetup", description: "For everyone who flew in. Coffee, SIM card tips and a crash course in UB." },
  { id: "se6", day: "2026-12-01", start: "16:00", end: "18:00", title: "Energy & mining roundtable", host: "Infra collective", area: "Chingeltei district", tag: "Roundtable", description: "Grid realities, winter demand and responsible infrastructure." },
  { id: "se7", day: "2026-12-01", start: "18:00", end: "21:00", title: "Founders' hotpot", host: "UB founders circle", area: "Sükhbaatar district", tag: "Party", description: "Small tables, big pots. Founders and would-be founders only — be kind, be honest." },
  { id: "se8", day: "2026-12-02", start: "07:30", end: "08:30", title: "Sunrise run (or walk)", host: "Run club UB", area: "Sükhbaatar Square", tag: "Outdoors", description: "Five easy kilometres in the cold. Everyone finishes together." },
  { id: "se9", day: "2026-12-03", start: "21:00", end: "23:59", title: "After-hours art night", host: "Onchain artists collective", area: "Khan-Uul district", tag: "Party", description: "Projection art, DJs and a small print shop. Bring a friend who's never heard of NFTs." },
  { id: "se10", day: "2026-12-04", start: "12:00", end: "14:00", title: "Pre-hack lunch for first-time hackers", host: "UB Hack mentors", area: "Hack Hall", tag: "Meetup", description: "Nervous about your first hackathon? Come eat with mentors and meet other first-timers." },
];
