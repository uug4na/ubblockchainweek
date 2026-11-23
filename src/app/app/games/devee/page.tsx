"use client";

import { useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { api, useMe } from "@/lib/me";
import type { FlappyStats } from "@/games/flappy/types";

// Devee: Ardcoin's flappy-bird game (github.com/batotgon602/FlappyBird), played full screen. Phaser needs the
// browser, so the game loads only on the phone. Each run is saved for the crew dashboard
// (Crew → Games → Devee); it doesn't touch stars.
const PhaserGame = dynamic(() => import("@/games/flappy/scenes/PhaserGame").then((m) => m.PhaserGame), { ssr: false });

export default function DeveePage() {
  const { status } = useMe();
  const router = useRouter();
  // The server opens a run when the countdown ends and closes it when the bird dies, so the
  // play time comes from the database clock, not the phone.
  const run = useRef<Promise<string | null> | null>(null);

  const onRunStart = useCallback(() => {
    run.current = api<{ id: string }>("/api/rpc/app_flappy_start", {}).then((r) => r.id).catch(() => null);
  }, []);

  const onRunOver = useCallback((s: FlappyStats) => {
    const opened = run.current;
    run.current = null;
    opened?.then((id) => {
      if (id) api("/api/rpc/app_flappy_finish", { run_id: id, score: s.score, hits: s.hits, hearts: s.hearts, stars: s.stars, cause: s.cause }).catch(() => {});
    });
  }, []);

  if (status === "loading") return null;
  if (status === "out") return <AuthPanel title="Devee" lead="Sign in to play." />;
  // On <body>, above the app header and tab bar (the game shell's entry animation would trap a fixed layer).
  return createPortal(
    <PhaserGame onRunStart={onRunStart} onRunOver={onRunOver}>
      <button className="flappy-exit" aria-label="Close game" onClick={() => router.push("/app/games")}>
        <X size={20} />
      </button>
    </PhaserGame>,
    document.body,
  );
}
