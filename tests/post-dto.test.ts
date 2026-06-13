import { describe, expect, it } from "vitest";
import {
  serializeComment,
  serializeGuestbookEntry,
  serializePost,
  serializeScratch,
} from "../src/lib/post-dto";

describe("serializePost", () => {
  it("rewrites final image URLs to the authenticated image proxy", () => {
    const post = serializePost({
      id: "post-1",
      finalImageUrl: "http://localhost:9000/croquis/posts/post-1.png",
      uploadedPhotoUrl: null,
      stampCount: 4,
      createdAt: new Date("2026-06-13T12:00:00Z"),
      _count: { scratches: 2, comments: 1 },
    });

    expect(post.imageUrl).toBe("/api/images/post-1");
    expect(post.finalImageUrl).toBe("/api/images/post-1");
    expect(post.uploadedPhotoUrl).toBeNull();
    expect(post.counts).toEqual({
      scratches: 2,
      comments: 1,
      interactions: 0,
      stamps: 4,
    });
    expect(post.createdAt).toBe("2026-06-13T12:00:00.000Z");
  });

  it("uses the same proxy for uploaded photo fallbacks", () => {
    const post = serializePost({
      id: "post-2",
      finalImageUrl: null,
      uploadedPhotoUrl: "http://localhost:9000/croquis/photos/post-2.jpg",
    });

    expect(post.imageUrl).toBe("/api/images/post-2");
    expect(post.finalImageUrl).toBeNull();
    expect(post.uploadedPhotoUrl).toBe("/api/images/post-2");
  });

  it("rewrites comment and scratch media to authenticated media proxies", () => {
    expect(
      serializeComment({
        id: "comment-1",
        imageUrl: "http://localhost:9000/croquis/comments/comment-1.png",
      }).imageUrl
    ).toBe("/api/media/comments/comment-1");

    expect(
      serializeScratch({
        id: "scratch-1",
        compositeImageUrl: "http://localhost:9000/croquis/scratches/scratch-1.png",
      }).compositeImageUrl
    ).toBe("/api/media/scratches/scratch-1");
  });

  it("rewrites guestbook media to an authenticated media proxy", () => {
    expect(
      serializeGuestbookEntry({
        id: "guestbook-1",
        imageUrl: "http://localhost:9000/croquis/guestbooks/guestbook-1.png",
      }).imageUrl
    ).toBe("/api/media/guestbook/guestbook-1");
  });
});
