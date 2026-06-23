"use client";

import { useEffect } from "react";

// Small in-app confirmation dialog, themed to match the app — replaces the
// browser's native confirm()/alert().
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="cfm-backdrop" onClick={onCancel}>
      <div
        className="cfm-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="cfm-title">{title}</h3>
        {message && <p className="cfm-msg">{message}</p>}
        <div className="cfm-actions">
          <button className="cfm-cancel" onClick={onCancel} autoFocus>{cancelLabel}</button>
          <button className={`cfm-confirm${danger ? " danger" : ""}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
      <style>{`
        .cfm-backdrop {
          position: fixed; inset: 0; z-index: 500; background: rgba(40,30,20,0.5);
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .cfm-card {
          background: #faf7f0; border: 1px solid rgba(90,70,50,0.3); border-radius: 14px;
          padding: 24px; max-width: 400px; width: 100%; color: #3a2e22;
          box-shadow: 0 18px 50px rgba(0,0,0,0.3);
        }
        .cfm-title { margin: 0 0 8px; font-size: 18px; }
        .cfm-msg { margin: 0 0 18px; color: #6b5640; font-size: 14px; line-height: 1.5; }
        .cfm-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .cfm-cancel, .cfm-confirm {
          font: inherit; font-size: 14px; padding: 9px 18px; border-radius: 8px; cursor: pointer;
        }
        .cfm-cancel { background: transparent; border: 1px solid #d8c7ab; color: #6b5640; }
        .cfm-cancel:hover { background: #f1e8d8; }
        .cfm-confirm { background: #6b5640; border: 1px solid #6b5640; color: #faf7f0; font-weight: 600; }
        .cfm-confirm:hover { background: #5a4836; }
        .cfm-confirm.danger { background: #b8513f; border-color: #b8513f; }
        .cfm-confirm.danger:hover { background: #9c3b34; }
      `}</style>
    </div>
  );
}
