"use client";

import { useState, useEffect, useCallback } from "react";
import { PostCard } from "./PostCard";

interface Props {
  endpoint?: string;
  emptyMessage?: string;
}

export function Feed({
  endpoint = "/api/posts",
  emptyMessage = "No posts yet. Be the first to create one.",
}: Props) {
  const [posts, setPosts] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(endpoint, window.location.origin);
      if (cursor) url.searchParams.set("cursor", cursor);
      url.searchParams.set("limit", "20");

      const res = await fetch(url.toString());
      const data = await res.json();

      if (cursor) {
        setPosts((prev) => [...prev, ...data.posts]);
      } else {
        setPosts(data.posts || []);
      }

      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } catch (err) {
      console.error("Failed to load posts:", err);
    } finally {
      setLoading(false);
    }
  }, [endpoint, cursor]);

  useEffect(() => {
    loadPosts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = () => {
    if (hasMore && !loading) {
      loadPosts();
    }
  };

  return (
    <div className="feed">
      {posts.length === 0 && !loading && (
        <div className="feed-empty">{emptyMessage}</div>
      )}

      <div className="feed-grid">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {loading && (
        <div className="feed-loading">
          <div className="spinner" />
        </div>
      )}

      {hasMore && !loading && posts.length > 0 && (
        <button onClick={loadMore} className="load-more">
          Load more
        </button>
      )}

      <style>{`
        .feed {
          max-width: 600px;
          margin: 0 auto;
        }
        .feed-grid {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .feed-empty {
          text-align: center;
          padding: 60px 20px;
          color: #999;
          font-size: 16px;
        }
        .feed-loading {
          display: flex;
          justify-content: center;
          padding: 24px;
        }
        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e0e0e0;
          border-top-color: #333;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .load-more {
          display: block;
          margin: 24px auto;
          padding: 10px 32px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #fff;
          cursor: pointer;
          font-size: 15px;
          font-family: inherit;
          color: #555;
        }
        .load-more:hover {
          background: #f5f5f5;
        }
      `}</style>
    </div>
  );
}
