"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { Feed } from "@/components/Feed";
import { useAuth } from "@/hooks/useAuth";

export default function UserProfilePage() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/users/${id}`);
        if (res.ok) {
          const data = await res.json();
          setProfile(data.user);
          setIsFollowing(data.user.isFollowing);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const toggleFollow = async () => {
    try {
      const method = isFollowing ? "DELETE" : "POST";
      const res = await fetch(`/api/users/${id}/follow`, { method });
      if (res.ok) {
        setIsFollowing(!isFollowing);
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <NavBar />
        <main className="profile-loading">
          <div className="spinner" />
        </main>
        <style>{`.profile-loading{display:flex;align-items:center;justify-content:center;min-height:60vh}.spinner{width:40px;height:40px;border:3px solid #e0e0e0;border-top-color:#333;border-radius:50%;animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </AuthGuard>
    );
  }

  if (!profile) {
    return (
      <AuthGuard>
        <NavBar />
        <main className="profile-not-found">User not found.</main>
        <style>{`.profile-not-found{text-align:center;padding:60px;color:#999}`}</style>
      </AuthGuard>
    );
  }

  const isSelf = currentUser?.id === id;

  return (
    <AuthGuard>
      <NavBar />
      <main className="profile-main">
        <div className="profile-header">
          <div className="profile-identity">
            {profile.nomDePlume ? (
              <img src={profile.nomDePlume} alt="" className="profile-avatar" />
            ) : (
              <div className="profile-avatar-placeholder">
                {profile.username[0].toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="profile-username">{profile.username}</h1>
              <div className="profile-stats">
                <span>{profile._count?.posts ?? 0} posts</span>
                <span>{profile._count?.followers ?? 0} followers</span>
                <span>{profile._count?.following ?? 0} following</span>
              </div>
            </div>
          </div>

          {!isSelf && (
            <div className="profile-actions">
              <button
                onClick={toggleFollow}
                className={`follow-btn ${isFollowing ? "following" : ""}`}
              >
                {isFollowing ? "Unfollow" : "Follow"}
              </button>
              <a href={`/post/new?send_to=${id}`} className="send-letter-btn">
                &#9998; Send a Letter
              </a>
            </div>
          )}
        </div>

        <Feed
          endpoint={`/api/users/${id}/posts`}
          emptyMessage="No posts yet."
        />
      </main>

      <style>{`
        .profile-main {
          max-width: 600px;
          margin: 0 auto;
          padding: 24px 16px;
        }
        .profile-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 32px;
          padding-bottom: 24px;
          border-bottom: 1px solid #eee;
        }
        .profile-identity {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .profile-avatar {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          object-fit: cover;
        }
        .profile-avatar-placeholder {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: #ddd;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 700;
          color: #888;
        }
        .profile-username {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .profile-stats {
          display: flex;
          gap: 16px;
          font-size: 14px;
          color: #888;
        }
        .profile-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: flex-end;
        }
        .follow-btn {
          padding: 10px 24px;
          background: #2c2416;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          font-size: 14px;
          transition: all 0.15s;
        }
        .follow-btn.following {
          background: #fff;
          color: #555;
          border: 1px solid #ddd;
        }
        .follow-btn:hover {
          opacity: 0.85;
        }
        .send-letter-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 8px 18px;
          background: #1a1a1a;
          color: #fff;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          font-family: inherit;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .send-letter-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.18);
        }
      `}</style>
    </AuthGuard>
  );
}
