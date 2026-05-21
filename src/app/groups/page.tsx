"use client";

import { useState, useEffect } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import Link from "next/link";

export default function GroupsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [tagPattern, setTagPattern] = useState("");
  const [error, setError] = useState("");

  const loadGroups = async () => {
    try {
      const res = await fetch("/api/groups");
      const data = await res.json();
      setGroups(data.groups || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tag_pattern: tagPattern }),
      });

      const data = await res.json();
      if (res.ok) {
        setGroups((prev) => [data.group, ...prev]);
        setShowCreate(false);
        setName("");
        setTagPattern("");
      } else {
        setError(data.error || "Failed to create group");
      }
    } catch {
      setError("Something went wrong");
    }
  };

  return (
    <AuthGuard>
      <NavBar />
      <main className="groups-main">
        <div className="groups-header">
          <h1 className="page-title">Groups</h1>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-create-group">
            + New Group
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="create-group-form">
            <div className="form-field">
              <label className="input-label">Group Name</label>
              <div className="selected-name">{name || "Choose a name below"}</div>
              <div className="name-suggestions">
                {["Poetry", "Sketches", "Letters", "Quotes"].map((s) => (
                  <button
                    type="button"
                    key={s}
                    className={`suggestion-chip ${name === s ? "active" : ""}`}
                    onClick={() => setName(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-field">
              <label className="input-label">Tag Pattern (regex)</label>
              <div className="selected-name">{tagPattern || "Choose a pattern below"}</div>
              <div className="pattern-suggestions">
                {[
                  { label: "Poetry", pattern: "#poem|#poetry|#verse" },
                  { label: "Sketches", pattern: "#sketch|#drawing|#doodle" },
                  { label: "Letters", pattern: "#letter|#note|#message" },
                  { label: "Quotes", pattern: "#quote|#saying|#wisdom" },
                ].map((p) => (
                  <button
                    type="button"
                    key={p.label}
                    className={`suggestion-chip ${tagPattern === p.pattern ? "active" : ""}`}
                    onClick={() => setTagPattern(p.pattern)}
                  >
                    {p.label}: {p.pattern}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="error-msg">{error}</p>}

            <div className="form-actions">
              <button type="submit" className="btn-submit" disabled={!name || !tagPattern}>
                Create Group
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-cancel">
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="loading-area">
            <div className="spinner" />
          </div>
        ) : groups.length === 0 ? (
          <p className="no-groups">No groups yet. Create the first one.</p>
        ) : (
          <div className="groups-grid">
            {groups.map((group) => (
              <Link href={`/groups/${group.id}`} key={group.id} className="group-card">
                <h3 className="group-name">{group.name}</h3>
                <p className="group-pattern">{group.tagPattern}</p>
                <p className="group-creator">by {group.creator?.username}</p>
              </Link>
            ))}
          </div>
        )}
      </main>

      <style>{`
        .groups-main {
          max-width: 600px;
          margin: 0 auto;
          padding: 24px 16px;
        }
        .groups-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .page-title {
          font-size: 28px;
          font-weight: 700;
        }
        .btn-create-group {
          padding: 10px 20px;
          background: #111;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          font-size: 14px;
        }
        .btn-create-group:hover { background: #333; }
        .create-group-form {
          border: 1px solid #e8e8e8;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
          background: #fafafa;
        }
        .form-field {
          margin-bottom: 16px;
        }
        .input-label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #555;
          margin-bottom: 6px;
        }
        .selected-name {
          padding: 10px 14px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          color: #888;
          background: #f9f9f9;
          min-height: 40px;
          display: flex;
          align-items: center;
        }
        .name-suggestions, .pattern-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .suggestion-chip {
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 16px;
          background: #fff;
          cursor: pointer;
          font-size: 13px;
          font-family: inherit;
          color: #555;
        }
        .suggestion-chip.active {
          border-color: #111;
          background: #111;
          color: #fff;
        }
        .suggestion-chip:hover {
          border-color: #999;
        }
        .form-actions {
          display: flex;
          gap: 8px;
        }
        .btn-submit {
          padding: 10px 24px;
          background: #111;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          font-size: 14px;
        }
        .btn-submit:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        .btn-cancel {
          padding: 10px 24px;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
          font-size: 14px;
        }
        .error-msg {
          color: #e53e3e;
          font-size: 14px;
          margin-bottom: 12px;
        }
        .loading-area {
          display: flex;
          justify-content: center;
          padding: 40px;
        }
        .spinner {
          width: 32px; height: 32px;
          border: 3px solid #e0e0e0;
          border-top-color: #333;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .no-groups {
          text-align: center;
          color: #999;
          padding: 40px;
        }
        .groups-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .group-card {
          display: block;
          padding: 20px;
          border: 1px solid #e8e8e8;
          border-radius: 12px;
          text-decoration: none;
          transition: box-shadow 0.15s;
        }
        .group-card:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .group-name {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 6px;
        }
        .group-pattern {
          font-size: 13px;
          color: #666;
          font-family: monospace;
          margin-bottom: 4px;
        }
        .group-creator {
          font-size: 12px;
          color: #aaa;
        }
      `}</style>
    </AuthGuard>
  );
}
