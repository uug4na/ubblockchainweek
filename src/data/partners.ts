// 2026 partners, shown on the landing as cards under their type's tab, in the order listed. Add each one as it signs:
// icon: the partner's own square mark, "partners/icons/<file>" under public/brand/ (from their site: favicon / touch icon).
// No icon → their wordmark ("logo") sits white on a navy tile; neither → their initial.
// about: one line, in the partner's own words where they have them.
// svg: the mark as an SVG in its own colours on a transparent background (partners/svg/), for the app Home wheel (no tile).
//   svgDark: the brand's own version for dark backgrounds, used in dark mode. onDark: the mark is made for dark
//   backgrounds only (white parts), so in light mode it keeps a navy tile. PNGs are traced with scripts/trace-logo.py.
// appTag: the label on their app wheel card only (the landing keeps its own tags), e.g. "Media partner".
// word: their full wordmark (mark + name) for the website's partner spotlight, e.g. partners/ardcoin.png.
// appSvg / appSvgDark: a different SVG for the app wheel card only (e.g. the full wordmark), light / dark mode.
// tint: the partner's brand colour (taken from their logo), for the dot texture on their app wheel card.
export type PartnerType = "partner" | "media" | "host" | "sponsor" | "supporter" | "collaboration";
export type Partner = { name: string; type: PartnerType; about?: string; icon?: string; iconBg?: string; wide?: boolean; tag?: string; logo?: string; svg?: string; svgDark?: string; onDark?: boolean; tint?: string; appSvg?: string; appSvgDark?: string; appTag?: string; href?: string; word?: string };

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
  { name: "TenGer TV", type: "host", about: "Host of UB Blockchain Week 2026.", logo: "partners/tenger-hd.png", svg: "partners/svg/tenger.svg", svgDark: "partners/svg/tenger-white.svg", tint: "#fe2434" }, // 23 Nov: vector logo from the TenGer brandbook 2021 (p.7), black / white letters + the colour dots
  // Ard (Ard Financial Group, ard.mn) removed 16 Nov 2026: old brand, replaced by AI Group and Ardcoin below
  { name: "Unread", type: "partner", appTag: "Media partner", about: "Hybrid media company telling stories for the next generation.", icon: "partners/svg/unread-mark.svg", svg: "partners/svg/unread-mark.svg", tint: "#0886fa", href: "https://unread.today" , word: "partners/unread-word.png" },
  // 17 Nov 2026: second in line, tagged "Powered by" (owner's call)
  // 23 Nov 2026: Tether announced, "Powered by" next to Global MPC (owner). Logos from tether.to/en/media.
  { name: "Tether", type: "partner", tag: "Powered by", about: "Issuer of USDT, the most widely used stablecoin.", icon: "partners/icons/tether.svg", svg: "partners/svg/tether.svg", tint: "#009393", href: "https://tether.to" },
  { name: "Global MPC", type: "partner", tag: "Powered by", about: "Verification, registry and issuance infrastructure for mining real-world assets.", icon: "partners/icons/globalmpc.svg", svg: "partners/svg/globalmpc.svg", tint: "#c2773f", href: "https://globalmpc.tech" },
  // held back by the owner, 22 Oct — uncomment to announce
  // { name: "Binance", type: "partner", about: "The world's largest crypto exchange by trading volume.", icon: "partners/icons/binance.svg", iconBg: "#181a20", href: "https://www.binance.com" },
  // { name: "Circle", type: "partner", about: "The company behind USDC and the Arc network.", icon: "partners/icons/circle.svg", href: "https://www.circle.com" },
  // added 16 Nov 2026 (owner's logos from Viber; full wordmarks also in partners/aigroup*.png, partners/ardcoin*.png)
  // green marks on the white tile; padding and optical centring are baked into the PNGs
  // 16 Nov: full "aigroup" wordmark instead of the "ai" mark; links to the same site as Ardcoin (owner's call)
  { name: "AI Group", type: "partner", about: "Formerly Ard Financial Group.", icon: "partners/aigroup.png", svg: "partners/svg/aigroup.svg", svgDark: "partners/svg/aigroup-white.svg", tint: "#a4e678", wide: true, href: "https://ardcoin.com" },
  // 23 Nov 2026: "Powered by" (owner). Full wordmark (word) in the spotlight and hero; app cards and the list use
  // the mark from that same wordmark, since their name sits beside it (24 Nov: the wordmark squeezed the app card)
  { name: "Ardcoin", type: "partner", tag: "Powered by", about: "Decentralized loyalty.", icon: "partners/icons/ardcoin.png", svg: "partners/icons/ardcoin.png", tint: "#a4e77f", href: "https://ardcoin.com" , word: "partners/ardcoin.png" },
  { name: "CryptoRank", type: "partner", appTag: "Media partner", about: "Crypto market data, token stats and research.", icon: "partners/icons/cryptorank.svg", svg: "partners/icons/cryptorank.svg", tint: "#0587ff", href: "https://cryptorank.io" },
  // 24 Nov 2026: IDAX, Mongolian crypto exchange (owner). Logo from idax.exchange: full wordmark (word) for the
  // spotlight, the "x" mark (as their favicon) for the website list; white versions for dark mode.
  // 24 Nov: the app card shows the full "idax" wordmark, the x alone wasn't enough (owner)
  { name: "IDAX", type: "partner", about: "Crypto exchange in Mongolia to trade BTC, ETH and more.", icon: "partners/icons/idax.png", svg: "partners/svg/idax.svg", svgDark: "partners/svg/idax-white.svg", appSvg: "partners/svg/idax-word.svg", appSvgDark: "partners/svg/idax-word-white.svg", tint: "#0ecc82", href: "https://www.idax.exchange", word: "partners/idax.png" },
  { name: "UFE", type: "partner", about: "University of Finance and Economics, Ulaanbaatar.", icon: "partners/icons/ufe.svg", svg: "partners/icons/ufe.svg", tint: "#5a83f0", href: "https://ufe.edu.mn" },
  { name: "Paradise Capital", type: "media" }, // TODO: icon, one line and link
];
