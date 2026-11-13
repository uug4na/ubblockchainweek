// UB Hackathon 2026, from the owner's brief "UB Hackathon 2026.pdf", pages 1–6 (12 Nov 2026).
// Copy is the brief's own wording; only typography (dashes, quotes) is cleaned up.

export const hackFacts = [
  { label: "Dates", value: "1–4 Dec 2026" },
  { label: "Prize pool", value: "₮15.5M" },
  { label: "Tracks", value: "3 tracks" },
  { label: "Teams", value: "Solo or any size" },
  { label: "Location", value: "Ulaanbaatar, Mongolia" },
];

export const hackStats = [
  { value: "₮15.5M", label: "prize pool" },
  { value: "10", label: "winning teams" },
  { value: "3", label: "tracks" },
  { value: "100", label: "point judging rubric" },
];

export const hackTracks = [
  {
    no: "01",
    title: "The Stablecoin Economy",
    sub: "Payments & Real-World Commerce",
    focus: "Everyday utility, local merchant adoption, MNT/USD stablecoin on/off-ramps, POS integrations, micro-transactions and cross-border B2B settlements.",
    deliverable: "Consumer apps, Telegram mini-apps or payment gateways that make stablecoins invisible and frictionless.",
  },
  {
    no: "02",
    title: "DeFi & Programmable Liquidity",
    sub: "Yield, Lending & Markets",
    focus: "Lending and borrowing, stablecoin liquidity pools, AMMs, delta-neutral yield strategies and RWA collateralization.",
    deliverable: "Smart contract protocols, yield vaults or on-chain treasury tools with sound cryptoeconomic logic.",
  },
  {
    no: "03",
    title: "Consumer Web3, Gaming & Account Abstraction",
    focus: "Stablecoin-powered in-game economies, automated rewards, gasless transactions (ERC-4337 / smart accounts) and SocialFi.",
    deliverable: "Apps or games where stablecoins settle underneath, without complex wallet management.",
  },
];

// Owner, 13 Nov 2026: ten places, ₮15.5M in total (5 + 2×2 + 3×1.5 + 4×0.5). `share` = the tier's part of the pool.
export const hackPool = "₮15,500,000";
export const hackPrizes = [
// `amount` is per team, without the ₮ (the page sets the sign apart: the brand fonts don't draw it well).
  { tier: "Gold", place: "1st Place", amount: "5M", share: 32, teams: "1 team" },
  { tier: "Silver", place: "2nd Place", amount: "2M", share: 26, teams: "2 teams" },
  { tier: "Bronze", place: "3rd Place", amount: "1.5M", share: 29, teams: "3 teams" },
  { tier: "Special", place: "Special Awards", amount: "500K", share: 13, teams: "4 teams" },
];

export const hackAwards = [
  { no: "01", title: "Best Local Impact", sub: "Ulaanbaatar Utility Award", text: "Best solution tailored to Mongolian merchants, local fintech integration or cross-border trade." },
  { no: "02", title: "Best UX", sub: "“Invisible Crypto” Award", text: "Most seamless onboarding: a non-crypto user can transact in under 30 seconds." },
  { no: "03", title: "Technical Excellence", sub: "Best Smart Contract Architecture", text: "Cleanest, most gas-efficient and secure on-chain implementation." },
  { no: "04", title: "Best Rookie Team", sub: "Students & first-time builders", text: "The highest-scoring team of students or first-time hackathon builders." },
];

// Owner, 13 Nov 2026: three stages. Register and submit (15–23 Nov) → the 20 selected teams pitch online
// (27 Nov) → the final 10 build and compete at UBBW (30 Nov – 4 Dec). Tabs on phones (HackDays.tsx).
export const hackDays = [
  {
    date: "15–23 Nov", day: "Stage 1", title: "Register and submit your project",
    slots: [
      { time: "Sun, Nov 15", what: "Registration opens" },
      { time: "Mon, Nov 23", what: "Last day to submit your project" },
    ],
  },
  {
    date: "27 Nov", day: "Stage 2", title: "Top 20: online pitch",
    slots: [
      { time: "After Nov 23", what: "20 teams selected for the online pitch" },
      { time: "Fri, Nov 27", what: "Pitch your idea online; the final 10 teams are announced" },
    ],
  },
  {
    date: "30 Nov – 4 Dec", day: "Stage 3", title: "Final 10: build and compete",
    slots: [
      { time: "Mon, Nov 30", what: "Online meeting with mentors" },
      { time: "Tue, Dec 1", what: "Kickoff" },
      { time: "Wed, Dec 2 – Thu, Dec 3", what: "Two build days" },
      { time: "Fri, Dec 4", what: "Pitch day and awards" },
    ],
  },
];
