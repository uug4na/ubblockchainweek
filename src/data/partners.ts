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
// dark: the logo for dark backgrounds (white or brand colour, partners/dark/), from the vault
//   "Assets/Partner logos 2026" (27 Nov 2026); used by the website partner mosaic.
// tint: the partner's brand colour (taken from their logo), for the dot texture on their app wheel card.
export type PartnerType = "partner" | "media" | "host" | "sponsor" | "supporter" | "collaboration";
export type Partner = { name: string; type: PartnerType; about?: string; icon?: string; iconBg?: string; wide?: boolean; tag?: string; logo?: string; svg?: string; svgDark?: string; onDark?: boolean; tint?: string; appSvg?: string; appSvgDark?: string; appTag?: string; href?: string; word?: string; dark?: string };

// tabs on the landing, left to right; the first is open by default, types with nobody yet are hidden
export const partnerTypes: { id: PartnerType; label: string }[] = [
  { id: "partner", label: "Partners" },
  { id: "media", label: "Media partners" },
  { id: "host", label: "Host" },
  { id: "sponsor", label: "Sponsors" },
  { id: "supporter", label: "Supporters" },
  { id: "collaboration", label: "Collaboration" },
];

// verified by the owner, 22 Oct 2026. 27 Nov 2026: owner's new list, three groups only: Powered by (type "partner" +
// tag "Powered by"), Partner, Supporter. Paradise Capital dropped; Unread and CryptoRank moved to Supporters.
export const partners2026: Partner[] = [
  { name: "TenGer TV", type: "host", about: "Host of UB Blockchain Week 2026.", logo: "partners/tenger-hd.png", svg: "partners/svg/tenger.svg", svgDark: "partners/svg/tenger-white.svg", tint: "#fe2434" }, // 23 Nov: vector logo from the TenGer brandbook 2021 (p.7), black / white letters + the colour dots. 27 Nov: not in the website partner section (3 groups only), still the app's host card
  // Ard (Ard Financial Group, ard.mn) removed 16 Nov 2026: old brand, replaced by AI Group and Ardcoin below
  // held back by the owner, 22 Oct — uncomment to announce
  // { name: "Binance", type: "partner", about: "The world's largest crypto exchange by trading volume.", icon: "partners/icons/binance.svg", iconBg: "#181a20", href: "https://www.binance.com" },
  // { name: "Circle", type: "partner", about: "The company behind USDC and the Arc network.", icon: "partners/icons/circle.svg", href: "https://www.circle.com" },

  // ── Powered by ──
  // 23 Nov 2026: "Powered by" (owner). Full wordmark (word) in the spotlight and hero; app cards and the list use
  // the mark from that same wordmark, since their name sits beside it (24 Nov: the wordmark squeezed the app card)
  { name: "Ardcoin", dark: "partners/dark/ardcoin.png", type: "partner", tag: "Powered by", about: "Decentralized loyalty.", icon: "partners/icons/ardcoin.png", svg: "partners/icons/ardcoin.png", tint: "#a4e77f", href: "https://ardcoin.com" , word: "partners/ardcoin.png" },
  // 23 Nov 2026: Tether announced, "Powered by" next to Global MPC (owner). Logos from tether.to/en/media.
  { name: "Tether", dark: "partners/dark/tether.svg", type: "partner", tag: "Powered by", about: "Issuer of USDT, the most widely used stablecoin.", icon: "partners/icons/tether.svg", svg: "partners/svg/tether.svg", tint: "#009393", href: "https://tether.to", word: "partners/tether.svg" },
  { name: "Global MPC", dark: "partners/dark/globalmpc.svg", type: "partner", tag: "Powered by", about: "Verification, registry and issuance infrastructure for mining real-world assets.", icon: "partners/icons/globalmpc.svg", svg: "partners/svg/globalmpc.svg", tint: "#c2773f", href: "https://globalmpc.tech" },

  // ── Partner ──
  // added 16 Nov 2026 (owner's logos from Viber; full wordmarks also in partners/aigroup*.png, partners/ardcoin*.png)
  // green marks on the white tile; padding and optical centring are baked into the PNGs
  // 16 Nov: full "aigroup" wordmark instead of the "ai" mark; links to the same site as Ardcoin (owner's call)
  { name: "AI Group", dark: "partners/dark/aigroup.png", type: "partner", about: "Formerly Ard Financial Group.", icon: "partners/aigroup.png", svg: "partners/svg/aigroup.svg", svgDark: "partners/svg/aigroup-white.svg", tint: "#a4e678", wide: true, href: "https://ardcoin.com" },
  // 24 Nov 2026: IDAX, Mongolian crypto exchange (owner). Logo from idax.exchange: full wordmark (word) for the
  // spotlight, the "x" mark (as their favicon) for the website list; white versions for dark mode.
  // 24 Nov: the app card shows the full "idax" wordmark, the x alone wasn't enough (owner)
  { name: "IDAX", dark: "partners/dark/idax.svg", type: "partner", about: "Crypto exchange in Mongolia to trade BTC, ETH and more.", icon: "partners/icons/idax.png", svg: "partners/svg/idax.svg", svgDark: "partners/svg/idax-white.svg", appSvg: "partners/svg/idax-word.svg", appSvgDark: "partners/svg/idax-word-white.svg", tint: "#0ecc82", href: "https://www.idax.exchange", word: "partners/idax.png" },
  { name: "UFE", dark: "partners/dark/ufe.png", type: "partner", about: "University of Finance and Economics, Ulaanbaatar.", icon: "partners/icons/ufe.svg", svg: "partners/icons/ufe.svg", tint: "#5a83f0", href: "https://ufe.edu.mn" },

  // ── Supporter ── (owner's sheet order, column by column). 27 Nov: logos are the favicons / touch icons from each site. Nomad DAO: X profile picture; Gej Yu Ve: Facebook profile picture; Cryptoverse: the CV mark cropped from the owner's logo file (no link)
  { name: "Монголбанк", dark: "partners/dark/mongolbank.png", type: "supporter", about: "Bank of Mongolia, the central bank.", icon: "partners/icons/mongolbank.png", tint: "#1b3f8f", href: "https://www.mongolbank.mn" },
  { name: "Санхүүгийн зохицуулах хороо", dark: "partners/dark/szh.png", type: "supporter", about: "Financial Regulatory Commission of Mongolia.", icon: "partners/icons/frc.png", tint: "#2a5aa8", href: "https://frc.mn" },
  { name: "IT Park", dark: "partners/dark/itpark.png", type: "supporter", about: "National Information Technology Park.", icon: "partners/icons/itpark.png", tint: "#14128a", href: "https://www.itpark.mn" },
  { name: "Certify", dark: "partners/dark/certify.png", type: "supporter", about: "Diplomas verified on the blockchain.", icon: "partners/icons/certify.png", tint: "#2f7de1", href: "https://certify.mn" },
  { name: "Nomad DAO", dark: "partners/dark/nomaddao.png", type: "supporter", icon: "partners/icons/nomaddao.png", tint: "#000000", href: "https://x.com/NOMADxDAO" },
  { name: "Binance Academy", dark: "partners/dark/binanceacademy.png", type: "supporter", icon: "partners/icons/binance.svg", svg: "partners/icons/binance.svg", tint: "#f0b90b", href: "https://academy.binance.com" },
  { name: "Unread", dark: "partners/dark/unread.png", type: "supporter", about: "Hybrid media company telling stories for the next generation.", icon: "partners/svg/unread-mark.svg", svg: "partners/svg/unread-mark.svg", tint: "#0886fa", href: "https://unread.today" , word: "partners/unread-word.png" },
  { name: "МУИС", dark: "partners/dark/muis.png", type: "supporter", about: "National University of Mongolia.", icon: "partners/icons/num.png", tint: "#1b4a96", href: "https://www.num.edu.mn" },
  { name: "CryptoRank", dark: "partners/dark/cryptorank.svg", type: "supporter", about: "Crypto market data, token stats and research.", icon: "partners/icons/cryptorank.svg", svg: "partners/icons/cryptorank.svg", tint: "#0587ff", href: "https://cryptorank.io" },
  { name: "Cryptoverse", dark: "partners/dark/cryptoverse.png", type: "supporter", icon: "partners/icons/cryptoverse.png", tint: "#8f7de0" },
  { name: "Techworm", dark: "partners/dark/techworm.png", type: "supporter", icon: "partners/icons/techworm.png", tint: "#f2e600", href: "https://techworm.mn" },
  { name: "Gej Yu Ve", dark: "partners/dark/gejyuve.png", type: "supporter", icon: "partners/icons/gejyuve.png", tint: "#5ecbbf", href: "https://www.facebook.com/GejYuVe/" },
  { name: "Ediin Zasag", dark: "partners/dark/ez.png", type: "supporter", about: "Economy newsroom.", icon: "partners/icons/ez.svg", svg: "partners/icons/ez.svg", tint: "#111111", href: "https://ediinzasag.mn" },
  { name: "Lemon Press", dark: "partners/dark/lemonpress.png", type: "supporter", about: "The key business, tech, investment and finance news in 5 minutes.", icon: "partners/icons/lemonpress.png", tint: "#ff4f79", href: "https://lemonpress.mn" },
];
