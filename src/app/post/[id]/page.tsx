"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { StampButton } from "@/components/StampButton";
import { ScratchOverlay } from "@/components/ScratchOverlay";
import { DrawingReplay } from "@/components/DrawingReplay";
import { Postscripts } from "@/components/Postscripts";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

export default function PostDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scratchMode, setScratchMode] = useState(false);
  const [replayMode, setReplayMode] = useState(false);
  const [scratches, setScratches] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/posts/${id}`);
        if (res.ok) {
          const data = await res.json();
          setPost(data.post);
          setScratches(data.post.scratches || []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleScratchSubmit = async (svgData: string) => {
    try {
      const res = await fetch(`/api/posts/${id}/scratch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scratch_svg_data: svgData }),
      });
      if (res.ok) {
        const data = await res.json();
        setScratches((prev) => [...prev, data.scratch]);
        setScratchMode(false);
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this post?")) return;
    try {
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      if (res.ok) {
        window.location.href = "/";
      }
    } catch {
      // ignore
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
  const canReplay = Array.isArray(post.canvasStrokeData);

  const isOwner = user?.id === post.user.id;

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
            <button
              onClick={() => setScratchMode(true)}
              className="btn-scratch"
            >
              Scratch
            </button>
            {canReplay && (
              <button
                onClick={() => setReplayMode(true)}
                className="btn-replay"
              >
                &#9654; Watch me write
              </button>
            )}
            {isOwner && (
              <button onClick={handleDelete} className="btn-delete">
                Delete
              </button>
            )}
          </div>
        </div>

        <div className="detail-image-wrapper">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="detail-image" />
          ) : (
            <div className="detail-no-image">No image available</div>
          )}
        </div>

        {post.ocrHashtags?.length > 0 && (
          <div className="detail-hashtags">
            {post.ocrHashtags.map((tag: string) => (
              <span key={tag} className="hashtag">{tag}</span>
            ))}
          </div>
        )}

        <Postscripts endpoint={`/api/posts/${post.id}/comments`} initialComments={post.comments || []} />

        {scratches.length > 0 && (
          <div className="detail-scratches">
            <h3 className="scratches-title">Scratches ({scratches.length})</h3>
            {scratches.map((scratch: any) => (
              <div key={scratch.id} className="scratch-item">
                <div className="scratch-author">
                  {scratch.user.username} scratched this
                </div>
                {scratch.compositeImageUrl && (
                  <img
                    src={scratch.compositeImageUrl}
                    alt=""
                    className="scratch-composite"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {scratchMode && imageUrl && (
        <ScratchOverlay
          postImageUrl={imageUrl}
          onScratchSubmit={handleScratchSubmit}
          onClose={() => setScratchMode(false)}
        />
      )}

      {replayMode && canReplay && (
        <DrawingReplay
          strokes={post.canvasStrokeData}
          paper={post.paperType || "ruled"}
          inkStyle={post.inkStyle || "standard"}
          onClose={() => setReplayMode(false)}
        />
      )}

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
        .btn-replay {
          padding: 8px 16px;
          border: 1px solid #2471a3;
          border-radius: 8px;
          background: #fff;
          color: #2471a3;
          cursor: pointer;
          font-weight: 600;
          font-family: inherit;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .btn-replay:hover {
          background: #f0f8ff;
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
