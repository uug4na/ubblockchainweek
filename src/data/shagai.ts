// Shagai: four ankle bones, paid by how many land on a lucky side.
// The database throws the bones (supabase/migrations/0017_shagai.sql); this file only
// describes the rules for the screen, so keep it in step with that migration.

export type Bone = "horse" | "sheep" | "camel" | "goat";
export type Combo = "berkh" | "nomad" | "pack" | "balance" | "stray" | "frost";
export type ShagaiRoll = { id: string; stake: number; bones: Bone[]; combo: Combo; payout: number; at: number };

export const BONES: Record<Bone, { mn: string; en: string; lucky: boolean; odds: number }> = {
  horse: { mn: "Морь", en: "Horse", lucky: true, odds: 0.11 },
  sheep: { mn: "Хонь", en: "Sheep", lucky: true, odds: 0.39 },
  camel: { mn: "Тэмээ", en: "Camel", lucky: false, odds: 0.12 },
  goat: { mn: "Ямаа", en: "Goat", lucky: false, odds: 0.38 },
};

// Paytable, best first. `lucky` = how many lucky sides the pattern shows (for the little dots).
export const COMBOS: { id: Combo; name: string; rule: string; lucky: number; x: number; chance: number }[] = [
  { id: "berkh", name: "Dorvon Berkh", rule: "One of each animal", lucky: 2, x: 3, chance: 0.047 },
  { id: "nomad", name: "Grand Nomad", rule: "4 lucky", lucky: 4, x: 3, chance: 0.0625 },
  { id: "pack", name: "Lucky Pack", rule: "3 lucky", lucky: 3, x: 1.2, chance: 0.25 },
  { id: "balance", name: "The Balance", rule: "2 lucky", lucky: 2, x: 1, chance: 0.328 },
  { id: "stray", name: "Stray Flock", rule: "1 lucky", lucky: 1, x: 0, chance: 0.25 },
  { id: "frost", name: "Winter Frost", rule: "0 lucky", lucky: 0, x: 0, chance: 0.0625 },
];

export const combo = (id: Combo) => COMBOS.find((c) => c.id === id)!;
