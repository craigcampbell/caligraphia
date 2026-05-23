"use client";

import { useState, useRef } from "react";

interface Props {
  onUpload: (file: File) => void;
  onCancel: () => void;
}

export function PhotoUpload({ onUpload, onCancel }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please select an image file."); return; }
    if (file.size > 20 * 1024 * 1024) { alert("File too large. Maximum 20MB."); return; }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => { if (selectedFile) onUpload(selectedFile); };

  return (
    <div className="photo-wrap">
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{display:"none"}} />

      {!preview ? (
        <div className="upload-zone">
          <div className="upload-hint">Share a handwritten note or drawing</div>
          <button onClick={() => fileInputRef.current?.click()} className="btn-choose">Choose Photo</button>
        </div>
      ) : (
        <div className="preview-zone">
          <img src={preview} alt="Preview" className="preview-img" />
        </div>
      )}

      <div className="photo-actions">
        <button onClick={onCancel} className="btn-cancel">Cancel</button>
        {preview && <button onClick={handleSubmit} className="btn-post">Post Photo</button>}
      </div>

      <style>{`
        .photo-wrap {
          display: flex; flex-direction: column; align-items: center; gap: 16px;
        }
        .upload-zone {
          border: 2px dashed #d8cfb8; border-radius: 16px; padding: 56px 40px;
          text-align: center; min-width: 340px; background: #fefdf9;
          transition: border-color 0.15s;
        }
        .upload-zone:hover { border-color: #b0a090; }
        .upload-hint { font-size: 15px; color: #8c7a60; font-style: italic; margin-bottom: 22px; }
        .btn-choose {
          padding: 14px 32px; border: none; border-radius: 28px;
          background: linear-gradient(135deg, #2c3e50, #c0392b);
          color: #fff; font-size: 16px; font-weight: 700; cursor: pointer;
          font-family: inherit; box-shadow: 0 4px 16px rgba(192,57,43,0.22);
          transition: transform 0.15s;
        }
        .btn-choose:hover { transform: translateY(-1px); }
        .preview-zone { max-width: 540px; border-radius: 14px; overflow: hidden; border: 1px solid #e0d5c0; }
        .preview-img { max-width: 100%; max-height: 520px; object-fit: contain; }
        .photo-actions { display: flex; gap: 14px; }
        .btn-cancel {
          padding: 12px 30px; border: 1px solid #d8cfb8; border-radius: 24px;
          background: #fefdf9; cursor: pointer; font-size: 15px; font-weight: 500;
          font-family: inherit; color: #6b5c40;
        }
        .btn-cancel:hover { background: #f5efe0; }
        .btn-post {
          padding: 12px 30px; border: none; border-radius: 24px;
          background: linear-gradient(135deg, #2c3e50, #8e44ad);
          color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
          font-family: inherit; box-shadow: 0 4px 16px rgba(142,68,173,0.22);
        }
        .btn-post:hover { transform: translateY(-1px); }
      `}</style>
    </div>
  );
}
