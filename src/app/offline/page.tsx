import type { Metadata } from "next";
import Link from "next/link";
import { IsoArt } from "@/components/iso/IsoArt";
import routerArt from "@/components/iso/figures/minis/router";

export const metadata: Metadata = { title: "Offline" };

// Served by the service worker when a page isn't cached and there's no signal.
export default function Offline() {
  return (
    <main className="offline-page">
      <IsoArt mini={routerArt} width={130} className="offline-art" />
      <h1 className="app-h1">No signal.</h1>
      <p>This page hasn&apos;t been saved on your phone yet. Pages you&apos;ve opened before, like your pass, still work.</p>
      <div className="offline-actions">
        <Link href="/app/profile" className="btn btn-clay btn-lg">Open my pass</Link>
        <Link href="/app" className="btn btn-ghost btn-lg">App home</Link>
      </div>
    </main>
  );
}
