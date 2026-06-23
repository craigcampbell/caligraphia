type CountMap = Record<string, number | undefined>;

export interface PostDtoInput {
  [key: string]: unknown;
  id: string;
  finalImageUrl?: string | null;
  uploadedPhotoUrl?: string | null;
  stampCount?: number | null;
  createdAt?: Date | string;
  deliverAt?: Date | string | null;
  deletedAt?: Date | string | null;
  readAt?: Date | string | null;
  _count?: CountMap;
  scratches?: unknown[];
  comments?: unknown[];
  pages?: unknown[];
  pageCount?: number;
}

export interface PostPageDtoInput {
  [key: string]: unknown;
  id: string;
  imageUrl?: string | null;
}

export interface CommentDtoInput {
  [key: string]: unknown;
  id: string;
  imageUrl?: string | null;
}

export interface ScratchDtoInput {
  [key: string]: unknown;
  id: string;
  compositeImageUrl?: string | null;
}

export interface GuestbookEntryDtoInput {
  [key: string]: unknown;
  id: string;
  imageUrl?: string | null;
}

export function postImageUrl(post: PostDtoInput): string | null {
  return post.finalImageUrl || post.uploadedPhotoUrl ? `/api/images/${post.id}` : null;
}

export function serializePost<T extends PostDtoInput>(post: T) {
  const imageUrl = postImageUrl(post);
  const comments = Array.isArray(post.comments)
    ? post.comments.map((comment) => serializeComment(comment as CommentDtoInput))
    : post.comments;
  const scratches = Array.isArray(post.scratches)
    ? post.scratches.map((scratch) => serializeScratch(scratch as ScratchDtoInput))
    : post.scratches;
  const pages = Array.isArray(post.pages)
    ? post.pages.map((page) => serializePostPage(page as PostPageDtoInput))
    : post.pages;

  return {
    ...post,
    comments,
    scratches,
    pages,
    imageUrl,
    finalImageUrl: post.finalImageUrl ? imageUrl : null,
    uploadedPhotoUrl: !post.finalImageUrl && post.uploadedPhotoUrl ? imageUrl : null,
    createdAt: toIsoString(post.createdAt),
    deliverAt: toIsoString(post.deliverAt),
    deletedAt: toIsoString(post.deletedAt),
    readAt: toIsoString(post.readAt),
    counts: {
      scratches: post._count?.scratches ?? post.scratches?.length ?? 0,
      comments: post._count?.comments ?? post.comments?.length ?? 0,
      interactions: post._count?.interactions ?? 0,
      stamps: post.stampCount ?? 0,
    },
  };
}

export function serializePosts<T extends PostDtoInput>(posts: T[]) {
  return posts.map(serializePost);
}

export function serializeComment<T extends CommentDtoInput>(comment: T) {
  return {
    ...comment,
    imageUrl: comment.imageUrl ? `/api/media/comments/${comment.id}` : comment.imageUrl ?? null,
  };
}

export function serializeComments<T extends CommentDtoInput>(comments: T[]) {
  return comments.map(serializeComment);
}

export function serializeScratch<T extends ScratchDtoInput>(scratch: T) {
  return {
    ...scratch,
    compositeImageUrl: scratch.compositeImageUrl
      ? `/api/media/scratches/${scratch.id}`
      : scratch.compositeImageUrl ?? null,
  };
}

export function serializeScratches<T extends ScratchDtoInput>(scratches: T[]) {
  return scratches.map(serializeScratch);
}

export function serializePostPage<T extends PostPageDtoInput>(page: T) {
  return {
    ...page,
    imageUrl: page.imageUrl ? `/api/media/pages/${page.id}` : page.imageUrl ?? null,
  };
}

export function serializePostPages<T extends PostPageDtoInput>(pages: T[]) {
  return pages.map(serializePostPage);
}

export function serializeGuestbookEntry<T extends GuestbookEntryDtoInput>(entry: T) {
  return {
    ...entry,
    imageUrl: entry.imageUrl ? `/api/media/guestbook/${entry.id}` : entry.imageUrl ?? null,
  };
}

export function serializeGuestbookEntries<T extends GuestbookEntryDtoInput>(entries: T[]) {
  return entries.map(serializeGuestbookEntry);
}

function toIsoString(value: Date | string | null | undefined): string | null | undefined {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}
