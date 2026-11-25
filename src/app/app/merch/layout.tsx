"use client";

import Link from "next/link";
import { ChevronLeft, Gift } from "lucide-react";
import { useOpen } from "@/lib/open";
import { PageSkeleton } from "@/components/Skeleton";

// Spend (merch) is closed for now (src/data/open.ts): direct links land on a Coming soon page.
export default function MerchLayout({ children }: { children: React.ReactNode }) {
  const open = useOpen();
  if (open.merch) return <>{children}</>;
  if (open.loading) return <PageSkeleton />;
  return (
    <>
      <Link href="/app/games" className="back-link game-back"><ChevronLeft size={18} /> Games</Link>
      <h1 className="app-h1">Spend stars.</h1>
      <section className="panel stars-soon">
        <span className="stars-soon-ico" aria-hidden><Gift size={26} /></span>
        <h2>Coming soon</h2>
        <p className="muted">Merch and rewards open closer to the week.</p>
      </section>
    </>
  );
}
