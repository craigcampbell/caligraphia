import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/guard";
import AdminNav from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

// Auth gate for the whole panel. getAdminSession() is the read-only verifier
// (RSCs can't slide the cookie); the actual sliding/CSRF happens on each API
// call via requireAdmin. No valid session → back to login.
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const sess = await getAdminSession();
  if (!sess) redirect("/admin/login");

  return (
    <div className="adm-shell">
      <AdminNav username={sess.admin.username} />
      <main className="adm-main">{children}</main>
    </div>
  );
}
