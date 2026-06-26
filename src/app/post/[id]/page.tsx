"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { StampButton } from "@/components/StampButton";
import { WriteBack } from "@/components/WriteBack";
import { RepliesThread } from "@/components/RepliesThread";
import { ReportButton } from "@/components/ReportButton";
import { Postscripts } from "@/components/Postscripts";
import { PaginatedPages } from "@/components/LetterViewer";
import { PostcardFlip } from "@/components/PostcardFlip";
import { ConfirmModal } from "@/components/ConfirmModal";
import { VoicePostscript } from "@/components/VoicePostscript";
import { useAuth } from "@/hooks/useAuth";
import { canThrowAwayPost } from "@/lib/post-access";
import Link from "next/link";

export default function PostDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [replyRefresh, setReplyRefresh] = useState(0);
  const [throwing, setThrowing] = useState(false);
  const [throwError, setThrowError] = useState<string | null>(null);
  const [confirmThrow, setConfirmThrow] = useState(false);
  const [showcased, setShowcased] = useState<boolean | null>(null);
  const [showcaseBusy, setShowcaseBusy] = useState(false);
  const [voiceOverride, setVoiceOverride] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/posts/${id}`);
        if (res.ok) {
          const data = await res.json();
          setPost(data.post);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleThrowAway = async () => {
    if (throwing) return;
    setThrowError(null);
    setThrowing(true);
    // Let the crumple-and-toss animation play out, then actually discard it.
    // Match the shortened duration when the viewer prefers reduced motion.
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    await new Promise((r) => setTimeout(r, reduceMotion ? 250 : 820));
    try {
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      if (res.ok) {
        window.location.href = "/";
        return;
      }
      const data = await res.json().catch(() => null);
      setThrowError(data?.error || "Could not throw this letter away.");
      setThrowing(false);
    } catch {
      setThrowError("Could not throw this letter away.");
      setThrowing(false);
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <NavBar />
        <main className="detail-loading">
          <div className="spinner" />
        </main>
        <style>{`.detail-loading{display:flex;align-items:center;justify-content:center;min-height:60vh}.spinner{width:40px;height:40px;border:3px solid #e0e0e0;border-top-color:#333;border-radius:50%;animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </AuthGuard>
    );
  }

  if (!post) {
    return (
      <AuthGuard>
        <NavBar />
        <main className="detail-not-found">Post not found.</main>
        <style>{`.detail-not-found{text-align:center;padding:60px 16px;color:#999;font-size:16px}`}</style>
      </AuthGuard>
    );
  }

  const imageUrl =
    post.compositeImageUrl ||
    post.imageUrl ||
    post.finalImageUrl ||
    post.uploadedPhotoUrl;

  const isOwner = user?.id === post.user.id;
  const canThrow = canThrowAwayPost(post, user?.id);
  const showcaseEligible =
    isOwner && !post.isPrivate && !post.recipientId && !post.isDeadLetter && !post.needsReview && !post.deletedAt;
  const isShowcased = showcased ?? !!post.isShowcased;

  const toggleShowcase = async () => {
    if (showcaseBusy) return;
    setShowcaseBusy(true);
    const next = !isShowcased;
    try {
      const res = await fetch(`/api/posts/${post.id}/showcase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showcase: next }),
      });
      if (res.ok) setShowcased(next);
    } catch {
      /* ignore */
    } finally {
      setShowcaseBusy(false);
    }
  };
  const pageUrls = [
    imageUrl,
    ...(Array.isArray(post.pages) ? post.pages.map((pg: any) => pg.imageUrl) : []),
  ].filter(Boolean) as string[];

  return (
    <AuthGuard>
      <NavBar />
      <main className="detail-main">
        <div className="detail-header">
          <Link href={`/users/${post.user.id}`} className="detail-author">
            {post.user.nomDePlume ? (
              <img src={post.user.nomDePlume} alt="" className="author-avatar" width={32} height={32} />
            ) : (
              <span className="author-avatar-placeholder">{post.user.username[0].toUpperCase()}</span>
            )}
            <span>{post.user.username}</span>
          </Link>

          <div className="detail-actions-row">
            <StampButton
              postId={post.id}
              initialStampCount={post.stampCount ?? 0}
              initialStamped={!!post.stamped}
            />
            <WriteBack
              postId={post.id}
              letterImageUrl={imageUrl}
              onPosted={() => setReplyRefresh((k) => k + 1)}
            />
            {canThrow && (
              <button
                onClick={() => setConfirmThrow(true)}
                className="btn-throwaway"
                disabled={throwing}
                title="Throw this letter away"
              >
                🗑 Throw away
              </button>
            )}
            {!isOwner && <ReportButton targetType="post" targetId={post.id} />}
          </div>
        </div>

        {throwError && <div className="throw-error">{throwError}</div>}

        <div className={`detail-image-wrapper${throwing ? " throwing" : ""}`}>
          {post.format === "photocard" && post.backImageUrl && imageUrl ? (
            <PostcardFlip frontUrl={imageUrl} backUrl={post.backImageUrl} />
          ) : pageUrls.length > 0 ? (
            <PaginatedPages pages={pageUrls} variant="inline" />
          ) : (
            <div className="detail-no-image">No image available</div>
          )}
        </div>

        <VoicePostscript
          postId={post.id}
          voiceUrl={voiceOverride !== undefined ? voiceOverride : post.voiceUrl || null}
          isOwner={isOwner}
          onChange={(has) => setVoiceOverride(has ? `/api/media/voice/${post.id}` : null)}
        />

        {post.ocrHashtags?.length > 0 && (
          <div className="detail-hashtags">
            {post.ocrHashtags.map((tag: string) => (
              <span key={tag} className="hashtag">{tag}</span>
            ))}
          </div>
        )}

        {showcaseEligible && (
          <div className="showcase-card">
            {isShowcased ? (
              <>
                <span className="showcase-on">&#127807; Showcased on the public web</span>
                <a className="showcase-link" href={`/l/${post.id}`} target="_blank" rel="noreferrer">view public page &#8599;</a>
                <button className="showcase-btn off" onClick={toggleShowcase} disabled={showcaseBusy}>
                  {showcaseBusy ? "…" : "Make members-only"}
                </button>
              </>
            ) : (
              <>
                <span className="showcase-off">Share this letter beyond Caligraphia?</span>
                <button className="showcase-btn" onClick={toggleShowcase} disabled={showcaseBusy}>
                  {showcaseBusy ? "…" : "Showcase publicly"}
                </button>
                <span className="showcase-note">Creates a public, shareable link — only for letters you&apos;re happy to show the open internet.</span>
              </>
            )}
          </div>
        )}

        <Postscripts endpoint={`/api/posts/${post.id}/comments`} initialComments={post.comments || []} />

        <RepliesThread postId={post.id} refreshKey={replyRefresh} />
      </main>

      <ConfirmModal
        open={confirmThrow}
        title="Throw this letter away?"
        message="It'll be crumpled up and taken down. You can still restore it from the admin panel if needed."
        confirmLabel="Throw it away"
        danger
        onCancel={() => setConfirmThrow(false)}
        onConfirm={() => { setConfirmThrow(false); handleThrowAway(); }}
      />

      <style>{`
        .btn-throwaway {
          padding: 8px 14px;
          border: 1px solid #c9b8a0;
          border-radius: 8px;
          background: #fff;
          color: #7a5c43;
          cursor: pointer;
          font-weight: 600;
          font-family: inherit;
          font-size: 15px;
        }
        .btn-throwaway:hover { background: #f7efe4; border-color: #a98a68; }
        .btn-throwaway:disabled { opacity: 0.6; cursor: default; }
        .throw-error {
          color: #9c3b34; background: #f6e3e1; border: 1px solid #e3b9b4;
          padding: 8px 12px; border-radius: 8px; margin: 0 0 12px; font-size: 14px;
        }
        .showcase-card {
          max-width: 700px; margin: 18px auto 0; padding: 12px 16px; display: flex;
          align-items: center; gap: 12px; flex-wrap: wrap;
          background: #f6f3ea; border: 1px solid #e2d8c2; border-radius: 10px; font-size: 14px;
        }
        .showcase-on { color: #5a7a4a; font-weight: 600; }
        .showcase-off { color: #6b5640; }
        .showcase-link { color: #8a5a2b; text-decoration: none; }
        .showcase-btn {
          font: inherit; font-size: 13px; padding: 7px 14px; border-radius: 8px;
          border: 1px solid #b98a5e; background: #fff; color: #8a5a2b; cursor: pointer; font-weight: 600;
        }
        .showcase-btn:hover { background: #fbf3e8; }
        .showcase-btn.off { border-color: #d0c8b8; color: #6b5640; font-weight: 500; }
        .showcase-note { flex-basis: 100%; font-size: 12px; color: #a89a82; }
        .detail-image-wrapper.throwing {
          animation: wadAndToss 0.85s cubic-bezier(.5,-0.15,.75,.5) forwards;
          transform-origin: center center;
          pointer-events: none;
          will-change: transform, opacity, filter;
        }
        @keyframes wadAndToss {
          0%   { transform: scale(1) rotate(0deg); opacity: 1; filter: none; border-radius: 0; }
          22%  { transform: scale(0.72) rotate(-6deg); filter: contrast(1.25) brightness(0.95); border-radius: 30% 45% 40% 50%; }
          48%  { transform: scale(0.42) rotate(9deg); filter: contrast(1.5) brightness(0.85); border-radius: 48% 52% 45% 55%; }
          68%  { transform: translate(6vw, 5vh) scale(0.3) rotate(20deg); filter: contrast(1.6) brightness(0.82); border-radius: 50%; }
          100% { transform: translate(78vw, -88vh) scale(0.05) rotate(330deg); opacity: 0; filter: contrast(1.7) brightness(0.8); border-radius: 50%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .detail-image-wrapper.throwing { animation-duration: 0.25s; }
        }
      `}</style>


      <style>{`
        .detail-main {
          max-width: 700px;
          margin: 0 auto;
          padding: 24px 16px;
        }
        .detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
        }
        .detail-author {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          color: #333;
          font-weight: 600;
          font-size: 15px;
        }
        .author-avatar {
          border-radius: 50%;
          object-fit: cover;
        }
        .author-avatar-placeholder {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #ddd;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          color: #555;
        }
        .detail-actions-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .btn-scratch {
          padding: 8px 16px;
          border: 1px solid #e53e3e;
          border-radius: 8px;
          background: #fff;
          color: #e53e3e;
          cursor: pointer;
          font-weight: 600;
          font-family: inherit;
          font-size: 15px;
        }
        .btn-scratch:hover {
          background: #fff5f5;
        }
        .btn-delete {
          padding: 8px 16px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #fff;
          color: #888;
          cursor: pointer;
          font-family: inherit;
          font-size: 14px;
        }
        .btn-delete:hover {
          background: #f5f5f5;
          color: #e53e3e;
        }
        .detail-image-wrapper {
          border-radius: 6px;
          overflow: hidden;
          background: #fafafa;
          margin-bottom: 16px;
        }
        .detail-page-label {
          font-size: 12px; font-weight: 600; color: #8c7a60;
          padding: 8px 12px; background: #f3ecdc; border-bottom: 1px solid #e0d5c0;
        }
        .detail-extra-page { border-top: 2px solid #e0d5c0; }
        .detail-image {
          width: 100%;
          max-height: 80vh;
          object-fit: contain;
        }
        .detail-no-image {
          padding: 60px;
          text-align: center;
          color: #999;
        }
        .detail-hashtags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 16px;
        }
        .hashtag {
          font-size: 13px;
          color: #666;
          background: #f0f0f0;
          padding: 4px 10px;
          border-radius: 6px;
        }
        .detail-scratches {
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid #eee;
        }
        .scratches-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .scratch-item {
          margin-bottom: 16px;
        }
        .scratch-author {
          font-size: 13px;
          color: #888;
          margin-bottom: 6px;
        }
        .scratch-composite {
          max-width: 100%;
          border-radius: 8px;
          border: 1px solid #eee;
        }
      `}</style>
    </AuthGuard>
  );
}
