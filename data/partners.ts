// 2026 partners, shown on the landing as cards under their type's tab, in the order listed. Add each one as it signs:
// icon: the partner's own square mark, "partners/icons/<file>" under public/brand/ (from their site: favicon / touch icon).
// No icon → their wordmark ("logo") sits white on a navy tile; neither → their initial.
// about: one line, in the partner's own words where they have them.
export type PartnerType = "partner" | "media" | "host" | "sponsor" | "supporter" | "collaboration";
export type Partner = { name: string; type: PartnerType; about?: string; icon?: string; iconBg?: string; logo?: string; href?: string };

// tabs on the landing, left to right; the first is open by default, types with nobody yet are hidden
export const partnerTypes: { id: PartnerType; label: string }[] = [
  { id: "partner", label: "Partners" },
  { id: "media", label: "Media partners" },
  { id: "host", label: "Host" },
  { id: "sponsor", label: "Sponsors" },
  { id: "supporter", label: "Supporters" },
  { id: "collaboration", label: "Collaboration" },
];

// verified by the owner, 22 Oct 2026
export const partners2026: Partner[] = [
  { name: "TenGer HD", type: "host", about: "Host of UB Blockchain Week 2026.", logo: "partners/tenger-hd.png" },
  { name: "Ard", type: "partner", about: "Ard Financial Group, the Mongolian group behind the Ard App.", icon: "partners/icons/ard.png", href: "https://ard.mn" },
  { name: "Unread", type: "partner", about: "Hybrid media company telling stories for the next generation.", icon: "partners/icons/unread.png", href: "https://unread.today" },
  // held back by the owner, 22 Oct — uncomment to announce
  // { name: "Binance", type: "partner", about: "The world's largest crypto exchange by trading volume.", icon: "partners/icons/binance.svg", iconBg: "#181a20", href: "https://www.binance.com" },
  // { name: "Circle", type: "partner", about: "The company behind USDC and the Arc network.", icon: "partners/icons/circle.svg", href: "https://www.circle.com" },
  // { name: "Tether", type: "partner", about: "Issuer of USDT, the most widely used stablecoin.", icon: "partners/icons/tether.svg", href: "https://tether.to" },
  { name: "CryptoRank", type: "partner", about: "Crypto market data, token stats and research.", icon: "partners/icons/cryptorank.svg", href: "https://cryptorank.io" },
  { name: "Paradise Capital", type: "media" }, // TODO: icon, one line and link
];
