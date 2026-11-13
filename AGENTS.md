<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project brain (read before changing anything)

The Obsidian vault at `C:\Users\Micheal\OneDrive\Desktop\vault v1\ubbw-2026` is the source of truth for how this project works and the rules agents follow. Start with `Agent Brief.md`, then `00 Home.md`.

- Never touch `0xdmicheal/0xdmicheal.github.io` (the owner's portfolio at michealbuilds.site), never make this repo public, never wipe `.data/db.json` (it holds the owner's real accounts).
- Static site + Supabase, no server of our own: all rules live in Postgres functions (`supabase/migrations/`), called from `src/lib/supa/api.ts`.
- Keep changes local until the owner says push/deploy (they batch releases; `npm run deploy` then). Update the vault after changes (feature note, ADR for decisions, today's note in `04 Log`).
