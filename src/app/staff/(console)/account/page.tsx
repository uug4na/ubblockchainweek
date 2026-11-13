"use client";

import { useRouter } from "next/navigation";
import { SunMoon, LogOut } from "lucide-react";
import { api } from "@/lib/me";
import { useStaff } from "@/components/StaffShell";
import { roleInfo } from "@/lib/roles";
import { ThemeSwitch } from "@/components/ThemeSwitch";

export default function StaffAccount() {
  const me = useStaff();
  const router = useRouter();

  async function signOut() {
    await api("/api/staff/auth", { action: "logout" }).catch(() => {});
    router.replace("/staff/login");
  }

  return (
    <>
      <h1 className="app-h1">{me.name}</h1>
      <p className="app-sub">{me.username}</p>

      <section className={`panel role-card r-${me.role}`}>
        <span className={`role-tag r-${me.role}`}>{roleInfo[me.role].label}</span>
        <p>{roleInfo[me.role].blurb}</p>
        <p className="muted small">Ask an admin to change your role.</p>
      </section>

      <div className="settings-group">
        <div className="settings-row"><i className="tile t-gray"><SunMoon size={18} /></i><span>Appearance</span><ThemeSwitch /></div>
      </div>
      <div className="settings-group">
        <button className="is-danger" onClick={signOut}><i className="tile t-red"><LogOut size={18} /></i><span>Sign out</span></button>
      </div>
    </>
  );
}
