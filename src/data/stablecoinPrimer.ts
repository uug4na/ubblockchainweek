// "Stablecoin 101" on /hackathon: a primer for first-time and junior builders.
// Base text from the owner (12 Nov 2026), expanded. Figures checked 12 Nov 2026:
// - $7.2T Feb 2026 volume vs ACH $6.8T: Artemis via Cointelegraph (raw on-chain volume; analysts dispute the comparison).
// - B2B $13.4B (2026) → $5T (2035): Juniper Research forecast, Apr 2026.
// - Iron Finance June 2021 and Ethena USDe Oct 2025 cases added 13 Nov 2026 (approximate figures from public post-mortems and press).

export type Rating = 1 | 2 | 3 | 4;

export const primerChapters = [
  { id: "basics", no: "01", label: "Basics" },
  { id: "designs", no: "02", label: "Three designs" },
  { id: "peg", no: "03", label: "Holding the peg" },
  { id: "cases", no: "04", label: "Case studies" },
  { id: "build", no: "05", label: "Build safely" },
] as const;
export type ChapterId = (typeof primerChapters)[number]["id"];

// ── 01 basics ───────────────────────────────────────────────────────────────────────────────────
export const primerIntro =
  "A stablecoin is a token built to hold a steady value against a reference asset, almost always the US dollar. It joins what blockchains do well (borderless, 24/7, programmable) with what commerce and accounting need: a price that doesn't move.";

export const primerStats = [
  { value: "$300B+", label: "stablecoins in circulation, 2026" },
  { value: "$7.2T", label: "on-chain volume in Feb 2026, past the US ACH network’s $6.8T", note: "Artemis data, raw transfers" },
  { value: "~6.5%", label: "average cost of sending a remittance the traditional way" },
  { value: "$5T", label: "cross-border B2B stablecoin payments forecast for 2035, up from ~$13.4B in 2026", note: "Juniper Research" },
];

export const primerUnderHood = [
  { title: "It’s just a token contract", text: "On Ethereum and its L2s a stablecoin is an ERC-20 contract: balances, transfer, approve. The same coin also lives on other chains as SPL (Solana) or TRC-20 (Tron)." },
  { title: "Mint in, burn out", text: "New coins are minted when value comes in (dollars to an issuer, or collateral to a contract) and burned when someone redeems. Supply follows demand." },
  { title: "Mind the decimals", text: "USDC and USDT use 6 decimals, DAI uses 18. So 1 USDC is 1,000,000 units on-chain. Mixing them up is one of the most common hackathon bugs." },
  { title: "Issuers keep admin keys", text: "Centrally issued coins like USDC and USDT can pause the contract and freeze addresses. Your transfers can revert for reasons outside your code." },
];

export const primerUses = [
  { title: "Cross-border B2B payments", text: "The fastest-growing use. A supplier invoice settles in minutes, even on a weekend, instead of days through correspondent banks and SWIFT." },
  { title: "Remittances & payroll", text: "Workers and families send and receive dollars globally for a fraction of the ~6.5% that traditional transfers average." },
  { title: "DeFi’s base layer", text: "The main quote currency in AMM pools and the main asset lent and borrowed in on-chain credit markets." },
  { title: "Trading & treasury", text: "The original use: park value between trades without leaving the chain. Companies and DAOs now hold treasuries in them too." },
];

export const primerGlossary = [
  { term: "Peg", def: "The target price, usually $1.00." },
  { term: "Depeg", def: "When the market price drifts meaningfully off the peg." },
  { term: "Redemption", def: "Handing coins back to the issuer or protocol for the underlying value." },
  { term: "Collateral ratio", def: "Value locked ÷ stablecoins minted. 200% means $2 of backing per $1." },
  { term: "Liquidation", def: "Forced sale of a position’s collateral when its ratio falls too low." },
  { term: "Oracle", def: "A service that brings off-chain prices on-chain, e.g. Chainlink." },
  { term: "AMM", def: "Automated market maker: a pool that prices swaps by formula, e.g. Uniswap, Curve." },
  { term: "CDP", def: "Collateralized debt position: a vault holding collateral against minted stablecoins." },
  { term: "Paymaster", def: "An ERC-4337 contract that pays gas for users, so they can pay fees in USDC or nothing at all." },
];

// ── 02 designs ──────────────────────────────────────────────────────────────────────────────────
export const primerDesigns = [
  {
    id: "fiat",
    short: "Fiat",
    name: "Fiat-backed",
    examples: "USDC, USDT",
    backing: 100,
    backingLabel: "$1 in cash or T-bills per coin",
    how: "A company holds $1 in bank deposits or short-term US Treasuries for every coin it issues, and mints or burns as customers deposit and redeem.",
    pro: "Very stable and easy to scale. By far the most used model.",
    con: "Centralized: you trust the issuer, its banks and its regulators. Coins can be frozen.",
    ratings: { stability: 4, decentralization: 1, efficiency: 3 } as Record<string, Rating>,
  },
  {
    id: "crypto",
    short: "Crypto",
    name: "Crypto-collateralized",
    examples: "DAI / USDS, LUSD",
    backing: 150,
    backingLabel: "$1.50+ of crypto per coin",
    how: "Users lock volatile crypto such as ETH in a smart contract and mint stablecoins against it. Because the collateral can crash, every position must be over-collateralized.",
    pro: "Transparent and decentralized: anyone can check the backing on-chain.",
    con: "Capital inefficient: you lock $150 or more to mint $100. Relies on liquidations and oracles working under stress.",
    ratings: { stability: 3, decentralization: 3, efficiency: 1 } as Record<string, Rating>,
  },
  {
    id: "algo",
    short: "Algorithmic",
    name: "Algorithmic",
    examples: "UST, IRON (both failed)",
    backing: 40,
    backingLabel: "Less than $1 of real backing",
    how: "Little or no collateral. The peg is held by incentives: a volatile companion token is minted or burned so arbitrageurs push the price back to $1.",
    pro: "Extremely capital efficient and scalable, while confidence lasts.",
    con: "Structurally fragile. When confidence breaks, minting more of the companion token feeds a “death spiral”.",
    ratings: { stability: 1, decentralization: 3, efficiency: 4 } as Record<string, Rating>,
  },
];
export const primerRatingLabels = [
  { key: "stability", label: "Stability" },
  { key: "decentralization", label: "Decentralization" },
  { key: "efficiency", label: "Capital efficiency" },
];
export const primerNewer = [
  { title: "Synthetic dollars", text: "e.g. Ethena’s USDe: backed by crypto plus an equal short futures position, so the two cancel out. Pays yield from funding rates, and carries the risk that those rates turn negative." },
  { title: "Yield-bearing & RWA-backed", text: "Tokens backed by tokenized Treasuries or other real-world assets that pass interest through to holders. Often restricted to verified investors." },
];

// ── 03 peg ──────────────────────────────────────────────────────────────────────────────────────
export const primerArb = [
  { side: "Below $1", price: "$0.98", steps: ["Buy the cheap coin on the market", "Redeem it with the issuer or protocol for $1.00", "Keep the 2¢; supply shrinks and the price rises"] },
  { side: "Above $1", price: "$1.02", steps: ["Mint a new coin for $1.00", "Sell it on the market for $1.02", "Keep the 2¢; supply grows and the price falls"] },
];
export const primerArbNote =
  "This loop only works while redemption is open and trusted. With USDC and USDT, only verified accounts redeem directly; everyone else relies on those arbitrageurs keeping the market honest.";

export const primerVault = { collateral: 200, debt: 100, minRatio: 150, penalty: 13 };

export const primerOracleNote =
  "The contract only knows the ETH price through an oracle. Read it from a robust feed like Chainlink and check how fresh it is. Never price collateral off a single AMM pool: a flash loan can move that price for one block and drain your protocol.";

// ── 04 cases ───────────────────────────────────────────────────────────────────────────────────
export const primerCases = [
  {
    id: "terra",
    short: "Terra",
    tag: "Algorithmic failure",
    good: false,
    name: "Terra UST",
    when: "May 2022",
    peg: 0,
    pegLabel: "→ $0",
    mechanism: "UST held $1 through LUNA, not cash. Anyone could always burn 1 UST for $1 of newly minted LUNA. Demand was propped up by Anchor, a protocol paying about 19.5% on UST deposits.",
    event: "Large withdrawals and sell orders pushed UST just under $1. Holders rushed to redeem, and the protocol minted LUNA at a furious pace to pay them.",
    result: "A death spiral. LUNA supply went from about 343 million to 6.5 trillion in a week, both tokens fell to near zero, and around $45 billion of market value vanished, setting off contagion across crypto.",
    lesson: "A peg backed only by a second token and market confidence is a bank run waiting to happen. Unsustainable yield is a warning sign, not a feature.",
  },
  {
    id: "dai",
    short: "DAI",
    tag: "Over-collateralization held",
    good: true,
    name: "MakerDAO DAI",
    when: "March 2020",
    peg: 1.11,
    pegLabel: "$1.11",
    mechanism: "DAI is minted from over-collateralized vaults (CDPs) on Ethereum. If a vault’s ratio drops too far, its ETH is auctioned to repay the debt.",
    event: "On “Black Thursday” ETH fell about 43% in a day. Mass liquidations hit while gas fees spiked and the network clogged.",
    result: "DAI held. Borrowers scrambled to buy DAI to repay loans, briefly pushing it above the peg to about $1.11. But some auctions cleared for zero bids, leaving millions in bad debt that Maker covered by minting and selling MKR.",
    lesson: "Strict over-collateralization protected the peg even as collateral lost almost half its value. The plumbing (liquidation bots, auctions, gas) has to survive the same stress.",
  },
  {
    id: "iron",
    short: "IRON",
    tag: "Partial backing failed",
    good: false,
    name: "Iron Finance IRON",
    when: "June 2021",
    peg: 0.75,
    pegLabel: "≈ $0.75",
    mechanism: "IRON was only partly backed: about 75% by a dollar stablecoin and 25% by TITAN, the protocol’s own token. Redeeming 1 IRON paid out that mix, and new TITAN was minted to cover its share.",
    event: "Big holders sold TITAN, its price slipped, and IRON dipped below $1. Users rushed to redeem, which minted more TITAN, which they sold straight away.",
    result: "A bank run in a day. TITAN fell from about $64 to almost zero, IRON lost its peg, and the protocol shut down. Its own post-mortem called it the first large-scale bank run in crypto.",
    lesson: "Any part of a peg backed by your own token can be printed into worthlessness. Under stress, a 25% gap is enough to sink the whole coin.",
  },
  {
    id: "usde",
    short: "USDe",
    tag: "Backing held, one venue broke",
    good: true,
    name: "Ethena USDe",
    when: "October 2025",
    peg: 0.65,
    pegLabel: "$0.65",
    mechanism: "USDe is a synthetic dollar: it holds crypto collateral and shorts the same amount in futures, so the position stays worth about $1 whatever the price does.",
    event: "During the market crash of 10 October 2025, one large exchange priced USDe from its own thin order book. The price there fell to about $0.65 and triggered liquidations of users who had posted USDe as collateral.",
    result: "On other venues and in on-chain redemptions USDe stayed close to $1, and the backing was fine. The damage came from one exchange’s price feed; it later compensated affected users.",
    lesson: "Where you read the price matters as much as what backs the coin. Never value collateral from a single venue: use robust oracles and check the price against more than one market.",
  },
];

/* Hidden (owner, 13 Nov 2026): the Tether USDT (May 2022, $0.95) and Circle USDC (March 2023, SVB, $0.87)
   case studies were removed because both issuers are UBBW core partners. Their text is in the vault log
   (ubbw-2026 › 04 Log › 2026-11-13). */

// ── 05 build ───────────────────────────────────────────────────────────────────────────────────
export const primerChecklist = [
  { title: "Respect decimals", text: "Read decimals() from the token. USDC and USDT use 6, DAI uses 18. Never hard-code 1e18." },
  { title: "Use SafeERC20", text: "USDT on Ethereum doesn’t return a bool from transfer, and needs its allowance set to 0 before you change it. OpenZeppelin’s SafeERC20 handles both." },
  { title: "Price with oracles, not pools", text: "Use Chainlink or similar, check that the price is fresh, and never trust a single AMM spot price." },
  { title: "Plan for a depeg", text: "Don’t hard-code 1 USDC = $1 in lending or liquidation math. Test your app with the price at $0.90." },
  { title: "Expect freezes and pauses", text: "Issuers can blacklist addresses or pause the token. Make sure one reverting transfer can’t lock everyone else’s funds." },
  { title: "Guard every external call", text: "Follow checks-effects-interactions, add reentrancy guards, and build on audited libraries rather than your own math." },
  { title: "Ask for exact approvals", text: "Request only the amount you need, or use permit (EIP-2612, which USDC supports) instead of unlimited approvals." },
  { title: "Hide the crypto", text: "With ERC-4337 smart accounts and paymasters, users can pay gas in USDC or not at all. Great for Track 01 and 03 demos." },
];

export const primerKit = [
  { label: "Contracts", items: "Foundry or Hardhat · OpenZeppelin Contracts" },
  { label: "Front end", items: "viem + wagmi · RainbowKit or ConnectKit" },
  { label: "Prices", items: "Chainlink Data Feeds" },
  { label: "Test money", items: "Circle’s testnet USDC faucet · Sepolia, Base Sepolia" },
  { label: "Smart accounts", items: "ERC-4337 bundlers and paymasters" },
];

export const primerRules = [
  { where: "United States", text: "The GENIUS Act (July 2025) requires payment stablecoins to be backed 1:1 by cash or short-term Treasuries, with monthly reserve disclosures." },
  { where: "European Union", text: "MiCA’s stablecoin rules have applied since June 2024: issuers need a licence and must hold reserves and honour redemptions at par." },
];
