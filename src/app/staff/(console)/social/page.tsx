import type { Metadata } from "next";
import { SocialView } from "./SocialView";

export const metadata: Metadata = { title: "Social" };

export default function Page() {
  return <SocialView />;
}
