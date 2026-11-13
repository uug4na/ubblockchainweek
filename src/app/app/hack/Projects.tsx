"use client";

import { ChevronLeft, ExternalLink, FolderGit2, Globe, Lock, Play } from "lucide-react";
import { trackNames, type Track } from "@/lib/hack";

// App › Hackathon › Top 20 projects (0040_hack_projects.sql). Shown to everyone once stage 1 has passed.
// Until stage 3 starts (30 Nov) the server sends only each project's track, so the cards are blurred placeholders.
export type Projects = {
  show: boolean; revealed: boolean; revealAt: number;
  projects: {
    id: number; tracks: Track[]; final?: boolean; team?: string; title?: string; summary?: string;
    sourceUrl?: string; demoUrl?: string; siteUrl?: string; members?: number;
  }[];
};

const revealDay = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Ulaanbaatar" });

export function ProjectsView({ data, onBack }: { data: Projects; onBack: () => void }) {
  return (
    <>
      <button className="back-link game-back" onClick={onBack}><ChevronLeft size={18} /> Hackathon</button>
      <h1 className="app-h1">Top 20 projects</h1>
      <p className="app-sub">
        {data.revealed ? "The teams that passed stage 1." : `The teams that passed stage 1. Projects are revealed on ${revealDay(data.revealAt)}, when stage 3 starts.`}
      </p>

      {!data.revealed && (
        <p className="hk-lock"><Lock size={16} /> Hidden until {revealDay(data.revealAt)}</p>
      )}

      <div className="hk-projects">
        {data.projects.map((p) =>
          data.revealed ? (
            <article className="panel hk-project" key={p.id}>
              <small>{trackNames(p.tracks)}{p.final ? " · Final 10" : ""}</small>
              <h2>{p.title || p.team}</h2>
              <p className="hk-project-team">{p.team}{p.members ? ` · ${p.members} ${p.members === 1 ? "member" : "members"}` : ""}</p>
              {p.summary && <p className="hk-project-sum">{p.summary}</p>}
              {(p.sourceUrl || p.demoUrl || p.siteUrl) && (
                <div className="hk-project-links">
                  {p.sourceUrl && <a href={p.sourceUrl} target="_blank" rel="noreferrer"><FolderGit2 size={15} /> Code <ExternalLink size={13} /></a>}
                  {p.demoUrl && <a href={p.demoUrl} target="_blank" rel="noreferrer"><Play size={15} /> Video <ExternalLink size={13} /></a>}
                  {p.siteUrl && <a href={p.siteUrl} target="_blank" rel="noreferrer"><Globe size={15} /> Live demo <ExternalLink size={13} /></a>}
                </div>
              )}
            </article>
          ) : (
            <article className="panel hk-project is-hidden" key={p.id} aria-label={`${trackNames(p.tracks)} project, hidden`}>
              <small>{trackNames(p.tracks)}</small>
              <div className="hk-blur" aria-hidden>
                <h2>Project name here</h2>
                <p className="hk-project-team">Team name · 3 members</p>
                <p className="hk-project-sum">A short description of what this team is building, who it is for and how it works.</p>
              </div>
            </article>
          ),
        )}
      </div>
    </>
  );
}
