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

// Agenda from the team sheet (docs.google.com/spreadsheets/d/1w01pETBkdsNWhKVz3FalHIpB13SnqzeEq2h9cQVoLJ4). Times are Ulaanbaatar time (UTC+8).
// The sheet has no places or speakers yet, so room is "" until "Хаана" is filled in.
const add = (id: string, day: string, start: string, end: string, title: string, track: Track, kind: Kind): Session =>
  ({ id, day, start, end, title, track, kind, room: "", lang: "EN/MN", speakers: [], description: "" });

export const sessions: Session[] = [
  // Mon 30 Nov
  add("a1", "2026-11-30", "10:30", "12:00", "Roundtable: 1072 token", "Policy & Finance", "Panel"),
  add("a2", "2026-11-30", "14:00", "15:00", "TenGer Panel 1: Монголын крипто зун хэзээ ирэх вэ?", "Ecosystem", "Panel"),
  add("a3", "2026-11-30", "15:30", "16:30", "AMA 1", "Ecosystem", "Talk"),
  add("a4", "2026-11-30", "18:40", "20:00", "UB Blockchain тойм: EP1", "Ecosystem", "Talk"),

  // Tue 1 Dec
  add("b1", "2026-12-01", "12:00", "13:30", "Workshop 1", "Builders", "Workshop"),
  add("b2", "2026-12-01", "15:30", "16:30", "AMA 2", "Ecosystem", "Talk"),
  add("b3", "2026-12-01", "18:40", "20:00", "UB Blockchain тойм: EP2", "Ecosystem", "Talk"),

  // Wed 2 Dec
  add("c1", "2026-12-02", "11:00", "12:00", "Хакатоны нээлт: Хөгжүүлэлт Day 1", "Hackathon", "Hack"),
  add("c2", "2026-12-02", "12:00", "13:30", "Workshop 2", "Builders", "Workshop"),
  add("c3", "2026-12-02", "14:00", "15:00", "TenGer Panel 2: Кибер халдлага ба блокчэйны ирээдүй", "Ecosystem", "Panel"),
  add("c4", "2026-12-02", "15:30", "16:30", "AMA 3", "Ecosystem", "Talk"),
  add("c5", "2026-12-02", "18:40", "20:00", "UB Blockchain тойм: EP3", "Ecosystem", "Talk"),

  // Thu 3 Dec
  add("d1", "2026-12-03", "10:00", "22:00", "Хакатон: Хөгжүүлэлт Day 2", "Hackathon", "Hack"),
  add("d2", "2026-12-03", "11:00", "17:00", "Эрдэм шинжилгээний хурал: The Future of Money", "Ecosystem", "Talk"),
  add("d3", "2026-12-03", "12:00", "13:30", "Workshop 3", "Builders", "Workshop"),
  add("d4", "2026-12-03", "18:40", "20:00", "UB Blockchain тойм: EP4", "Ecosystem", "Talk"),

  // Fri 4 Dec
  add("e1", "2026-12-04", "11:00", "17:00", "Хакатон: Финал", "Hackathon", "Hack"),
  add("e2", "2026-12-04", "14:00", "15:00", "TenGer Panel 3: Олон улсад юу болж байна?", "Ecosystem", "Panel"),
  add("e3", "2026-12-04", "15:30", "16:30", "AMA 4", "Ecosystem", "Talk"),
  add("e4", "2026-12-04", "18:40", "20:00", "UB Blockchain тойм: EP5", "Ecosystem", "Talk"),
];

export function sessionTime(s: Pick<Session, "day" | "start" | "end">) {
  return {
    start: new Date(`${s.day}T${s.start}:00+08:00`).getTime(),
    end: new Date(`${s.day}T${s.end}:00+08:00`).getTime(),
  };
}

export const sessionById = Object.fromEntries(sessions.map((s) => [s.id, s]));
