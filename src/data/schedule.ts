export type Track = "Ecosystem" | "Builders" | "Policy & Finance" | "Culture & Community" | "Hackathon" | "Social";
export type Kind = "Keynote" | "Talk" | "Panel" | "Workshop" | "Fireside" | "Social" | "Hack";

export type Session = {
  id: string;
  day: string;
  start: string;
  end: string;
  title: string;
  track: Track;
  kind: Kind;
  room: string;
  lang: "EN" | "MN" | "EN/MN";
  speakers: string[];
  description: string;
};

export const tracks: Track[] = ["Ecosystem", "Builders", "Policy & Finance", "Culture & Community", "Hackathon", "Social"];

export const rooms = {
  toono: "Toono Stage",
  steppe: "Steppe Room",
  hearth: "Hearth Lounge",
  courtyard: "The Courtyard",
  hackhall: "Hack Hall",
  city: "Around the city",
};

// Agenda from the team sheet (owner's update, 24 Nov 2026: "Master Sheet - Хөтөлбөр"). Times are Ulaanbaatar time (UTC+8).
// room = the sheet's "Хаана". description = its "Сэдэв" (topic), speakers = its "Илтгэгч". An empty start means the
// sheet has no time yet (shown as TBA). Ids stay with the same event as before (AMA n, Workshop n, EP n, …) because
// check-ins and places are keyed on them. Must match supabase/migrations/0071_agenda_nov24.sql + 0095_agenda_nov27.sql
// (27 Nov sheet: AMA 2 Certify, AMA 4 E-Geree, AMA 9 idax, Dev Day at IT Park; the Workshop was kept as it was).
const add = (id: string, day: string, start: string, end: string, title: string, track: Track, kind: Kind, room = "", description = "", speakers: string[] = []): Session =>
  ({ id, day, start, end, title, track, kind, room, lang: "EN/MN", speakers, description });

export const sessions: Session[] = [
  // Mon 30 Nov
  add("a2", "2026-11-30", "11:00", "12:00", "TenGer Panel 1: 2026 онд яагаад блокчэйн гэж?", "Ecosystem", "Panel", "TenGer TV", "2026 онд яагаад блокчэйн гэж?"),
  add("a3", "2026-11-30", "14:30", "16:30", "AMA 1: Erchim Labs", "Ecosystem", "Talk", "TenGer TV", "AI-д блокчэйн хэрэгтэй юу?"),
  add("b2", "2026-11-30", "14:30", "16:30", "AMA 2: Certify", "Ecosystem", "Talk", "TenGer TV", "Certify: Итгэл даах цахим диплом"),
  add("a4", "2026-11-30", "20:10", "21:00", "UB Blockchain тойм: EP1", "Ecosystem", "Talk", "TenGer TV", "UB Blockchain Week эргэн ирлээ"),

  // Tue 1 Dec
  add("b1", "2026-12-01", "12:00", "14:00", "Workshop", "Builders", "Workshop", "IT Park",
    "From traditional loops to on chain asset · AI, Крипто, Арилжаа",
    ["Г.Хүрэлтулга, Бүтээгдэхүүн хөгжүүлэлтийн менежер, TenGer TV", "Д.Тулга, idax биржийн технологи хариуцсан захирал"]),
  add("a1", "2026-12-01", "14:00", "16:00", "Roundtable #1: Stablecoin: Future of Money", "Policy & Finance", "Panel", "Монголбанк",
    "Stablecoin: Future of Money", ["Монголбанк, СЗХ, экспертүүд · Powered by MONT"]),
  add("c4", "2026-12-01", "15:30", "16:30", "AMA 3: Nomad Dao", "Ecosystem", "Talk", "TenGer TV", "Крипто болон AI Guru болох нь", ["Г.Золбоо, Nomad Dao-ийн үүсгэн байгуулагч"]),
  add("e3", "2026-12-01", "15:30", "16:30", "AMA 4: E-Geree", "Ecosystem", "Talk", "TenGer TV"),
  add("b3", "2026-12-01", "20:10", "21:00", "UB Blockchain тойм: EP2", "Ecosystem", "Talk", "TenGer TV", "Кибер дайнд криптовалютаа хамгаалахуй"),

  // Wed 2 Dec
  add("c3", "2026-12-02", "11:00", "12:00", "TenGer Panel 2: Бодит хөрөнгийг дижиталжуулах нь (RWA)", "Ecosystem", "Panel", "TenGer TV", "Бодит хөрөнгийг дижиталжуулах нь (RWA)", ["Global MPC"]),
  add("c6", "2026-12-02", "15:30", "16:30", "AMA 5: X-Meta", "Ecosystem", "Talk", "TenGer TV", "", ["X-Meta CTO"]),
  add("c7", "2026-12-02", "15:30", "16:30", "AMA 6: Cryptoverse", "Ecosystem", "Talk", "TenGer TV", "Криптогийн эргэн тойронд юу болоод байна?", ["Tomskill"]),
  add("b6", "2026-12-02", "16:50", "18:00", "Demo Show тэмцээн", "Culture & Community", "Social", "TenGer TV"),
  add("c5", "2026-12-02", "20:10", "21:00", "UB Blockchain тойм: EP3", "Ecosystem", "Talk", "TenGer TV", "RWA ирээдүй мөн үү?"),

  // Thu 3 Dec
  add("c1", "2026-12-03", "11:00", "20:00", "Хакатон Dev Day: Real World Mining · Powered by Global MPC", "Hackathon", "Hack", "IT Park", "Real World Mining", ["Powered by Global MPC"]),
  add("d2", "2026-12-03", "11:00", "17:00", "Эрдэм шинжилгээний хурлын финал: The Future of Money", "Ecosystem", "Talk", "СЭЗИС", "The Future of Money"),
  add("e5", "2026-12-03", "15:30", "16:30", "AMA 7: Khatun", "Ecosystem", "Talk", "TenGer TV",
    "Institutions Are Adopting Blockchain: What Mongolia Must Build to Attract the Capital", ["А.Сайнбилиг, Бүтээгдэхүүн хөгжүүлэлтийн зөвлөх, Хатун студийн үүсгэн байгуулагч"]),
  add("e6", "2026-12-03", "15:30", "16:30", "AMA 8: Global MPC", "Ecosystem", "Talk", "TenGer TV", "RWA in Mining", ["Ж.Дашням, Global MPC-ийн хамтран үүсгэн байгуулагч"]),
  add("d5", "2026-12-03", "19:00", "21:00", "Stipendium Hungaricum Alumni Networking", "Social", "Social", "Kryptos"),
  add("d4", "2026-12-03", "20:10", "21:00", "UB Blockchain тойм: EP4", "Ecosystem", "Talk", "TenGer TV"),

  // Fri 4 Dec
  add("e2", "2026-12-04", "11:00", "12:00", "TenGer Panel 3: Криптовалютыг хөрөнгөөр бүртгэх нь зөв үү?", "Ecosystem", "Panel", "TenGer TV", "Криптовалютыг хөрөнгөөр бүртгэх нь зөв үү?", ["СЗХ, Төвбанк, Биржүүд"]),
  add("e1", "2026-12-04", "13:00", "17:00", "Хакатон финал: 8 баг илтгэл тавина", "Hackathon", "Hack", "TenGer TV", "Финалд үлдсэн 8 баг илтгэл тавина"),
  add("f1", "2026-12-04", "15:30", "16:30", "AMA 9: idax", "Ecosystem", "Talk"),
  add("f2", "2026-12-04", "15:30", "16:30", "AMA 10", "Ecosystem", "Talk"),
  add("e4", "2026-12-04", "20:10", "21:00", "UB Blockchain тойм: EP5", "Ecosystem", "Talk", "TenGer TV", "UBBW 2026 юу болов?"),
];

export function sessionTime(s: Pick<Session, "day" | "start" | "end">) {
  return {
    start: new Date(`${s.day}T${s.start}:00+08:00`).getTime(),
    end: new Date(`${s.day}T${s.end}:00+08:00`).getTime(),
  };
}

export const sessionById = Object.fromEntries(sessions.map((s) => [s.id, s]));
