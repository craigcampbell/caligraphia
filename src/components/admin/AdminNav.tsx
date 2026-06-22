"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { adminFetch } from "@/lib/admin/adminFetch";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/maintenance", label: "Maintenance" },
  { href: "/admin/audit", label: "Audit log" },
];

export default function AdminNav({ username }: { username: string }) {
  const pathname = usePathname();

  async function logout() {
    await adminFetch("/admin/api/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <nav className="adm-nav">
      <h1>CALIGRAPHIA</h1>
      <div className="who">signed in as {username}</div>
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={active ? "active" : ""}>
            {l.label}
          </Link>
        );
      })}
      <button
        className="adm-btn sm"
        onClick={logout}
        style={{ marginTop: 18, width: "100%" }}
      >
        Sign out
      </button>
    </nav>
  );
}
