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

// Agenda from the team sheet (owner's update, 23 Nov 2026). Times are Ulaanbaatar time (UTC+8).
// room = the sheet's "Хаана". An empty start means the sheet has no time yet (shown as TBA).
// Ids stay with the same event as before (AMA n, Workshop n, EP n, …) because check-ins and places are keyed on them.
const add = (id: string, day: string, start: string, end: string, title: string, track: Track, kind: Kind, room = ""): Session =>
  ({ id, day, start, end, title, track, kind, room, lang: "EN/MN", speakers: [], description: "" });

export const sessions: Session[] = [
  // Mon 30 Nov
  add("a2", "2026-11-30", "14:00", "15:00", "TenGer Panel 1: Монголын крипто зун хэзээ ирэх вэ?", "Ecosystem", "Panel", "TenGer TV"),
  add("a3", "2026-11-30", "15:30", "16:30", "AMA 1", "Ecosystem", "Talk"),
  add("b2", "2026-11-30", "15:30", "16:30", "AMA 2: Erchim Labs", "Ecosystem", "Talk"),
  add("a4", "2026-11-30", "20:10", "21:00", "UB Blockchain тойм: EP1", "Ecosystem", "Talk", "TenGer TV"),

  // Tue 1 Dec
  add("a1", "2026-12-01", "10:30", "12:00", "Roundtable #1: 1072 токен", "Policy & Finance", "Panel", "Монголбанк"),
  add("b1", "2026-12-01", "12:00", "13:30", "Workshop 1", "Builders", "Workshop", "IT Park"),
  add("b5", "2026-12-01", "15:00", "16:30", "Roundtable #2 · Partnered with SGX exchange", "Policy & Finance", "Panel", "Монголбанк"),
  add("c4", "2026-12-01", "15:30", "16:30", "AMA 3", "Ecosystem", "Talk"),
  add("e3", "2026-12-01", "15:30", "16:30", "AMA 4", "Ecosystem", "Talk"),
  add("b6", "2026-12-01", "19:00", "21:00", "Demo Show тэмцээн", "Culture & Community", "Social", "Kryptos"),
  add("b3", "2026-12-01", "20:10", "21:00", "UB Blockchain тойм: EP2", "Ecosystem", "Talk", "TenGer TV"),

  // Wed 2 Dec
  add("c1", "2026-12-02", "11:00", "12:00", "Хакатон Dev Day: Real World Mining · Powered by Global MPC", "Hackathon", "Hack", "IT Park"),
  add("c2", "2026-12-02", "12:00", "13:30", "Workshop 2", "Builders", "Workshop", "IT Park"),
  add("c3", "2026-12-02", "14:00", "15:00", "TenGer Panel 2: Кибер халдлага ба блокчэйны ирээдүй", "Ecosystem", "Panel", "TenGer TV"),
  add("c6", "2026-12-02", "15:30", "16:30", "AMA 5", "Ecosystem", "Talk"),
  add("c7", "2026-12-02", "15:30", "16:30", "AMA 6", "Ecosystem", "Talk"),
  add("c5", "2026-12-02", "20:10", "21:00", "UB Blockchain тойм: EP3", "Ecosystem", "Talk", "TenGer TV"),

  // Thu 3 Dec
  add("e1", "2026-12-03", "11:00", "15:00", "Хакатон Final: 8 баг илтгэл тавина", "Hackathon", "Hack", "TenGer TV"),
  add("d2", "2026-12-03", "11:00", "17:00", "Эрдэм шинжилгээний хурлын финал: The Future of Money", "Ecosystem", "Talk", "СЭЗИС"),
  add("d3", "2026-12-03", "12:00", "13:30", "Workshop 3", "Builders", "Workshop"),
  add("d4", "2026-12-03", "20:10", "21:00", "UB Blockchain тойм: EP4", "Ecosystem", "Talk", "TenGer TV"),
  add("d5", "2026-12-03", "", "", "Stipendium Hungaricum Alumni Networking", "Social", "Social", "Kryptos"),

  // Fri 4 Dec
  add("e2", "2026-12-04", "14:00", "15:00", "TenGer Panel 3: Олон улсад юу болж байна?", "Ecosystem", "Panel", "TenGer TV"),
  add("e5", "2026-12-04", "15:30", "16:30", "AMA 7", "Ecosystem", "Talk"),
  add("e6", "2026-12-04", "15:30", "16:30", "AMA 8", "Ecosystem", "Talk"),
  add("e4", "2026-12-04", "20:10", "21:00", "UB Blockchain тойм: EP5", "Ecosystem", "Talk", "TenGer TV"),
];

export function sessionTime(s: Pick<Session, "day" | "start" | "end">) {
  return {
    start: new Date(`${s.day}T${s.start}:00+08:00`).getTime(),
    end: new Date(`${s.day}T${s.end}:00+08:00`).getTime(),
  };
}

export const sessionById = Object.fromEntries(sessions.map((s) => [s.id, s]));
