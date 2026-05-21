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

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert("File too large. Maximum 20MB.");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  const handleTrigger = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="photo-upload-container">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {!preview ? (
        <div className="upload-prompt">
          <div className="upload-hint">Share a handwritten note or drawing</div>
          <button onClick={handleTrigger} className="btn-choose">
            Choose Photo
          </button>
        </div>
      ) : (
        <div className="preview-area">
          <img
            src={preview}
            alt="Preview"
            className="preview-image"
          />
        </div>
      )}

      <div className="photo-actions">
        <button onClick={onCancel} className="btn-cancel">
          Cancel
        </button>
        {preview && (
          <button onClick={handleSubmit} className="btn-submit">
            Post Photo
          </button>
        )}
      </div>

      <style>{`
        .photo-upload-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .upload-prompt {
          border: 2px dashed #ddd;
          border-radius: 12px;
          padding: 48px 32px;
          text-align: center;
          min-width: 320px;
        }
        .upload-hint {
          font-size: 15px;
          color: #888;
          margin-bottom: 20px;
        }
        .btn-choose {
          padding: 12px 28px;
          background: #111;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }
        .btn-choose:hover {
          background: #333;
        }
        .preview-area {
          max-width: 500px;
          border-radius: 12px;
          overflow: hidden;
        }
        .preview-image {
          max-width: 100%;
          max-height: 500px;
          object-fit: contain;
        }
        .photo-actions {
          display: flex;
          gap: 16px;
        }
        .btn-cancel {
          padding: 12px 28px;
          border: 1px solid #ccc;
          border-radius: 8px;
          background: #fff;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          font-family: inherit;
        }
        .btn-cancel:hover {
          background: #f5f5f5;
        }
        .btn-submit {
          padding: 12px 28px;
          background: #111;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }
        .btn-submit:hover {
          background: #333;
        }
      `}</style>
    </div>
  );
}
