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
