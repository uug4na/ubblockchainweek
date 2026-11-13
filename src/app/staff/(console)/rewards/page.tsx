import type { Metadata } from "next";
import { RewardsView } from "./RewardsView";

export const metadata: Metadata = { title: "Rewards" };

export default function Page() {
  return <RewardsView />;
}
