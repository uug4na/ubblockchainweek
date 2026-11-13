import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicCard } from "./PublicCard";

export const metadata: Metadata = { title: "Card", robots: { index: false } };

// Opened by any phone camera pointed at someone's pass QR (…/card/?c=UBBW:U:UB-XXXXXX).
export default function CardPage() {
  return (
    <main className="card-page">
      <Suspense>
        <PublicCard />
      </Suspense>
    </main>
  );
}
