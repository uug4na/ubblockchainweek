import type { Metadata } from "next";
import { AttendeesView } from "./AttendeesView";

export const metadata: Metadata = { title: "Attendees" };

export default function Page() {
  return <AttendeesView />;
}
