"use client";

import { usePathname } from "next/navigation";
import { GamesSoonPage, gameOpen } from "./soon";

// While the games are closed, each game's own page shows "Coming soon" (the Games list itself stays open).
export default function GamesLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname().replace(/\/+$/, "");
  const isGame = path.startsWith("/app/games/");
  return isGame && !gameOpen(path) ? <GamesSoonPage /> : <>{children}</>;
}
