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
