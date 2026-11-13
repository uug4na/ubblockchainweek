// Crew roles, lowest to highest. Each role can do everything the ones below it can,
// except "reviewer": it sits outside the ladder and only reads research registrations
// (0036_research.sql). So `can()` never lets a reviewer in; pages open to them list it in `also`.
export const ROLES = ["reviewer", "volunteer", "lead", "admin"] as const;
export type Role = (typeof ROLES)[number];
const LADDER: Role[] = ["volunteer", "lead", "admin"];
export const roleRank = (r: Role) => LADDER.indexOf(r);
export const can = (who: { role: Role }, min: Role, also: Role[] = []) =>
  also.includes(who.role) || (who.role !== "reviewer" && roleRank(who.role) >= roleRank(min));

export const roleInfo: Record<Role, { label: string; blurb: string }> = {
  reviewer: { label: "Reviewer", blurb: "Reads the research conference registrations and abstracts. Nothing else." },
  volunteer: { label: "Volunteer", blurb: "Hands over merch, gives rewards, and checks in anyone without a phone." },
  lead: { label: "Lead", blurb: "Plus social task reviews, merch stock, posters, rewards, cancelling swaps and small star corrections." },
  admin: { label: "Admin", blurb: "Everything: insights, the attendee list and export, crew accounts, the full activity log." },
};
