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
  about: string; // a short description of the event, written from the sheet
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

// Agenda from the team sheet (owner's update, 28 Nov 2026: "Master Sheet - Хөтөлбөр (2)", then the final poster "UBBW-2026-Agenda-Final.jpg"). Times are Ulaanbaatar time (UTC+8).
// room = the sheet's "Хаана". description = its "Сэдэв" (topic), speakers = its "Илтгэгч", about = a short description
// written from the sheet (event sheet in the app, /program on the site). An empty start means no time yet (TBA).
// Ids stay with the same event as before (AMA n, Workshop n, …) because check-ins and places are keyed on them.
// Must match supabase/migrations/0071_agenda_nov24.sql + 0095_agenda_nov27.sql + 0098_agenda_nov28.sql.
const add = (id: string, day: string, start: string, end: string, title: string, track: Track, kind: Kind, room = "", description = "", speakers: string[] = [], about = ""): Session =>
  ({ id, day, start, end, title, track, kind, room, lang: "EN/MN", speakers, description, about });

const inside = "UB Blockchain Week-ийн өдөр бүрийн тойм нэвтрүүлэг, TenGer TV-ээр онлайнаар.";
const ama = "Асуултаа шууд асуух боломжтой.";

export const sessions: Session[] = [
  // Mon 30 Nov
  add("a2", "2026-11-30", "11:00", "12:00", "TenGer Panel 1: 2026 онд яагаад блокчэйн гэж?", "Ecosystem", "Panel", "TenGer TV", "2026 онд яагаад блокчэйн гэж?",
    ["Хөтлөгч: Б.Ганцацрал"], "UBBW 2026-г нээх панел. Блокчэйн яагаад яг одоо чухал болсныг TenGer TV-ийн студиэс ярилцана. Онлайнаар үзнэ."),
  add("a3", "2026-11-30", "14:30", "16:30", "AMA 1: Erchim Labs", "Ecosystem", "Talk", "TenGer TV", "AI-д блокчэйн хэрэгтэй юу?",
    ["А.Чингүн, Erchim Labs-ийн хамтран үүсгэн байгуулагч"], `AI-д блокчэйн хэрэгтэй юу гэдгийг Erchim Labs-ийн А.Чингүн ярина. ${ama}`),
  add("b2", "2026-11-30", "14:30", "16:30", "AMA 2: Certify", "Ecosystem", "Talk", "TenGer TV", "Certify: Итгэл даах цахим диплом",
    ["М.Энхболд, Certify төслийн технологи хариуцсан захирал"], `Certify төсөл дипломыг блокчэйн дээр хэрхэн итгэл даахуйц болгодгийг М.Энхболд танилцуулна. ${ama}`),
  add("a4", "2026-11-30", "20:10", "21:00", "Inside UB Blockchain Week #1", "Ecosystem", "Talk", "TenGer TV", "UB Blockchain Week эргэн ирлээ", [],
    `${inside} Эхний дугаар: UB Blockchain Week эргэн ирлээ.`),

  // Tue 1 Dec
  add("b1", "2026-12-01", "12:00", "13:00", "Workshop #1", "Builders", "Workshop", "IT Park",
    "From traditional loops to on-chain assets",
    ["Г.Хүрэлтулга, Бүтээгдэхүүн хөгжүүлэлтийн менежер, TenGer TV"],
    "IT Park-д дадлагын сургалт. Г.Хүрэлтулга уламжлалт процессоос on-chain хөрөнгө рүү шилжих тухай заана."),
  add("g5", "2026-12-01", "13:00", "14:00", "Workshop #2", "Builders", "Workshop", "IT Park",
    "Стэйблкойн, цахим хэтэвч, цахим худалдаа ба AI агент",
    ["А.Дөлгөөн, Блокчэйн хөгжүүлэгч"],
    "IT Park-д дадлагын сургалт. А.Дөлгөөн стэйблкойноор on-chain хэтэвч, цахим худалдаа, AI агент бүтээх тухай заана."),
  add("a1", "2026-12-01", "14:00", "16:00", "Roundtable #1: Stablecoin: Future of Money", "Policy & Finance", "Panel", "Монголбанкны Г байр",
    "Stablecoin: Future of Money", ["Монголбанк, СЗХ, экспертүүд · Powered by MONT"],
    "Монголбанк, СЗХ болон экспертүүд стэйблкойн ба мөнгөний ирээдүйн талаар Монголбанкны Г байранд хэлэлцэнэ. Урилгаар оролцоно."),
  add("c4", "2026-12-01", "15:30", "16:30", "AMA 3: Nomad DAO", "Ecosystem", "Talk", "TenGer TV", "Крипто болон AI Guru болох нь",
    ["Г.Золбоо, Nomad DAO-ийн үүсгэн байгуулагч"], `Крипто болон AI-д хэрхэн мэргэших тухай Nomad DAO-ийн үүсгэн байгуулагч Г.Золбоо ярина. ${ama}`),
  add("e3", "2026-12-01", "15:30", "16:30", "AMA 4: E-Geree", "Ecosystem", "Talk", "TenGer TV", "E-Geree: Блокчэйн дээр гэрээгээ байгуул",
    ["Жавхлан"], `E-Geree-ээр гэрээгээ блокчэйн дээр хэрхэн байгуулахыг Жавхлан танилцуулна. ${ama}`),
  add("b3", "2026-12-01", "20:10", "21:00", "Inside UB Blockchain Week #2", "Ecosystem", "Talk", "TenGer TV", "Кибер дайнд криптовалютаа хамгаалахуй", [],
    `${inside} Энэ удаа: кибер дайны үед криптовалютаа хэрхэн хамгаалах вэ.`),

  // Wed 2 Dec
  add("c3", "2026-12-02", "11:00", "12:00", "TenGer Panel 2: Бодит хөрөнгийг дижиталжуулах нь (RWA)", "Ecosystem", "Panel", "TenGer TV", "Бодит хөрөнгийг дижиталжуулах нь (RWA)",
    ["Ж.Дашням, Global MPC", "Б.Тамир, Obortech-ийн үүсгэн байгуулагч", "Step Nexus"],
    "Бодит хөрөнгийг (RWA) блокчэйн дээр дижиталжуулах тухай Global MPC, Obortech, Step Nexus-ийн төлөөлөл ярилцана. Онлайнаар үзнэ."),
  add("g1", "2026-12-02", "12:00", "14:00", "Roundtable #2: Виртуал хөрөнгийн салбарын өнөөгийн байдал", "Policy & Finance", "Panel", "СЗХ-ны санхүүгийн хүртээмжийн танхим",
    "ВХҮҮ салбарын 2026 оны нэгдсэн тайлан · МУТСТ чиглэлээр анхаарах асуудлууд · Панел хэлэлцүүлэг",
    ["Б.Дэлгэрмаа, ВХҮҮ хэлтсийн мэргэжилтэн", "Г.Ивээл, Мөнгө угаахтай тэмцэх албаны хянан шалгагч", "Биржийн төлөөлөл, СЗХ-ны мэргэжилтнүүд"],
    "Виртуал хөрөнгийн салбарын 2026 оны нэгдсэн тайлан, мөнгө угаах болон терроризмыг санхүүжүүлэхтэй тэмцэх чиглэлээр анхаарах асуудлыг танилцуулна. Дараа нь биржүүд, СЗХ-ны мэргэжилтнүүдтэй панел хэлэлцүүлэг."),
  add("c6", "2026-12-02", "15:30", "16:30", "AMA 5: Green Score", "Ecosystem", "Talk", "TenGer TV", "Блокчэйн ба ногоон эдийн засгийн боломж", [],
    `Блокчэйн ногоон эдийн засагт ямар боломж нээж байгааг Green Score ярина. ${ama}`),
  add("c7", "2026-12-02", "15:30", "16:30", "AMA 6: Cryptoverse", "Ecosystem", "Talk", "TenGer TV", "Криптогийн эргэн тойронд юу болоод байна?",
    ["Tomskill"], `Крипто салбарт яг одоо юу болж байгааг Tomskill тоймлон ярина. ${ama}`),
  add("g2", "2026-12-02", "19:00", "20:30", "Binance Academy University Tour #1", "Culture & Community", "Talk", "МУИС Цахим Номын Сан", "Partnered with Binance Academy",
    ["Binance Academy"], "Binance Academy-тай хамтарсан их сургуулийн аялал МУИС-ийн Цахим Номын Санд. Оюутнуудад блокчэйн, криптог танилцуулна."),
  add("c5", "2026-12-02", "20:10", "21:00", "Inside UB Blockchain Week #3", "Ecosystem", "Talk", "TenGer TV", "RWA ирээдүй мөн үү?", [],
    `${inside} Энэ удаа: RWA ирээдүй мөн үү?`),

  // Thu 3 Dec
  add("d2", "2026-12-03", "11:00", "15:00", "Эрдэм шинжилгээний хурлын финал: The Future of Money", "Ecosystem", "Talk", "СЭЗИС", "The Future of Money", [],
    "The Future of Money эрдэм шинжилгээний хурлын финал СЭЗИС-д. Шалгарсан багууд илтгэлээ хамгаална. Бүртгэлтэй оролцогчдод."),
  add("c1", "2026-12-03", "12:00", "20:00", "Хакатон Dev Day: Real World Mining · Powered by Global MPC", "Hackathon", "Hack", "IT Park", "Real World Mining",
    ["Powered by Global MPC"], "Real World Mining хакатоны багууд IT Park-д өдөржин бүтээнэ. Бүртгэлтэй багуудад."),
  add("g3", "2026-12-03", "15:00", "16:30", "Binance Academy University Tour #2", "Culture & Community", "Talk", "СЭЗИС", "Partnered with Binance Academy",
    ["Binance Academy"], "Binance Academy-тай хамтарсан их сургуулийн аялал СЭЗИС-д. Оюутнуудад блокчэйн, криптог танилцуулна."),
  add("e5", "2026-12-03", "15:30", "16:30", "AMA 7: Khatun", "Ecosystem", "Talk", "TenGer TV",
    "Блокчэйн ба хөрөнгө оруулалт: Монголд юу хэрэгтэй вэ?", ["А.Сайнбилиг, Бүтээгдэхүүн хөгжүүлэлтийн зөвлөх, Хатун студийн үүсгэн байгуулагч"],
    `Байгууллагууд блокчэйнийг нэвтрүүлж буй энэ үед Монгол хөрөнгө оруулалт татахын тулд юу бүтээх ёстойг А.Сайнбилиг ярина. ${ama}`),
  add("e6", "2026-12-03", "15:30", "16:30", "AMA 8: Global MPC", "Ecosystem", "Talk", "TenGer TV", "RWA in Mining", ["Ж.Дашням, Global MPC"],
    `Уул уурхай дахь бодит хөрөнгийг (RWA) блокчэйнд гаргах тухай Global MPC-ийн Ж.Дашням ярина. ${ama}`),
  add("d5", "2026-12-03", "19:00", "21:00", "Нетворкинг: Stipendium Hungaricum Alumni Networking", "Social", "Social", "Kryptos", "Stipendium Hungaricum Alumni Networking", [],
    "Stipendium Hungaricum тэтгэлэгт хөтөлбөрийн төгсөгчдийн networking үдэш Kryptos-д. Урилгаар."),
  add("d4", "2026-12-03", "20:10", "21:00", "Inside UB Blockchain Week #4", "Ecosystem", "Talk", "TenGer TV", "Ирээдүйн төлбөрийн хэрэгсэл ямар байх вэ?", [],
    `${inside} Энэ удаа: ирээдүйн төлбөрийн хэрэгсэл ямар байх вэ?`),

  // Fri 4 Dec
  add("e2", "2026-12-04", "11:00", "12:00", "TenGer Panel 3: Токенжуулалт: Хөрөнгийн шинэ хэлбэр", "Ecosystem", "Panel", "TenGer TV", "Токенжуулалт: Хөрөнгийн шинэ хэлбэр", [],
    "Токенжуулалт хөрөнгийн шинэ хэлбэр болж буй тухай TenGer-ийн сүүлийн панел. Онлайнаар үзнэ."),
  add("g4", "2026-12-04", "12:00", "13:30", "Workshop: AI, крипто, арилжаа", "Builders", "Workshop", "IT Park", "AI, крипто, арилжаа",
    ["Д.Тулга, idax биржийн технологи хариуцсан захирал"], "AI, крипто, арилжааны тухай idax биржийн Д.Тулгатай IT Park-д хийх дадлагын сургалт."),
  add("e1", "2026-12-04", "13:00", "17:00", "Хакатоны финал: Real World Mining", "Hackathon", "Hack", "TenGer TV", "Real World Mining: Шалгарсан найман багийн илтгэл",
    ["Шүүгч: Ж.Дашням, Global MPC", "Шүүгч: Г.Хүрэлтулга, Бүтээгдэхүүн хөгжүүлэлтийн менежер, TenGer TV", "Шүүгч: Ганхуяг"],
    "Финалд шалгарсан 8 баг төслөө илтгэж, шүүгчид үнэлнэ. Шагналыг Бямба гаригт гардуулна."),
  add("f1", "2026-12-04", "15:30", "16:30", "AMA 9: Ard", "Ecosystem", "Talk", "Kryptos restaurant", "Хөрөнгийн токенжуулалт түүний хэрэглээ",
    ["Ц.Энхтүвшин, Гүйцэтгэх захирал, Монгол ДиФай"], `Хөрөнгийн токенжуулалт, түүний хэрэглээний тухай Монгол ДиФай-н Ц.Энхтүвшин ярина. ${ama}`),
  add("f2", "2026-12-04", "15:30", "16:30", "AMA 10: idax", "Ecosystem", "Talk", "Kryptos restaurant", "Блокчэйн дээрх бодит хөрөнгө",
    ["Ж.Амарзаяа, Гүйцэтгэх захирал, Айдакс бирж"], `Блокчэйн дээрх бодит хөрөнгийн тухай Айдакс биржийн Ж.Амарзаяа ярина. ${ama}`),
  add("e4", "2026-12-04", "20:10", "21:00", "Inside UB Blockchain Week #5", "Ecosystem", "Talk", "TenGer TV", "UBBW 2026: Юу болов? Ирэх жил хүртэл баяртай.", [],
    `${inside} Сүүлийн дугаар: UBBW 2026 юу болов? Ирэх жил хүртэл баяртай.`),
];

export function sessionTime(s: Pick<Session, "day" | "start" | "end">) {
  return {
    start: new Date(`${s.day}T${s.start}:00+08:00`).getTime(),
    end: new Date(`${s.day}T${s.end}:00+08:00`).getTime(),
  };
}

export const sessionById = Object.fromEntries(sessions.map((s) => [s.id, s]));
