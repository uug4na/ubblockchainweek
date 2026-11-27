// Owner, 2026-11-17: the prize changed (₮10M) and the concept may change too, so the attendee app hides
// prize money and the concept (Prizes + Learn tabs, "Stablecoin & DeFi", amounts) for now.
// Set to true to show them again once the details below are updated.
// Owner, 18 Nov 2026: details match /hackathon again (Real World Mining, ₮10M, Real World Mining 101).
export const HACK_DETAILS_PUBLIC = true;

// Owner, 2026-11-17: hide the whole Hackathon section in the attendee app while the details are reworked.
// Nothing is deleted: teams, files and the group chat stay in the database, and the crew console still
// runs the hackathon. Set to true to bring the section back (Home row, sidebar, Messages group, /app/hack).
// Owner, 18 Nov 2026: open again for Real World Mining (teams register and submit in the app).
export const HACK_SECTION_OPEN = true;

// UB Hackathon 2026: Real World Mining, powered by Global MPC. Owner, 18 Nov 2026: the participant brief
// ("Participant brief and judging guide", proposed rules) for the challenge, workflows, technology, schedule
// and scorecard. Owner, 27 Nov 2026: two prizes only (₮3M / ₮2M, ₮5M in total); registration until 1 Dec,
// shortlist 2 Dec, Demo Day 3 Dec, Pitch Day 4 Dec.
// Before that: the owner's brief "UB Hackathon 2026.pdf", pages 1–6 (12 Nov 2026); hackTracks and
// hackAwards below are from that brief and no longer shown on /hackathon.

export const hackIdea = { title: "Real World Mining", by: "Global MPC" };

export const hackFacts = [
  { label: "Dates", value: "2 – 4 Dec 2026" },
  { label: "Prize pool", value: "₮5M" },
  { label: "Powered by", value: "Global MPC" },
  { label: "Teams", value: "Solo or any size" },
  { label: "Location", value: "Ulaanbaatar, Mongolia" },
];

export const hackStats = [
  { value: "₮5M", label: "prize pool" },
  { value: "8", label: "shortlisted teams" },
  { value: "4", label: "workflows" },
  { value: "100", label: "point scorecard" },
];

// The registration block at the end of /hackathon.
export const hackKeyDates = [
  { label: "Registration", when: "Open now" },
  { label: "Shortlist", when: "2 Dec" },
  { label: "Demo Day", when: "3 Dec" },
  { label: "Final Pitch Day", when: "4 Dec" },
];

export const hackChallenge =
  "A laboratory issues a corrected assay report after the first version has reached a project reviewer. How does the reviewer know which result to use, who approved the correction and which sample it belongs to? Build a prototype that answers a question like this for someone working with Mongolian mining data.";

export const hackWhy = [
  "A sample passes through several hands before its result informs a project decision. Each handover creates a question about identity, custody or authority. A digital record becomes useful when the next person can trace a claim back to its source and see what has changed.",
  "Global MPC describes its approach to mining real-world assets (RWAs) as connecting field evidence, professional verification, digital registries and applications. Its first reference case, Tsagaan Tolgoi in Mongolia, includes exploration and laboratory records. Global MPC states that it has published no mineral resource or reserve estimate for this case. Teams using the case should preserve that distinction in their interfaces.",
];

// Choose a workflow or combine them (24 Nov). `build` = what to help the user do, `demo` = what to show.
export const hackWorkflows = [
  { no: "01", title: "Exploration and assays", user: "Geologist",
    build: "Follow one sample from collection to laboratory receipt and assay.",
    demo: "A mismatched identifier or a corrected result, and how the geologist resolves it." },
  { no: "02", title: "Project review", user: "Reviewer",
    build: "Assemble a dated evidence pack. Link each claim to a document, issuer and review status.",
    demo: "What happens when a document expires or a reviewer withdraws approval." },
  { no: "03", title: "Mineral shipments", user: "Buyer",
    build: "Trace a batch through dispatch and receipt. The UN Transparency Protocol’s Digital Product Passport is a reference for batch identifiers and origin data.",
    demo: "How a split shipment keeps its link to the original lot." },
  { no: "04", title: "Environmental reporting", user: "Mine operator or community reviewer",
    build: "Trace a water measurement to a place, date, method and responsible party.",
    demo: "How a correction reaches someone who saw the earlier reading." },
];

export const hackTech = [
  { title: "Keep it simple", text: "Choose the simplest architecture that lets the intended user check the claim. A signed record can identify the issuer. A hash can show whether a file matches an earlier version. A registry can link revisions, while an API or oracle can deliver a dated result to another application." },
  { title: "Own the source", text: "Explain who takes responsibility for the original measurement and how a reviewer can challenge it. Teams proposing a digital token should specify the record it references, the issuer and what a holder can verify." },
  { title: "For example", text: "Keep a sample report off-chain, record its identifier and hash, and let a reviewer check an uploaded copy. Then change one value and repeat the check. If verification fails, the screen should tell the reviewer what to do next." },
  { title: "Data", text: "Public records, permissioned data or clearly labelled synthetic fixtures are acceptable. Identify simulated integrations. Global MPC’s Registry dApp is under development and its token is pre-issuance, so designs may use a local registry or test network. Access to a sponsor API, a particular chain or a token earns no points by itself." },
];

// Final scorecard, 100 points (proposed in the brief).
export const hackScore = [
  { pts: 20, title: "Problem and user evidence", q: "Who makes the decision today?", full: "A specific workflow and evidence of friction, such as a user interview, a sample form or a documented handover." },
  { pts: 25, title: "Impact in Mongolia", q: "Who would use this locally and what would improve?", full: "A plausible local user, a baseline or a plan to measure it, and a measurable outcome such as time to identify the current report." },
  { pts: 25, title: "Technical design", q: "Can another person trace the claim to its source?", full: "Clear identifiers, issuer authority, access rules and correction handling, with a reason for each technology choice." },
  { pts: 20, title: "Working prototype", q: "Can a judge repeat the core check?", full: "A working end-to-end demonstration with inspectable inputs, an expected result and a handled exception." },
  { pts: 10, title: "Pilot feasibility", q: "What would it take to run a first trial?", full: "A pilot owner or prospective user, data dependencies and a test with a clear success condition." },
];

export const hackJudging = "Each judge scores independently: zero for missing evidence, roughly half for a partially supported claim, full marks when the stated evidence is demonstrated. A judge with a direct interest in a team recuses themselves from scoring that team. Teams are ranked by their mean total; ties go to the prototype score, then local impact, then a recorded panel decision.";

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

// Owner, 27 Nov 2026: ₮5M in two prizes (3 + 2), no other awards. `share` = the prize's part of the pool.
export const hackPool = "₮5,000,000";
export const hackPrizes = [
// `amount` is per team, without the ₮ (the page sets the sign apart: the brand fonts don't draw it well).
  { tier: "#1", place: "1st Place", amount: "3M", share: 60, teams: "1 team" },
  { tier: "#2", place: "2nd Place", amount: "2M", share: 40, teams: "1 team" },
];

export const hackAwards = [
  { no: "01", title: "Best Local Impact", sub: "Ulaanbaatar Utility Award", text: "Best solution tailored to Mongolian merchants, local fintech integration or cross-border trade." },
  { no: "02", title: "Best UX", sub: "“Invisible Crypto” Award", text: "Most seamless onboarding: a non-crypto user can transact in under 30 seconds." },
  { no: "03", title: "Technical Excellence", sub: "Best Smart Contract Architecture", text: "Cleanest, most gas-efficient and secure on-chain implementation." },
  { no: "04", title: "Best Rookie Team", sub: "Students & first-time builders", text: "The highest-scoring team of students or first-time hackathon builders." },
];

// Schedule (owner, 27 Nov): one-page proposals → 8 shortlisted 2 Dec → Demo Day 3 Dec
// (all 8 continue) → Final Pitch Day 4 Dec. Tabs on phones (HackDays.tsx).
// Each step: a short headline (`what`), its parts (`items`), score weights (`scores`) and an outcome (`note`).
export type HackSlot = { time: string; what: string; items?: string[]; scores?: { label: string; pts: number }[]; note?: string; link?: { href: string; label: string } };
export const hackDays: { date: string; day: string; title: string; slots: HackSlot[] }[] = [
  {
    date: "2 Dec", day: "Stage 1", title: "Proposal and shortlist",
    slots: [
      // Owner, 18 Nov: teams submit through the attendee app (/app/hack)
      { time: "Until Dec 1", what: "Submit a one-page proposal in the attendee app",
        items: ["The user and the decision they make", "The evidence they need", "The technology you propose", "One workflow you can demo by 3 December"],
        link: { href: "/app/hack", label: "Submit in the attendee app" } },
      { time: "Wed, Dec 2", what: "Eight teams shortlisted",
        scores: [{ label: "Problem and user evidence", pts: 40 }, { label: "Relevance and feasibility in Mongolia", pts: 35 }, { label: "Demo plan", pts: 25 }] },
    ],
  },
  {
    date: "3 Dec", day: "Stage 2", title: "Demo Day",
    slots: [
      { time: "Thu, Dec 3", what: "Run one workflow, live",
        items: ["5 minutes: the normal case and one exception", "3 minutes: technical questions"],
        note: "All eight teams advance to Pitch Day." },
    ],
  },
  {
    date: "4 Dec", day: "Stage 3", title: "Final Pitch Day",
    slots: [
      { time: "Fri, Dec 4", what: "Pitch to the judges",
        items: ["5 minutes: the first pilot user, the data needed and one measurable outcome", "5 minutes: questions"],
        note: "One final scorecard from both days, then the awards." },
    ],
  },
];
