import type { Metadata } from "next";
import { CrewView } from "./CrewView";
import { SpeakersPanel } from "./SpeakersPanel";

export const metadata: Metadata = { title: "Crew" };

export default function Page() {
  return (
    <>
      <CrewView />
      <SpeakersPanel />
    </>
  );
}
