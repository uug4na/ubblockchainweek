// The 2025 week, from the previous team's photos (public/brand/2025/recap, optimised to WebP).
// Facts are only what the posters and photos themselves show: dates from the partner posters,
// prizes from the event posters, team names from the captions on the hackathon photos.

export const recap = (p: string, small = false) => `/brand/2025/recap/${p}${small ? "-s" : ""}.webp`;

export const week2025 = { dates: "24–28 November 2025", short: "24–28 Nov" };

// the "peek inside" cards on the report (first four also on the landing teaser)
export const stats2025 = [
  { n: "5", label: "days", sub: "24–28 November", tone: "cyan" },
  { n: "₮23M", label: "in prizes", sub: "Hackathon and research", tone: "green" },
  { n: "11", label: "hackathon teams", sub: "Web3 games, built in teams", tone: "lime" },
  { n: "15", label: "partners", sub: "Exchanges, universities, studios", tone: "magenta" },
  { n: "2", label: "campus tours", sub: "МУИС and СЭЗИС", tone: "violet" },
  { n: "4", label: "flagship events", sub: "Hack, research, policy, campus", tone: "blue" },
];

// photos for the right-to-left strips: a mix of all three rooms
export const reel2025 = [
  "hack/07", "research/08", "roundtable/03", "hack/09", "research/04", "roundtable/08",
  "hack/03", "research/07", "roundtable/09", "hack/13", "research/02", "roundtable/02",
];
export const reel2025b = [
  "roundtable/05", "hack/14", "research/06", "roundtable/10", "hack/12", "research/11",
  "roundtable/07", "hack/02", "research/03", "roundtable/04", "hack/05", "research/10",
];

export const hackTeams = [
  { name: "Ultra", photo: "hack/01" },
  { name: "Beginner", photo: "hack/02" },
  { name: "DanDar", photo: "hack/04" },
  { name: "Mini Max", photo: "hack/05" },
  { name: "Khan Solution", photo: "hack/06" },
  { name: "MandaDeal", photo: "hack/08" },
  { name: "Abracadabra", photo: "hack/10" },
  { name: "Shinx", photo: "hack/11" },
  { name: "Pixel Nomad", photo: "hack/12" },
  { name: "POP Bros", photo: "hack/14" },
  { name: "Together stronger", photo: "hack/15" },
];

// partner posters, logo crops in the same order (names only where the logo spells them out)
export const partners2025: { src: string; name: string }[] = [
  "IDAX", "Cryptoverse", "", "Corex", "", "ШУТИС", "IT Park Mongolia", "Unread", "МУИС", "Altex", "", "Lemon Press", "Geree", "UFE", "",
].map((name, i) => ({ src: `partners/p${String(i + 1).padStart(2, "0")}`, name }));
export const binanceTour = "partners/p16";
