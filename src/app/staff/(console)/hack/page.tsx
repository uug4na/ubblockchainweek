import type { Metadata } from "next";
import { HackView } from "./HackView";

export const metadata: Metadata = { title: "Hackathon" };

export default function Page() {
  return <HackView />;
}
