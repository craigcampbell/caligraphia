import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Caligraphia — Admin",
  robots: { index: false, follow: false },
};

// Wraps the whole /admin tree (login + panel). data-allow-text="true" lifts the
// app-wide "no keyboards" block (useNoKeyboard) so admin inputs accept typing,
// paste, and right-click. Auth gating happens in (panel)/layout.tsx, not here —
// the login page lives under /admin too and must stay reachable when logged out.
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="adm" data-allow-text="true">
      {children}
    </div>
  );
}
