"use client";

import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signupToken = searchParams.get("signupToken") || "";

  const [username, setUsername] = useState("");
  const [nomDePlumeFile, setNomDePlumeFile] = useState<File | null>(null);
  const [nomDePlumePreview, setNomDePlumePreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setNomDePlumeFile(file);
    const reader = new FileReader();
    reader.onload = () => setNomDePlumePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!signupToken) { setError("Missing signup token. Use your magic link again."); return; }
    if (username.trim().length < 2) { setError("Username must be at least 2 characters."); return; }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("signupToken", signupToken);
      formData.append("username", username.trim());
      if (nomDePlumeFile) formData.append("nomDePlume", nomDePlumeFile);
      const res = await fetch("/api/auth/signup", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Signup failed");
      else router.push("/");
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  };

  return (
    <div className="signup-page">
      <div className="signup-card">
        <div className="brand-mark">&#9998;</div>
        <h1 className="signup-title">Pick Your Pen Name</h1>

        <form onSubmit={handleSubmit} className="signup-form">
          <label className="input-label" htmlFor="username-input">
            Username <span className="hint-text">(the only text you will ever type)</span>
          </label>
          <input
            id="username-input" name="username" type="text"
            value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="your_handle" className="username-input"
            autoFocus maxLength={30} data-allow-text="true"
          />

          <label className="input-label">Nom de plume (optional)</label>
          <div className="nom-upload">
            {nomDePlumePreview ? (
              <img src={nomDePlumePreview} alt="" className="nom-preview" />
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-upload-av">
                Upload image
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{display:"none"}} />
          </div>

          {error && <p className="err-msg">{error}</p>}

          <button type="submit" className="btn-signup" disabled={loading}>
            {loading ? "Entering..." : "Enter Caligraphia"}
          </button>
        </form>
      </div>

      <style>{`
        .signup-page {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          padding: 16px; background: linear-gradient(170deg, #fefcf8 0%, #f5efe0 40%, #faf4ec 100%);
        }
        .signup-card {
          background: #fffef9; border: 1px solid #e0d5c0; border-radius: 20px;
          padding: 48px 40px; max-width: 430px; width: 100%;
          box-shadow: 0 4px 32px rgba(80,40,20,0.06);
        }
        .brand-mark { font-size: 48px; text-align: center; color: #c0392b; margin-bottom: 4px; }
        .signup-title {
          font-size: 26px; font-weight: 700; text-align: center; margin-bottom: 24px;
          background: linear-gradient(135deg, #1a1a2e, #8e44ad, #c0392b);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .signup-form { display: flex; flex-direction: column; gap: 12px; }
        .input-label { font-size: 13px; font-weight: 500; color: #6b5c40; }
        .hint-text { font-size: 11px; color: #b0a090; font-weight: 400; font-style: italic; }
        .username-input {
          padding: 14px 16px; border: 2px solid #27ae60; border-radius: 12px;
          font-size: 16px; font-family: inherit; outline: none; background: #f4faf6;
          user-select: text; -webkit-user-select: text;
        }
        .username-input:focus { border-color: #1a1a2e; }
        .nom-upload { display: flex; align-items: center; gap: 12px; }
        .btn-upload-av {
          padding: 12px 24px; border: 2px dashed #d8cfb8; border-radius: 12px;
          background: #fefdf9; cursor: pointer; font-size: 14px; color: #8c7a60; font-family: inherit;
        }
        .btn-upload-av:hover { border-color: #b0a090; }
        .nom-preview { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #e0d5c0; }
        .btn-signup {
          margin-top: 12px; padding: 15px;
          background: linear-gradient(135deg, #2c3e50, #8e44ad);
          color: #fff; border: none; border-radius: 12px;
          font-size: 16px; font-weight: 700; cursor: pointer; font-family: inherit;
          box-shadow: 0 4px 16px rgba(142,68,173,0.25);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .btn-signup:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(142,68,173,0.35); }
        .btn-signup:disabled { background: #c0b8a8; box-shadow: none; cursor: not-allowed; }
        .err-msg { color: #c0392b; font-size: 13px; }
      `}</style>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#faf7f0"}}><div style={{width:32,height:32,border:"3px solid #ddd",borderTopColor:"#8e44ad",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} /></div>}>
      <SignupContent />
    </Suspense>
  );
}
