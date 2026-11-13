import type { Metadata } from "next";
import { PostersView } from "./PostersView";

export const metadata: Metadata = { title: "Session posters" };

export default function Page() {
  return <PostersView />;
}
