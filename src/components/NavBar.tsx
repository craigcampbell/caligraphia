"use client";

import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function NavBar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-brand">
          <span className="brand-mark">&#9998;</span>
          Caligraphia
        </Link>

        {user && (
          <div className="nav-links">
            <Link href="/post/new" className="nav-link">
              <span className="nav-icon">+</span>New Post
            </Link>
            <Link href="/groups" className="nav-link">Groups</Link>
            <Link href={`/users/${user.id}`} className="nav-link nav-user">
              {user.nomDePlume ? (
                <img src={user.nomDePlume} alt="" className="nav-av" width={26} height={26} />
              ) : (
                <span className="nav-av-ph">{user.username[0].toUpperCase()}</span>
              )}
              {user.username}
            </Link>
            <button onClick={handleLogout} className="nav-link nav-btn">Leave</button>
          </div>
        )}
      </div>

      <style>{`
        .nav {
          background: linear-gradient(180deg, #fefcf6 0%, #faf6ee 100%);
          border-bottom: 1px solid #e0d5c0;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .nav-inner {
          max-width: 900px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
        }
        .nav-brand {
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #8e44ad, #c0392b, #d35400);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .brand-mark {
          font-size: 26px;
          background: none;
          -webkit-text-fill-color: #c0392b;
        }
        .nav-links {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .nav-link {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #5c4a30;
          font-size: 14px;
          font-weight: 500;
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px 10px;
          border-radius: 6px;
          font-family: inherit;
        }
        .nav-link:hover {
          color: #1a1a2e;
          background: rgba(0,0,0,0.04);
        }
        .nav-icon { font-size: 18px; line-height: 1; }
        .nav-av { border-radius: 50%; object-fit: cover; }
        .nav-av-ph {
          width: 26px; height: 26px; border-radius: 50%;
          background: #e0d5c0; display: flex; align-items: center;
          justify-content: center; font-size: 12px; font-weight: 600; color: #5c4a30;
        }
        .nav-btn { font-family: inherit; }
      `}</style>
    </nav>
  );
}
