// "The Future of Money" research conference (Эрдэм шинжилгээний хурал), shown as a section on /program.
// Owner, 13 Nov 2026: ₮3M prize pool; registration opens 15 Nov and closes 30 Nov 23:59; the final (pitch day)
// is Tue 1 Dec, 11:00–17:00. Registration + abstracts are in the attendee app (/app/research, app_research_submit);
// crew reviewers read them in /staff/research.
// Still the 12 Nov DRAFT ("make something up from 2025"), confirm before deploying: the themes, "Who", "Language".

export const fomFacts = [
  { label: "Final", value: "Tue 1 Dec 2026" },
  { label: "Time", value: "11:00–17:00" },
  { label: "Prize pool", value: "₮3M" },
  { label: "Who", value: "Students, researchers" },
  { label: "Language", value: "MN / EN" },
];

export const fomThemes = [
  { title: "Stablecoins & the tugrik", text: "Dollar stablecoins, a tugrik-backed coin, and what both mean for dollarization and the central bank." },
  { title: "Digital currencies", text: "CBDCs and a digital tugrik: design choices, privacy, and lessons from countries that already launched." },
  { title: "Payments & remittances", text: "Cheaper cross-border payments, merchant adoption, and how on-chain money reaches people outside banks." },
  { title: "Tokenized assets", text: "Bonds, funds, commodities and land registries on-chain, and what tokenization could do for Mongolian markets." },
  { title: "DeFi & financial stability", text: "Lending, liquidity and depegs: measuring risk in open financial systems and how failures spread." },
  { title: "Policy & regulation", text: "Licensing, AML and consumer protection for virtual assets, in Mongolia and compared with other jurisdictions." },
];

export const fomSteps = [
  { date: "15 Nov", title: "Registration opens", text: "Register in the UBBW app with your paper title and abstract." },
  { date: "30 Nov", title: "Registration closes", text: "Last entries at 23:59, Ulaanbaatar time." },
  { date: "1 Dec", title: "Final: pitch day", text: "11:00–17:00. Present your research to the jury. Winners share the ₮3M prize pool." },
];

export const fomLast = {
  photo: "research/08",
  caption: "2025 winners, “Blockchain and its uses”, with UFE",
  figures: [
    { n: "₮2M", label: "first prize in 2025" },
    { n: "₮1M", label: "second prize in 2025" },
    { n: "BA · MA", label: "students presented" },
  ],
};
