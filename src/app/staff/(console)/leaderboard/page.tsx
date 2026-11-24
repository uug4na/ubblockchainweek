import type { Metadata } from "next";
import { LeaderboardView } from "./LeaderboardView";

export const metadata: Metadata = { title: "Leaderboard" };

export default function Page() {
  return (
    <>
      <div className="staff-head">
        <div>
          <span className="eyebrow">Stars</span>
          <h1 className="app-h1">Leaderboard</h1>
          <p className="muted">Everyone with stars, ranked.</p>
        </div>
      </div>
      <LeaderboardView />
    </>
  );
}
