"use client";

import Link from "next/link";

interface PostCardProps {
  post: {
    id: string;
    postType: string;
    finalImageUrl: string | null;
    uploadedPhotoUrl: string | null;
    ocrHashtags: string[];
    createdAt: string;
    user: {
      id: string;
      username: string;
      nomDePlume: string | null;
    };
    _count: {
      interactions: number;
      scratches: number;
    };
    likeCount?: number;
    dislikeCount?: number;
  };
}

export function PostCard({ post }: PostCardProps) {
  const imageUrl = post.finalImageUrl || post.uploadedPhotoUrl;
  const likeCount = post.likeCount ?? post._count.interactions;
  const dislikeCount = post.dislikeCount ?? 0;

  return (
    <article className="post-card">
      <Link href={`/post/${post.id}`} className="post-image-link">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="post-image"
            loading="lazy"
          />
        ) : (
          <div className="post-image-placeholder">No image</div>
        )}
      </Link>

      <div className="post-meta">
        <Link href={`/users/${post.user.id}`} className="post-author">
          {post.user.nomDePlume ? (
            <img
              src={post.user.nomDePlume}
              alt=""
              className="author-avatar"
              width={24}
              height={24}
            />
          ) : (
            <span className="author-avatar-placeholder">
              {post.user.username[0].toUpperCase()}
            </span>
          )}
          <span>{post.user.username}</span>
        </Link>

        <div className="post-stats">
          <span className="stat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/></svg>
            {likeCount}
          </span>
          <span className="stat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/></svg>
            {dislikeCount}
          </span>
          <span className="stat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
            {post._count.scratches}
          </span>
        </div>

        {post.ocrHashtags.length > 0 && (
          <div className="post-hashtags">
            {post.ocrHashtags.map((tag) => (
              <span key={tag} className="hashtag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .post-card {
          border: 1px solid #e8e8e8;
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
          transition: box-shadow 0.15s;
        }
        .post-card:hover {
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        .post-image-link {
          display: block;
        }
        .post-image {
          width: 100%;
          height: 320px;
          object-fit: contain;
          background: #fafafa;
        }
        .post-image-placeholder {
          width: 100%;
          height: 320px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f5f5;
          color: #999;
          font-size: 14px;
        }
        .post-meta {
          padding: 12px 16px;
        }
        .post-author {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          color: #333;
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 8px;
        }
        .author-avatar {
          border-radius: 50%;
          object-fit: cover;
        }
        .author-avatar-placeholder {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #ddd;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: #555;
        }
        .post-stats {
          display: flex;
          gap: 16px;
          margin-bottom: 8px;
        }
        .stat {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: #888;
        }
        .post-hashtags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .hashtag {
          font-size: 12px;
          color: #666;
          background: #f0f0f0;
          padding: 2px 8px;
          border-radius: 10px;
        }
      `}</style>
    </article>
  );
}
