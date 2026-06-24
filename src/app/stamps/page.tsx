"use client";

import { useState, useEffect } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { useAuth } from "@/hooks/useAuth";

export default function StampBookPage() {
  const { user } = useAuth();
  const [stampData, setStampData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [buyMsg, setBuyMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/stamps/balance");
        if (res.ok) {
          const data = await res.json();
          setStampData(data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
    const q = new URLSearchParams(window.location.search);
    if (q.get("purchased")) setBuyMsg("Payment received — your stamps will land in a moment.");
    if (q.get("canceled")) setBuyMsg("Checkout canceled.");
  }, []);

  const buyPack = async (packId: string) => {
    if (buying) return;
    setBuying(packId);
    setBuyMsg(null);
    try {
      const res = await fetch("/api/stamps/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setBuyMsg(data.error || "Couldn't start checkout.");
    } catch {
      setBuyMsg("Couldn't start checkout.");
    } finally {
      setBuying(null);
    }
  };

  const tierColors: Record<string, string> = {
    Common: "#8b6914",
    Uncommon: "#6b8e23",
    Rare: "#b8860b",
    Epic: "#4a0e4e",
    Legendary: "#b22222",
  };

  return (
    <AuthGuard>
      <NavBar />
      <main className="stampbook-main">
        <div className="sb-header">
          <h1 className="sb-title">
            <span className="sb-icon">&#9733;</span> Stamp Book
          </h1>
          {stampData && (
            <div className="sb-summary">
              <div className="sb-stat">
                <span className="sb-stat-val">{stampData.balance}</span>
                <span className="sb-stat-lbl">Available</span>
              </div>
              <div className="sb-stat">
                <span className="sb-stat-val">{stampData.totalEarned}</span>
                <span className="sb-stat-lbl">Earned (lifetime)</span>
              </div>
              <div className="sb-stat">
                <span className="sb-stat-val">{stampData.totalStamps}</span>
                <span className="sb-stat-lbl">Total owned</span>
              </div>
            </div>
          )}
        </div>

        {stampData && (
          <div
            style={{
              maxWidth: 620, margin: "0 auto 24px", padding: "16px 18px",
              background: "#fbf7ee", border: "1px solid #e6dcc6", borderRadius: 12,
            }}
          >
            <p style={{ margin: "0 0 12px", color: "#6b5640", fontSize: 14, lineHeight: 1.5 }}>
              Stamps are precious now. You <strong>earn</strong> them when people stamp your letters
              {stampData.monthlyGrant ? `, plus ${stampData.monthlyGrant} a month` : ""} — and spend
              them to stamp letters you love. Running low?
            </p>
            {stampData.stripeEnabled ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {(stampData.packs || []).map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => buyPack(p.id)}
                    disabled={buying !== null}
                    style={{
                      flex: "1 1 140px", minWidth: 130, padding: "12px 14px", borderRadius: 10,
                      border: "1px solid #c9a86a", background: "#fffdf8", cursor: "pointer",
                      font: "inherit", display: "flex", flexDirection: "column", gap: 2, alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 700, color: "#3a2e22" }}>
                      {buying === p.id ? "…" : `${p.stamps} stamps`}
                    </span>
                    <span style={{ fontSize: 13, color: "#8a5a2b" }}>${(p.cents / 100).toFixed(2)}</span>
                    <span style={{ fontSize: 11, color: "#a89a82" }}>{p.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: "#a89a82", fontSize: 13 }}>Buying stamps is coming soon.</p>
            )}
            {buyMsg && (
              <p style={{ margin: "10px 0 0", color: "#5c4a30", fontSize: 13 }}>{buyMsg}</p>
            )}
          </div>
        )}

        {loading && (
          <div className="sb-loading">
            <div className="spinner" />
          </div>
        )}

        {stampData && stampData.designs && (
          <div className="sb-gallery">
            <h2 className="sb-section-title">Stamp Designs</h2>
            <div className="sb-designs">
              {stampData.designs.map((design: any) => (
                <div
                  key={design.id}
                  className="sb-design-card"
                  style={{ borderColor: tierColors[design.tier] || "#d0c8b8" }}
                >
                  <div className="sb-stamp-preview" style={{ borderColor: tierColors[design.tier] || "#d0c8b8" }}>
                    <svg viewBox="0 0 60 70" className="sb-stamp-svg">
                      <rect x="2" y="2" width="56" height="66" rx="2"
                        fill="#f0e0c0" stroke={tierColors[design.tier] || "#c0a880"} strokeWidth="1"/>
                      <rect x="5" y="5" width="50" height="60" rx="1"
                        fill="#f5e8d0" stroke={tierColors[design.tier] || "#c0a880"} strokeWidth="0.5"/>
                      <text x="30" y="28" textAnchor="middle" fill={tierColors[design.tier] || "#8b6914"}
                        fontSize="18" fontWeight="bold">{design.tier[0]}</text>
                      <text x="30" y="44" textAnchor="middle" fill="#8b6914" fontSize="6">{design.name}</text>
                      <text x="30" y="55" textAnchor="middle" fill="#a09070" fontSize="5">
                        {design.totalMinted >= 999999 ? "Unlimited" : `${design.currentlyMinted}/${design.totalMinted}`}
                      </text>
                      <line x1="8" y1="60" x2="52" y2="60" stroke="#c0a880" strokeWidth="0.3"/>
                      <line x1="8" y1="14" x2="52" y2="14" stroke="#c0a880" strokeWidth="0.3"/>
                    </svg>
                  </div>
                  <div className="sb-design-info">
                    <span className="sb-design-name">{design.name}</span>
                    <span className="sb-design-tier" style={{ color: tierColors[design.tier] }}>
                      {design.tier}
                    </span>
                    {design.series && (
                      <span className="sb-design-series">{design.series}</span>
                    )}
                    <span className="sb-design-minted">
                      {design.currentlyMinted} / {design.totalMinted >= 999999 ? "&#8734;" : design.totalMinted} minted
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stampData && stampData.balance === 0 && !loading && (
          <div className="sb-empty">
            <p>No stamps yet. Write a letter to earn your first stamp!</p>
            <a href="/post/new" className="sb-cta">Write a Letter</a>
          </div>
        )}
      </main>

      <style>{`
        .stampbook-main {
          max-width: 700px;
          margin: 0 auto;
          padding: 24px 16px 60px;
        }
        .sb-header {
          text-align: center;
          padding-bottom: 24px;
          border-bottom: 1px solid #e0d5c0;
          margin-bottom: 24px;
        }
        .sb-title {
          font-size: 28px;
          font-weight: 700;
          color: #2c2416;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .sb-icon { color: #1a1a1a; }
        .sb-summary {
          display: flex;
          justify-content: center;
          gap: 32px;
        }
        .sb-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .sb-stat-val {
          font-size: 24px;
          font-weight: 700;
          color: #2c2416;
        }
        .sb-stat-lbl {
          font-size: 11px;
          color: #8c7a60;
          margin-top: 2px;
        }
        .sb-loading {
          display: flex;
          justify-content: center;
          padding: 60px;
        }
        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e0e0e0;
          border-top-color: #333;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .sb-section-title {
          font-size: 18px;
          font-weight: 600;
          color: #2c2416;
          margin-bottom: 16px;
        }
        .sb-gallery { margin-top: 8px; }
        .sb-designs {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }
        .sb-design-card {
          border: 2px solid #d0c8b8;
          border-radius: 6px;
          background: #fefdf9;
          overflow: hidden;
          transition: box-shadow 0.2s;
        }
        .sb-design-card:hover {
          box-shadow: 0 4px 16px rgba(80,40,20,0.06);
        }
        .sb-stamp-preview {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: #faf7f0;
          border-bottom: 1px solid #e0d5c0;
        }
        .sb-stamp-svg {
          width: 80px;
          height: 90px;
        }
        .sb-design-info {
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sb-design-name {
          font-weight: 600;
          font-size: 14px;
          color: #2c2416;
        }
        .sb-design-tier {
          font-size: 12px;
          font-weight: 500;
        }
        .sb-design-series {
          font-size: 11px;
          color: #8c7a60;
        }
        .sb-design-minted {
          font-size: 10px;
          color: #b0a090;
          margin-top: 4px;
        }
        .sb-empty {
          text-align: center;
          padding: 60px 16px;
          color: #8c7a60;
        }
        .sb-cta {
          display: inline-block;
          margin-top: 16px;
          padding: 10px 24px;
          background: #1a1a1a;
          color: #fff;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
        }
      `}</style>
    </AuthGuard>
  );
}
