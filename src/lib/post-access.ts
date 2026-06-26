export interface ViewablePostFields {
  userId: string;
  recipientId: string | null;
  isPrivate: boolean;
  isDeadLetter: boolean;
  needsReview: boolean | null;
  deliverAt: Date | string | null;
  deletedAt: Date | string | null;
}

export function canViewPost(
  post: ViewablePostFields | null | undefined,
  userId: string,
  now: Date = new Date()
): boolean {
  if (!post || post.deletedAt) {
    return false;
  }

  const isAuthor = post.userId === userId;
  const isRecipient = post.recipientId === userId;

  if (post.deliverAt && new Date(post.deliverAt) > now && !isAuthor) {
    return false;
  }

  if (post.isPrivate || post.isDeadLetter) {
    return isAuthor || isRecipient;
  }

  if (post.needsReview && !isAuthor) {
    return false;
  }

  return true;
}

export interface PublicPostFields {
  isShowcased: boolean;
  isPrivate: boolean;
  isDeadLetter: boolean;
  needsReview: boolean | null;
  recipientId: string | null;
  deliverAt: Date | string | null;
  deletedAt: Date | string | null;
}

// THE single gate for "show this to the logged-out world." Deliberately strict:
// the author must have explicitly SHOWCASED a public-feed letter — and it must
// not be addressed to a person, private, held for review, a dead letter,
// scheduled, or deleted. Every public (unauthenticated) endpoint and page MUST
// funnel through this.
export function isPubliclyVisible(
  post: PublicPostFields | null | undefined,
  now: Date = new Date()
): boolean {
  if (!post) return false;
  if (!post.isShowcased) return false;
  if (post.deletedAt) return false;
  if (post.isPrivate) return false;
  if (post.isDeadLetter) return false;
  if (post.recipientId) return false;
  if (post.needsReview) return false;
  if (post.deliverAt && new Date(post.deliverAt) > now) return false;
  return true;
}

// Whether a letter is even ELIGIBLE to be showcased (before the author opts in).
export function isShowcaseEligible(
  post: Omit<PublicPostFields, "isShowcased"> | null | undefined,
  now: Date = new Date()
): boolean {
  if (!post) return false;
  if (post.deletedAt) return false;
  if (post.isPrivate) return false;
  if (post.isDeadLetter) return false;
  if (post.recipientId) return false;
  if (post.needsReview) return false;
  if (post.deliverAt && new Date(post.deliverAt) > now) return false;
  return true;
}

export interface ThrowAwayFields {
  userId: string;
  recipientId: string | null;
  deletedAt: Date | string | null;
}

// Who may throw a letter away (soft-delete it):
//  - A letter addressed to no one (public post / unclaimed dead letter) can be
//    discarded by its author.
//  - A letter sent to someone becomes the recipient's to keep or discard; once
//    sent, the author can no longer throw it away.
export function canThrowAwayPost(
  post: ThrowAwayFields | null | undefined,
  userId: string | null | undefined
): boolean {
  if (!post || post.deletedAt || !userId) return false;
  if (post.recipientId == null) return post.userId === userId;
  return post.recipientId === userId;
}
