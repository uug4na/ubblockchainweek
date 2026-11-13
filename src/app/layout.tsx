import type { Metadata, Viewport } from "next";
import { Poppins, JetBrains_Mono } from "next/font/google";
import { site } from "@/data/site";
import { PwaBoot } from "@/components/Pwa";
import { themeBootScript } from "@/lib/themeBoot";
import { withBase } from "@/lib/base";
import "@/components/iso/iso.css";
import "./globals.css";

// The 2025 brand pairing: Poppins for Latin, Montserrat for Cyrillic. Poppins has no Cyrillic, so Mongolian text
// (Ө, Ү included) falls through to "UB Cyrillic": Montserrat cut to match Poppins' stroke weight (src/fonts,
// faces in globals.css, made by scripts/make-cyrillic-fonts.py).
// globals.css names "Poppins" directly: var(--font-poppins) also brings Next's Arial-based "Poppins Fallback",
// which would catch Cyrillic first.
const sans = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-poppins", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-mono-face", display: "swap" });

export const metadata: Metadata = {
  // Absolute URLs for link previews (the share image lives at app/opengraph-image.png).
  metadataBase: new URL(site.origin),
  title: { default: `${site.name} · ${site.city}`, template: `%s · ${site.short}` },
  description: `A week of builders, believers and first-timers in ${site.city}, ${site.country}. ${site.dates}.`,
  openGraph: { title: site.name, description: `${site.dates} · ${site.city}, ${site.country}`, type: "website" },
  manifest: withBase("/app.webmanifest"),
  // iPhone/iPad "Add to Home Screen": full screen, our icon, short title.
  appleWebApp: { capable: true, title: site.short, statusBarStyle: "default" },
  icons: { icon: withBase("/icons/app-192.png"), apple: withBase("/icons/apple-touch-icon.png") },
  formatDetection: { telephone: false },
};

// viewport-fit=cover lets the layout use the notch/home-bar safe areas (see env(safe-area-inset-*) in CSS).
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f2f2f7" }, { media: "(prefers-color-scheme: dark)", color: "#010d58" }], width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the boot script may set data-theme before React hydrates.
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        {children}
        <PwaBoot />
      </body>
    </html>
  );
}
