"use client";

import { useRef, useState } from "react";

const MAX_SECONDS = 90;

// A self-recorded voice postscript on a letter. Owners can record one (max 90s),
// everyone who can see the letter can play it.
export function VoicePostscript({
  postId,
  voiceUrl,
  isOwner,
  onChange,
}: {
  postId: string;
  voiceUrl: string | null;
  isOwner: boolean;
  onChange?: (has: boolean) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const durRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const start = async () => {
    setErr(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErr("Recording isn't supported on this device.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        durRef.current = Date.now() - startRef.current;
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        stream.getTracks().forEach((t) => t.stop());
      };
      mrRef.current = mr;
      startRef.current = Date.now();
      setSeconds(0);
      mr.start();
      setRecording(true);
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startRef.current) / 1000);
        setSeconds(s);
        if (s >= MAX_SECONDS) stop();
      }, 250);
    } catch {
      setErr("Couldn't reach the microphone.");
    }
  };

  const stop = () => {
    stopTimer();
    mrRef.current?.stop();
    setRecording(false);
  };

  const discard = () => {
    setBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSeconds(0);
  };

  const save = async () => {
    if (!blob) return;
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("audio", blob, "voice.webm");
    fd.append("duration_ms", String(durRef.current));
    try {
      const res = await fetch(`/api/posts/${postId}/voice`, { method: "POST", body: fd });
      if (res.ok) {
        discard();
        onChange?.(true);
      } else {
        const d = await res.json().catch(() => null);
        setErr(d?.error || "Couldn't save the recording.");
      }
    } catch {
      setErr("Couldn't save the recording.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await fetch(`/api/posts/${postId}/voice`, { method: "DELETE" });
      onChange?.(false);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vp">
      {voiceUrl ? (
        <div className="vp-player">
          <span className="vp-label">&#127908; Voice postscript</span>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={voiceUrl} preload="none" className="vp-audio" />
          {isOwner && (
            <button className="vp-btn vp-remove" onClick={remove} disabled={busy}>Remove</button>
          )}
        </div>
      ) : isOwner ? (
        <div className="vp-record">
          {!blob ? (
            !recording ? (
              <button className="vp-btn" onClick={start}>&#127908; Add a voice postscript</button>
            ) : (
              <div className="vp-recording">
                <span className="vp-dot" /> Recording… {seconds}s / {MAX_SECONDS}s
                <button className="vp-btn vp-stop" onClick={stop}>Stop</button>
              </div>
            )
          ) : (
            <div className="vp-preview">
              {previewUrl && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <audio controls src={previewUrl} className="vp-audio" />
              )}
              <button className="vp-btn vp-primary" onClick={save} disabled={busy}>{busy ? "…" : "Attach"}</button>
              <button className="vp-btn" onClick={discard} disabled={busy}>Redo</button>
            </div>
          )}
        </div>
      ) : null}
      {err && <div className="vp-err">{err}</div>}

      <style>{`
        .vp { max-width: 700px; margin: 14px auto 0; }
        .vp-player, .vp-record, .vp-preview, .vp-recording { display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          background: #f6f3ea; border: 1px solid #e2d8c2; border-radius: 10px; padding: 10px 14px; }
        .vp-label { color: #6b5640; font-size: 14px; font-weight: 600; }
        .vp-audio { height: 34px; max-width: 320px; flex: 1; }
        .vp-btn { font: inherit; font-size: 13px; padding: 7px 14px; border-radius: 8px; border: 1px solid #c9b8a0;
          background: #fff; color: #6b5640; cursor: pointer; }
        .vp-btn:hover { border-color: #b98a5e; }
        .vp-primary { background: #6b5640; color: #faf7f0; border-color: #6b5640; font-weight: 600; }
        .vp-remove { color: #9c3b34; border-color: #e3b9b4; }
        .vp-stop { color: #9c3b34; }
        .vp-dot { width: 10px; height: 10px; border-radius: 50%; background: #d23; animation: vp-pulse 1s infinite; }
        @keyframes vp-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .vp-err { color: #9c3b34; font-size: 13px; margin-top: 6px; }
      `}</style>
    </div>
  );
}
