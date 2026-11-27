// Single source of truth for event-level facts.
// TODO: dates and contact details are placeholders — confirm before launch.

export const site = {
  name: "UB Blockchain Week 2026",
  short: "UBBW 2026",
  // Where the live site is served (Vercel since 2026-11-09; share previews + sitemap use it).
  origin: "https://www.ubblockchainweek.net",
  city: "Ulaanbaatar",
  country: "Mongolia",
  dates: "November 30 – December 5, 2026",
  startISO: "2026-11-30T09:00:00+08:00",
  endISO: "2026-12-05T23:59:00+08:00",
  tz: "Asia/Ulaanbaatar",
  email: "hello@example.com",
  handle: "@ubbw2026",
  hashtag: "#UBBW2026",
  // UBBW's channels (owner, 24 Nov 2026), shown in the website footer and the app's Profile (components/UbbwLinks.tsx).
  // telegram: no channel yet, so it isn't shown anywhere.
  social: {
    instagram: "https://www.instagram.com/ubblockchainweek",
    facebook: "https://www.facebook.com/ubblockchainweek/",
    threads: "https://www.threads.com/@ubblockchainweek",
    x: "https://x.com/UBBlockchainWk",
    telegram: "https://t.me/",
  },
  luma: "https://luma.com/ubbw",          // the UBBW calendar on Luma
  lumaEvent: "https://luma.com/eg5oarf5", // the UB Blockchain Week 2026 event page on Luma
};

// The public UB Hack page (/hackathon) is temporarily hidden. While false: it's out of the header,
// footer and sitemap, the page itself shows a 404, and links that pointed to it go to the attendee
// app's hackathon section instead. Set back to true to bring everything back; nothing was deleted.
export const hackathonPublic = true;
export const hackHref = hackathonPublic ? "/hackathon" : "/app/hack";

// Google Form the team collects applications with (owner, 16 Nov 2026: easier for them to receive this way).
// The landing's Get involved cards open it by default.
export const applyForm = "https://docs.google.com/forms/d/e/1FAIpQLSeOBvLuWUCwRkwg5UT2qLiDrLgiy0-NO4eLcdw4FxMnm94U5w/viewform";

// allDay: the label is the day's one full-day event, with no set hours, so it isn't a session (no poster or stars).
export type Day = { date: string; short: string; month: string; weekday: string; label: string; blurb: string; allDay?: boolean };

export const days: Day[] = [
  { date: "2026-11-30", short: "30", month: "Nov", weekday: "Mon", label: "TenGer Panel 1", blurb: "The first TenGer panel, AMAs with Erchim Labs and Certify, UB Blockchain тойм EP1." },
  { date: "2026-12-01", short: "1", month: "Dec", weekday: "Tue", label: "Roundtable", blurb: "A workshop at IT Park, the stablecoin roundtable at Монголбанк, AMAs with Nomad Dao and E-Geree, UB Blockchain тойм EP2." },
  { date: "2026-12-02", short: "2", month: "Dec", weekday: "Wed", label: "Demo Show", blurb: "TenGer Panel 2 on RWA, AMAs with X-Meta and Cryptoverse, University Tour at СЭЗИС (Binance), the Demo Show and UB Blockchain тойм EP3." },
  { date: "2026-12-03", short: "3", month: "Dec", weekday: "Thu", label: "Hackathon Dev Day", blurb: "Hackathon Dev Day at IT Park, the research conference final at СЭЗИС, University Tour at МУИС, AMAs with Khatun and Global MPC." },
  { date: "2026-12-04", short: "4", month: "Dec", weekday: "Fri", label: "Hackathon final", blurb: "The last TenGer panel, the hackathon final, AMAs with idax and one more, and UB Blockchain тойм EP5." },
  { date: "2026-12-05", short: "5", month: "Dec", weekday: "Sat", label: "ХӨРӨНГӨ ОРУУЛАГЧ ҮНДЭСТЭН", blurb: "Blue Sky Tower. 14:00 ЭШХ-ын шагнал, Хакатоны шагнал. 15:00 Launchpad Meetup Ulaanbaatar Volume 2.", allDay: true },
];

export const pillars = [
  {
    title: "Conference",
    when: "Wed–Thu",
    body: "Two days of talks, panels and workshops across three rooms. Big ideas on the Toono Stage, hands-on sessions in the Steppe Room, honest conversations in the Hearth Lounge.",
    href: "/program",
  },
  {
    title: "UB Hack",
    when: "Thu–Fri",
    body: "An overnight hackathon for first-timers and veterans alike. Mentors on the floor, food that keeps coming, and prizes for projects that matter here.",
    href: hackHref,
  },
  {
    title: "Side events",
    when: "All week",
    body: "Breakfasts, roundtables, morning walks and karaoke, hosted by the communities that make UB's scene. Anyone can host one.",
    href: "/side-events",
  },
  {
    title: "Community nights",
    when: "Every evening",
    body: "Shared tables, live morin khuur, khuushuur and long talks. The part of the week people remember most.",
    href: "/program#evenings",
  },
];

export const faqs = [
  {
    q: "Who is UB Blockchain Week for?",
    a: "Builders, researchers, students, companies, policymakers, and blockchain enthusiasts. Whether you are exploring blockchain for the first time or already working in the industry, UBBW offers opportunities to learn, contribute, and meet potential collaborators.",
  },
  {
    q: "Is it free?",
    a: "Yes. All events are free to attend with advance registration. Some activities, including the hackathon, academic conference, and policy roundtable, will have separate application or participation requirements, and workshop attendance may be limited by venue capacity.",
  },
  {
    q: "What language are sessions in?",
    a: "Most main stage sessions are in English with Mongolian interpretation. Many workshops and community sessions run in Mongolian. Each session is labelled in the app.",
  },
  {
    q: "What's the weather like in early December?",
    a: "Cold and bright — expect −15 °C to −25 °C outside. Every venue is warm inside, and we'll share a packing list with registered attendees.",
  },
  {
    q: "Can I host a side event?",
    a: "Yes, please. Side events are the heart of the week. Submit yours in the web app and we'll list it on the calendar once it's reviewed.",
  },
  {
    q: "Is there support for travel from outside Ulaanbaatar?",
    a: "We are raising travel grants for students and builders from the aimags with our partners. Applications open in the attendee app.",
  },
  {
    q: "Is it accessible?",
    a: "All main venues are step-free. Tell us what you need when you register and we'll do our best to make it work.",
  },
];
