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
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="navbar-brand">
          Caligraphia
        </Link>

        {user && (
          <div className="navbar-links">
            <Link href="/post/new" className="nav-link">
              <span className="nav-icon">+</span>
              New Post
            </Link>
            <Link href="/groups" className="nav-link">
              Groups
            </Link>
            <Link href={`/users/${user.id}`} className="nav-link">
              {user.nomDePlume ? (
                <img
                  src={user.nomDePlume}
                  alt=""
                  className="nav-avatar"
                  width={28}
                  height={28}
                />
              ) : (
                <span className="nav-avatar-placeholder">
                  {user.username[0].toUpperCase()}
                </span>
              )}
              <span>{user.username}</span>
            </Link>
            <button onClick={handleLogout} className="nav-link nav-btn">
              Leave
            </button>
          </div>
        )}
      </div>

      <style>{`
        .navbar {
          border-bottom: 1px solid #e0e0e0;
          background: #fff;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .navbar-inner {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
        }
        .navbar-brand {
          font-size: 22px;
          font-weight: 700;
          text-decoration: none;
          color: #111;
          font-style: italic;
          letter-spacing: -0.5px;
        }
        .navbar-links {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .nav-link {
          display: flex;
          align-items: center;
          gap: 6px;
          text-decoration: none;
          color: #555;
          font-size: 15px;
          font-weight: 500;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
        }
        .nav-link:hover {
          color: #111;
          background: #f5f5f5;
        }
        .nav-icon {
          font-size: 20px;
          line-height: 1;
        }
        .nav-avatar {
          border-radius: 50%;
          object-fit: cover;
        }
        .nav-avatar-placeholder {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #ddd;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          color: #555;
        }
        .nav-btn {
          font-family: inherit;
          font-size: 15px;
        }
      `}</style>
    </nav>
  );
}
