import type { Metadata, Viewport } from "next";
import { withBase } from "@/lib/base";

// The crew console installs as its own home-screen app.
export const metadata: Metadata = {
  manifest: withBase("/staff.webmanifest"),
  appleWebApp: { capable: true, title: "UBBW Crew", statusBarStyle: "black" },
  icons: { apple: withBase("/icons/crew-apple-touch-icon.png") },
};
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f2f2f7" }, { media: "(prefers-color-scheme: dark)", color: "#02041e" }] };

export default function StaffRoot({ children }: { children: React.ReactNode }) {
  return children;
}
