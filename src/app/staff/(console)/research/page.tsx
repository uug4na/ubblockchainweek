import type { Metadata } from "next";
import { ResearchView } from "./ResearchView";

export const metadata: Metadata = { title: "Research" };

export default function Page() {
  return <ResearchView />;
}
