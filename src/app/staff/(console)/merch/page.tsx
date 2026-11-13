import type { Metadata } from "next";
import { MerchView } from "./MerchView";

export const metadata: Metadata = { title: "Merch" };

export default function Page() {
  return <MerchView />;
}
