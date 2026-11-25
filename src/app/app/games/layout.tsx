"use client";

import { usePathname } from "next/navigation";
import { useMe } from "@/lib/me";
import { GamesSoonPage, gameOpen } from "./soon";
import { PageSkeleton } from "@/components/Skeleton";

// While the games are closed, each game's own page shows "Coming soon" (the Games list itself stays open).
export default function GamesLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname().replace(/\/+$/, "");
  const { status, me } = useMe();
  const isGame = path.startsWith("/app/games/");
  if (isGame && status === "loading") return <PageSkeleton />;
  return isGame && !gameOpen(path, me?.user.email) ? <GamesSoonPage /> : <>{children}</>;
}
