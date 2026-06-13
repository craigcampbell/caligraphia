import { describe, expect, it } from "vitest";
import { canViewPost, type ViewablePostFields } from "../src/lib/post-access";

const now = new Date("2026-06-13T12:00:00Z");

function post(overrides: Partial<ViewablePostFields> = {}): ViewablePostFields {
  return {
    userId: "sender",
    recipientId: null,
    isPrivate: false,
    isDeadLetter: false,
    needsReview: false,
    deliverAt: null,
    deletedAt: null,
    ...overrides,
  };
}

describe("canViewPost", () => {
  it("allows public reviewed letters", () => {
    expect(canViewPost(post(), "visitor", now)).toBe(true);
  });

  it("hides deleted letters from everyone", () => {
    expect(canViewPost(post({ deletedAt: now }), "sender", now)).toBe(false);
  });

  it("limits private letters to the sender and recipient", () => {
    const privatePost = post({ isPrivate: true, recipientId: "recipient" });

    expect(canViewPost(privatePost, "sender", now)).toBe(true);
    expect(canViewPost(privatePost, "recipient", now)).toBe(true);
    expect(canViewPost(privatePost, "visitor", now)).toBe(false);
  });

  it("keeps unclaimed dead letters private to their author", () => {
    const deadLetter = post({ isPrivate: true, isDeadLetter: true });

    expect(canViewPost(deadLetter, "sender", now)).toBe(true);
    expect(canViewPost(deadLetter, "visitor", now)).toBe(false);
  });

  it("allows claimed dead letters for the recipient", () => {
    const deadLetter = post({
      isPrivate: true,
      isDeadLetter: true,
      recipientId: "recipient",
    });

    expect(canViewPost(deadLetter, "recipient", now)).toBe(true);
  });

  it("hides slow-delivery letters from recipients until arrival", () => {
    const slowPost = post({
      isPrivate: true,
      recipientId: "recipient",
      deliverAt: new Date("2026-06-14T08:00:00Z"),
    });

    expect(canViewPost(slowPost, "sender", now)).toBe(true);
    expect(canViewPost(slowPost, "recipient", now)).toBe(false);
  });

  it("hides review-pending public letters from non-authors", () => {
    const reviewPost = post({ needsReview: true });

    expect(canViewPost(reviewPost, "sender", now)).toBe(true);
    expect(canViewPost(reviewPost, "visitor", now)).toBe(false);
  });
});
