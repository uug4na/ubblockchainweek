# UB Blockchain Week 2026

Single-page site for UB Blockchain Week, 16 to 20 November 2026, Ulaanbaatar. Built with Next.js (App Router, TypeScript) from the brand assets in the Figma file "UB-Blockchain-week": logo, palette, posters and business card.

## Run it

```sh
npm install
npm run dev
```

Then open http://localhost:3000. `npm run build` followed by `npm start` serves the production build. `npm run lint` runs ESLint.

Set `NEXT_PUBLIC_SITE_URL` to the public URL before building so Open Graph links resolve to the real domain.

## Where things live

- `app/layout.tsx`: fonts (Poppins and Montserrat through next/font), metadata and theme color.
- `app/page.tsx`: the page, assembled from the sections in `components/`.
- `app/globals.css`: all styling. Brand tokens are at the top (`--blue`, `--navy`, `--green`, pixel accents, fonts).
- `app/icon.png`, `app/apple-icon.png`, `app/favicon.ico`, `app/opengraph-image.jpg`: icons and the social share image, picked up by the Next.js file conventions.
- `lib/site.ts`: the content that changes most: dates, contact email, navigation, the four "call for" cards, the 2025 key visuals and the decorative pixel clusters.
- `components/`: one component per section. `SiteHeader` and `Countdown` are client components; everything else renders on the server.
- `public/assets/`: logo cutouts, poster JPEGs and partner logos exported from Figma.
