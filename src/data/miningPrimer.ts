// "Real World Mining 101" on /hackathon (owner, 18 Nov 2026): replaces Stablecoin 101 for the Real World Mining
// hackathon. Same five-chapter shape. Sources: public reporting codes (JORC Code 2012, Canada's NI 43-101,
// both in the CRIRSCO family), common QA/QC practice, ISO/IEC 17025, the UN Transparency Protocol, the
// Bre-X (1997) and Brumadinho (2019) public records, and the owner's participant brief (Global MPC, Tsagaan Tolgoi).
// Figures are rounded and widely reported; nothing here is a claim about Global MPC's assets.

export type Rating = 1 | 2 | 3 | 4;

export const minChapters = [
  { id: "basics", no: "01", label: "Basics" },
  { id: "levels", no: "02", label: "Three levels" },
  { id: "check", no: "03", label: "Check a record" },
  { id: "cases", no: "04", label: "Case studies" },
  { id: "build", no: "05", label: "Build safely" },
] as const;
export type MinChapterId = (typeof minChapters)[number]["id"];

// ── 01 basics ───────────────────────────────────────────────────────────────────────────────────
export const minIntro =
  "Before a mine is built, millions of decisions rest on small bags of rock. A sample is cut in the field, shipped to a laboratory, crushed, assayed and reported. Every result is only as good as the record that links it back to the right sample, the right lab and the person who signed it.";

export const minStats = [
  { value: "1", label: "sample ID that has to survive every handover, from drill core to report" },
  { value: "3", label: "levels of certainty a public report can claim: exploration results, resources, reserves" },
  { value: "C$6B", label: "of market value gone when Bre-X’s samples turned out to be salted", note: "1997, widely reported" },
  { value: "0", label: "resource or reserve estimates Global MPC has published for Tsagaan Tolgoi", note: "per the brief" },
];

export const minChain = [
  { title: "Field", text: "A geologist logs where a sample came from: drillhole, depth, coordinates, date. A sample number and a ticket go into the bag. Mistakes here can’t be fixed later." },
  { title: "Custody", text: "Bags are sealed, listed on a dispatch sheet and handed to transport. Each handover should be signed, so a missing or swapped bag shows up at the next step." },
  { title: "Laboratory", text: "The lab checks the seals and the list, prepares the sample and assays it. An accredited lab (ISO/IEC 17025) works to documented methods and issues a signed certificate." },
  { title: "Review", text: "A qualified reviewer checks the results, including the control samples, and decides what the data can support. Corrections arrive as new versions, not silent edits." },
];

export const minControls = [
  { title: "Blanks", text: "Material with no metal in it, slipped into the batch. If a blank comes back with gold, the lab has contamination." },
  { title: "Duplicates", text: "A second split of the same sample under a different number. The two results should agree; if not, preparation or assay is unreliable." },
  { title: "Standards (CRMs)", text: "Certified reference materials with a known grade. They show whether the lab’s numbers are accurate, batch by batch." },
  { title: "Re-assays", text: "Some samples go to a second, independent lab. Agreement between labs is one of the strongest checks a reviewer has." },
];

export const minGlossary = [
  { term: "Assay", def: "A laboratory test for how much of a metal or mineral is in a sample." },
  { term: "Grade", def: "The concentration measured, e.g. grams of gold per tonne (g/t) or percent copper." },
  { term: "Chain of custody", def: "The signed record of who held a sample, when, and in what condition." },
  { term: "QA/QC", def: "Quality assurance and control: blanks, duplicates and standards run with the samples." },
  { term: "Certificate", def: "The lab’s signed report of results for a batch. Corrections are issued as new versions." },
  { term: "Competent Person", def: "The named professional who signs public reports under JORC. NI 43-101 calls it a Qualified Person." },
  { term: "Lot / batch", def: "A group of material moved or sold together. Splits must keep a link to the original lot." },
  { term: "Hash", def: "A short fingerprint of a file. Change one character and the fingerprint changes completely." },
  { term: "Signed record", def: "Data signed with a key, so anyone can check who issued it and that it hasn’t changed." },
];

// ── 02 three levels of certainty ─────────────────────────────────────────────────────────────────
export const minLevelLabels = [
  { key: "certainty", label: "Certainty" },
  { key: "evidence", label: "Evidence needed" },
  { key: "claim", label: "What you can claim" },
] as const;

export const minLevels = [
  {
    id: "exploration", short: "Exploration", name: "Exploration results", examples: "Drill intercepts, assays, maps",
    how: "Individual measurements: this drillhole hit 12 metres at 2.4 g/t gold. Real data, but it says nothing yet about how much metal is in the ground.",
    pro: "Honest, early and useful. Most projects live here for years.",
    con: "Presenting results as if they were a resource, or adding up intercepts into a tonnage, is exactly what the codes forbid.",
    ratings: { certainty: 1, evidence: 1, claim: 1 } as Record<string, Rating>,
  },
  {
    id: "resource", short: "Resources", name: "Mineral resources", examples: "Inferred, Indicated, Measured",
    how: "An estimate of tonnes and grade in the ground with reasonable prospects of eventual extraction, built from enough drilling and QA/QC, and signed by a Competent Person.",
    pro: "The first figure that can be compared across projects.",
    con: "Inferred resources are low confidence. A resource is not yet a mine plan or proof of profit.",
    ratings: { certainty: 2, evidence: 3, claim: 3 } as Record<string, Rating>,
  },
  {
    id: "reserve", short: "Reserves", name: "Ore reserves", examples: "Probable, Proved",
    how: "The part of a resource that can be mined at a profit once mining, processing, legal, environmental and market factors are applied, usually in a feasibility study.",
    pro: "The strongest public claim: what can actually be mined and sold.",
    con: "Expensive to reach and tied to prices and costs. It changes when they do.",
    ratings: { certainty: 4, evidence: 4, claim: 4 } as Record<string, Rating>,
  },
];

export const minLevelNote =
  "These are the categories of the JORC Code (Australasia) and Canada’s NI 43-101, both members of the CRIRSCO family of reporting standards. If your interface shows exploration data, label it as exploration data. Global MPC’s Tsagaan Tolgoi case has no published resource or reserve estimate.";

// ── 03 check a record (interactive) ───────────────────────────────────────────────────────────────
// Synthetic fixture: a made-up assay line, clearly labelled as such on the page.
export const minRecord = {
  sample: "TT-24-0187",
  hole: "DH-012, 46.0–47.0 m",
  lab: "Example Lab LLC (synthetic)",
  method: "Fire assay, 50 g",
  au: "2.41",
  version: 1,
  signedBy: "Lab manager (synthetic)",
};

export const minCheckNote =
  "Only the fingerprint goes on a registry or chain. The report itself stays off-chain, where it can be shared with permission. The fingerprints here are real SHA-256 hashes of the record, computed in your browser.";

// ── 04 case studies ──────────────────────────────────────────────────────────────────────────────
export const minCases = [
  {
    id: "brex", name: "Bre-X, Busang", short: "Bre-X", when: "Indonesia · 1995–97", good: false, tag: "Failed",
    mechanism: "A junior explorer reported huge gold grades from drill core at Busang. Investors trusted the assays; few people could check the samples themselves.",
    event: "Independent drilling found almost no gold. The samples had been salted with gold before they reached the laboratory, and most core had been crushed, so it could not be re-tested.",
    result: "Around C$6 billion of market value disappeared. Canada responded with NI 43-101, which requires a Qualified Person behind public technical reports.",
    lesson: "An assay can be accurate and the sample still be wrong. Custody, duplicates and independent checks are what protect the result.",
  },
  {
    id: "brum", name: "Brumadinho tailings dam", short: "Brumadinho", when: "Brazil · 2019", good: false, tag: "Failed",
    mechanism: "A tailings dam at Vale’s Córrego do Feijão mine carried a stability declaration signed by an external auditor months before.",
    event: "In January 2019 the dam collapsed. Investigations later questioned how the stability had been assessed and certified.",
    result: "About 270 people died. Brazil tightened rules on tailings dams, and the industry adopted a global tailings standard in 2020.",
    lesson: "A signature is only as good as the evidence and independence behind it. Records should show who certified what, on which data, and when.",
  },
  {
    id: "codes", name: "Public reporting codes", short: "JORC", when: "1989 → today", good: true, tag: "Works",
    mechanism: "Codes such as JORC and NI 43-101 require a named, qualified professional to sign every public figure, and limit what each level of data may claim.",
    event: "Exploration results, resources and reserves are reported in fixed categories, with the data, methods and QA/QC disclosed alongside.",
    result: "Investors can compare projects and trace a claim back to an accountable person. Breaches can lead to regulatory action.",
    lesson: "Good records name the issuer, state their authority and keep the level of certainty honest. Build that into the data, not just the PDF.",
  },
  {
    id: "dpp", name: "Digital Product Passport", short: "UN DPP", when: "UN Transparency Protocol", good: true, tag: "Model",
    mechanism: "The UN Transparency Protocol describes a digital passport for products and batches: an identifier, origin data and verifiable claims from the parties involved.",
    event: "Each party issues its own claim about a batch, signed so a buyer can check who said what, and link it to earlier claims.",
    result: "A buyer can trace a lot from mine to customer without trusting a single database, including after the lot is split.",
    lesson: "Give every batch an identifier, let each party sign only its own claim, and keep links when lots split or merge.",
  },
];

// ── 05 build safely ──────────────────────────────────────────────────────────────────────────────
export const minChecklist = [
  { title: "One ID, end to end", text: "Use the same sample or lot ID from the field to the report. Map lab IDs to it explicitly; never rely on names or row order." },
  { title: "Supersede, never overwrite", text: "A corrected report is a new version that points to the old one, with who approved it and why. The old version stays visible." },
  { title: "Record who signed, and their authority", text: "Store the issuer, their role and the date with every claim. A result without an accountable issuer is just a number." },
  { title: "Hash the file, keep the file off-chain", text: "Register the report’s fingerprint, not the report. Anyone with a copy can check it; nobody needs public access to the data." },
  { title: "Keep the level honest", text: "Label exploration results as exploration results. Don’t sum intercepts into tonnes, and don’t imply a resource that hasn’t been published." },
  { title: "Label synthetic data", text: "Fixtures are fine. Mark them clearly, and name any integration you simulated." },
  { title: "Demo the exception", text: "Show the normal case and one failure: a mismatched ID, a superseded report, an expired document or a missing handover." },
  { title: "Say what to do next", text: "When a check fails, the screen should tell the user the next step: whom to ask, which version to use, what not to rely on." },
];

export const minKit = [
  { label: "Data", items: "Public reports, permissioned samples, or clearly labelled synthetic fixtures" },
  { label: "Integrity", items: "SHA-256 file hashes, signed JSON (e.g. W3C Verifiable Credentials)" },
  { label: "Registry", items: "A local registry or a test network. A token or a sponsor API earns no points by itself" },
  { label: "Reference", items: "JORC Code 2012, NI 43-101, ISO/IEC 17025, UN Transparency Protocol" },
];

export const minAsk = [
  { where: "Identity", text: "Which sample, lot or measurement is this, and how do I know it’s the same one?" },
  { where: "Authority", text: "Who issued this claim, and were they entitled to?" },
  { where: "Change", text: "Is this the current version? What changed, and who approved it?" },
  { where: "Access", text: "Who may see the underlying data, and how can a reviewer challenge it?" },
];
