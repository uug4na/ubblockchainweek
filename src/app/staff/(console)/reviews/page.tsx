import type { Metadata } from "next";
import { ReviewsView } from "./ReviewsView";

export const metadata: Metadata = { title: "Star tasks" };

export default function Page() {
  return <ReviewsView />;
}
