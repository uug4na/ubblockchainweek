import type { Metadata } from "next";
import { StaffGate } from "@/components/StaffShell";

export const metadata: Metadata = { title: { default: "Staff", template: "%s · UBBW staff" }, robots: { index: false } };

// Sign-in and role checks happen in StaffGate; every API call is checked again by the server.
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffGate>{children}</StaffGate>;
}
