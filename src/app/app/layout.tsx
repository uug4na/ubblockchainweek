import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = { title: { default: "Attendee app", template: "%s · UBBW app" } };
// the phone status bar matches the app's dark page (the public site keeps its brighter navy)
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f2f2f7" }, { media: "(prefers-color-scheme: dark)", color: "#02041e" }] };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
