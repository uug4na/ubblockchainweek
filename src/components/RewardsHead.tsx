"use client";

import { useLayoutEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PixelStar } from "@/components/PixelStar";
import { IsoArt } from "@/components/iso/IsoArt";
import coinsArt from "@/components/iso/figures/minis/coins";
import giftArt from "@/components/iso/figures/minis/gift";

// Balance card + Earn / Games / Merch switch, shared by both rewards screens.
const tabs = ["/app/stars", "/app/games", "/app/merch"];
// Each rewards screen mounts its own switch, so remember where the thumb was and slide it from there.
let lastTab = -1;

export function RewardsHead({ balance }: { balance: number }) {
  const path = usePathname();
  const at = Math.max(0, tabs.findIndex((t) => path.startsWith(t)));
  const [i, setI] = useState(lastTab < 0 ? at : lastTab);
  useLayoutEffect(() => {
    lastTab = at;
    // next frame, so the browser paints the old spot first and the move transitions
    const raf = requestAnimationFrame(() => setI(at));
    return () => cancelAnimationFrame(raf);
  }, [at]);
  return (
    <>
      {/* Games: blue arcade card with the pixel star. Earn / Spend: navy card with a dot grid,
          a few brand-colour dots and an isometric figure (coins / gift) in the site's navy kit colours. */}
      <section className={`stars-hero ${["is-earn", "is-games", "is-spend"][at]}`}>
        <div className="stars-hero-text">
          <span className="stars-hero-label">Your stars</span>
          <div className="stars-hero-num">{balance.toLocaleString()}</div>
        </div>
        {at === 1 ? (
          <PixelStar className="stars-hero-star" />
        ) : (
          <>
            <i className="stars-dot is-1" aria-hidden />
            <i className="stars-dot is-2" aria-hidden />
            <i className="stars-dot is-3" aria-hidden />
            <IsoArt mini={at === 0 ? coinsArt : giftArt} width={132} className="stars-hero-iso" />
          </>
        )}
      </section>
      <nav className="rewards-switch" aria-label="Rewards" style={{ ["--i" as string]: i }}>
        <Link href="/app/stars" className={path.startsWith("/app/stars") ? "is-on" : undefined}>Earn</Link>
        <Link href="/app/games" className={path.startsWith("/app/games") ? "is-on" : undefined}>Games</Link>
        <Link href="/app/merch" className={path.startsWith("/app/merch") ? "is-on" : undefined}>Spend</Link>
      </nav>
    </>
  );
}
