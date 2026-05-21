"use client";

import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signupToken = searchParams.get("signupToken") || "";
  const email = searchParams.get("email") || "";

  const [username, setUsername] = useState("");
  const [nomDePlumeFile, setNomDePlumeFile] = useState<File | null>(null);
  const [nomDePlumePreview, setNomDePlumePreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    setNomDePlumeFile(file);
    const reader = new FileReader();
    reader.onload = () => setNomDePlumePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!signupToken) {
      setError("Missing signup token. Please use your magic link again.");
      return;
    }

    if (username.trim().length < 2) {
      setError("Username must be at least 2 characters.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("signupToken", signupToken);
      formData.append("username", username.trim());
      if (nomDePlumeFile) {
        formData.append("nomDePlume", nomDePlumeFile);
      }

      const res = await fetch("/api/auth/signup", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Signup failed");
      } else {
        router.push("/");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-card">
        <h1 className="signup-title">Finish your profile</h1>

        <form onSubmit={handleSubmit} className="signup-form">
          <label className="input-label" htmlFor="username-input">
            Username <span className="text-only-hint">(the only text you will ever type here)</span>
          </label>
          <input
            id="username-input"
            name="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your_handle"
            className="username-input"
            autoFocus
            maxLength={30}
            data-allow-text="true"
          />

          <label className="input-label">Nom de plume (optional)</label>
          <div className="nom-upload">
            {nomDePlumePreview ? (
              <img src={nomDePlumePreview} alt="" className="nom-preview" />
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-upload-avatar"
              >
                Upload image
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button type="submit" className="btn-signup" disabled={loading}>
            {loading ? "Creating..." : "Enter Caligraphia"}
          </button>
        </form>
      </div>

      <style>{`
        .signup-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fafafa;
          padding: 16px;
        }
        .signup-card {
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 16px;
          padding: 48px 40px;
          max-width: 420px;
          width: 100%;
        }
        .signup-title {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 28px;
          text-align: center;
        }
        .signup-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .input-label {
          font-size: 14px;
          font-weight: 500;
          color: #555;
        }
        .text-only-hint {
          font-size: 12px;
          color: #aaa;
          font-weight: 400;
        }
        .username-input {
          padding: 12px 16px;
          border: 2px solid #38a169;
          border-radius: 10px;
          font-size: 16px;
          font-family: inherit;
          outline: none;
          user-select: text;
          -webkit-user-select: text;
          background: #f0fff4;
        }
        .username-input:focus {
          border-color: #111;
        }
        .nom-upload {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .btn-upload-avatar {
          padding: 12px 24px;
          border: 2px dashed #ddd;
          border-radius: 10px;
          background: #fff;
          cursor: pointer;
          font-size: 14px;
          color: #666;
          font-family: inherit;
        }
        .btn-upload-avatar:hover {
          border-color: #aaa;
        }
        .nom-preview {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #ddd;
        }
        .btn-signup {
          margin-top: 12px;
          padding: 14px;
          background: #111;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }
        .btn-signup:hover {
          background: #333;
        }
        .btn-signup:disabled {
          background: #999;
          cursor: not-allowed;
        }
        .error-msg {
          color: #e53e3e;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:32,height:32,border:"3px solid #e0e0e0",borderTopColor:"#333",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} /></div>}>
      <SignupContent />
    </Suspense>
  );
}
