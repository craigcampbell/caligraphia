import LoginFlow from "@/components/admin/LoginFlow";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <div className="adm-login">
      <h1 style={{ textAlign: "center", color: "#fff", letterSpacing: 1 }}>CALIGRAPHIA</h1>
      <p className="adm-sub" style={{ textAlign: "center" }}>operator console</p>
      <LoginFlow />
    </div>
  );
}
