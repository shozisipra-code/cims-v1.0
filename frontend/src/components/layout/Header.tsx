"use client";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut, Moon, Sun } from "lucide-react";
import { useRole } from "./RoleContext";
import { NotificationPanel } from "./NotificationPanel";
const titles: Record<string, string> = { patients: "Patient Records", appointments: "Appointments & Queue", booking: "Patient Booking", clinical: "Consultation", billing: "Billing & Receipts", payments: "Payment Records", pharmacy: "Pharmacy", users: "Users & Permissions" };
export function Header({ onMenu, menuOpen, darkMode, onToggleTheme }: { onMenu: () => void; menuOpen: boolean; darkMode: boolean; onToggleTheme: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setCurrentUser } = useRole();
  const logout = () => {
    window.sessionStorage.removeItem("cims-demo-session");
    setCurrentUser(null);
    router.push("/login");
  };
  return <header className="topbar no-print">
    <button className="menu-toggle" onClick={onMenu} aria-label="Toggle navigation" aria-controls="main-navigation" aria-expanded={menuOpen}><Menu size={20} /></button>
    <div className="topbar-title"><span>{titles[pathname.split("/")[1]] || "Dashboard"}</span></div>
    <time className="topbar-date">{new Intl.DateTimeFormat("en-PK", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" }).format(new Date())}</time>
    <NotificationPanel />
    <button type="button" onClick={onToggleTheme} className="topbar-circle" title={darkMode ? "Use light mode" : "Use dark mode"} aria-label={darkMode ? "Use light mode" : "Use dark mode"}>{darkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
    <button type="button" onClick={logout} className="topbar-circle" title="Log out" aria-label="Log out"><LogOut size={20} /></button>
  </header>;
}
