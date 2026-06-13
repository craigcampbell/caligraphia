"use client";

import Link from "next/link";
import { StarIcon, ScratchIcon } from "./Icons";

interface PostCardProps {
  post: {
    id: string;
    postType: string;
    imageUrl?: string | null;
    finalImageUrl: string | null;
    uploadedPhotoUrl: string | null;
    ocrHashtags: string[];
    createdAt: string;
    stampCount?: number;
    user: {
      id: string;
      username: string;
      nomDePlume: string | null;
    };
    _count: {
      scratches: number;
    };
  };
}

export function PostCard({ post }: PostCardProps) {
  const imageUrl = post.imageUrl || post.finalImageUrl || post.uploadedPhotoUrl;
  const stampCount = post.stampCount ?? 0;

  return (
    <article className="card">
      <Link href={`/post/${post.id}`} className="card-img-link">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="card-img" loading="lazy" />
        ) : (
          <div className="card-img-ph">No image</div>
        )}
      </Link>

      <div className="card-meta">
        <Link href={`/users/${post.user.id}`} className="card-author">
          {post.user.nomDePlume ? (
            <img src={post.user.nomDePlume} alt="" className="card-av" width={22} height={22} />
          ) : (
            <span className="card-av-ph">{post.user.username[0].toUpperCase()}</span>
          )}
          {post.user.username}
        </Link>

        <div className="card-stats">
          <span className="stat" title="Stamps"><StarIcon size={13} /> {stampCount}</span>
          <span className="stat" title="Scratches"><ScratchIcon size={13} /> {post._count.scratches}</span>
        </div>

        {post.ocrHashtags.length > 0 && (
          <div className="card-tags">
            {post.ocrHashtags.map((tag) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .card {
          border: 1px solid #e0d5c0;
          border-radius: 8px;
          overflow: hidden;
          background: #fefdf9;
          transition: box-shadow 0.2s;
        }
        .card:hover { box-shadow: 0 4px 20px rgba(80,40,20,0.06); }
        .card-img-link { display: block; }
        .card-img {
          width: 100%; height: 340px; object-fit: contain;
          background: #faf7f0;
        }
        .card-img-ph {
          width: 100%; height: 340px; display: flex; align-items: center;
          justify-content: center; background: #faf7f0; color: #b0a090; font-size: 13px;
        }
        .card-meta { padding: 14px 16px; }
        .card-author {
          display: flex; align-items: center; gap: 8px;
          font-weight: 600; font-size: 14px; color: #3a3020; margin-bottom: 8px;
        }
        .card-av { border-radius: 50%; object-fit: cover; }
        .card-av-ph {
          width: 22px; height: 22px; border-radius: 50%; background: #e0d5c0;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 600; color: #6b5c40;
        }
        .card-stats { display: flex; gap: 16px; margin-bottom: 8px; font-size: 13px; color: #8c7a60; }
        .stat { display: flex; align-items: center; gap: 3px; }
        .card-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .tag {
          font-size: 11px; color: #6b5c40; background: #f0e8d8;
          padding: 2px 10px; border-radius: 6px;
        }
      `}</style>
    </article>
  );
}
