import type { Metadata } from "next";
import { ArdcoinView } from "./ArdcoinSwaps";

export const metadata: Metadata = { title: "ARDCoin" };

export default function Page() {
  return <ArdcoinView />;
}
