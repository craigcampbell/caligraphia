"use client";

import { useState } from "react";

export function AcceptButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const accept = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.redirect) {
        window.location.href = data.redirect;
      } else {
        setError(data.error || "This invitation could not be opened.");
        setLoading(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      {error && <p className="accept-err">{error}</p>}
      <button onClick={accept} className="accept-btn" disabled={loading}>
        {loading ? "Opening..." : "Accept your invitation"}
      </button>
    </>
  );
}
