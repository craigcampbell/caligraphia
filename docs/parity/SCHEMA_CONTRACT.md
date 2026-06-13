# Shared Schema Contract Notes

Last updated: 2026-06-13

The Prisma schema remains the shared domain model for web and iOS. Native DTOs should mirror client-visible fields, not database implementation details that should remain server-only.

## Core Models

### User

Client-visible fields:

- `id`
- `username`
- `nomDePlume`
- `stampBalance`
- `stampRefillAt`
- `totalStampsEarned`
- `createdAt`

`email` should be treated as auth/account data and not displayed broadly.

### Post

Client-visible fields:

- `id`
- `userId`
- `postType`
- `paperType`
- `inkStyle`
- `imageUrl` (client DTO display URL, usually `/api/images/:id`)
- `finalImageUrl`
- `uploadedPhotoUrl`
- `envelopeData`
- `signatureData`
- `stampCount`
- `recipientId`
- `isPrivate`
- `needsReview`
- `format`
- `deliverAt`
- `isDeadLetter`
- `ocrText`
- `ocrHashtags`
- `createdAt`
- `deletedAt`
- nested `user`
- optional `counts`
- optional legacy `_count`
- optional `stamped`

Writing provenance:

- Web canvas: `canvasStrokeData` is an array of normalized stroke points.
- Native PencilKit: `canvasStrokeData` is metadata pointing at a stored `PKDrawing` artifact.

## Writing Duration Rules

- Letters: 15 seconds.
- Postcards and round-robin sections: 8 seconds.
- Comments/postscripts: 2 seconds.

## Privacy Rules

- Private post detail should only be readable by sender or recipient.
- Slow-delivery letters should stay hidden until `deliverAt`, except for the sender.
- Private/dead-letter images should not be fetchable through `/api/images/:id` by unrelated users.
- Comments, scratches, stamps, and marginalia should respect the parent post's access rules.
- Guestbook, post comment, scratch, and post artwork media should be served through authenticated proxy routes.
- Existing object-storage public policies should be migrated away from public reads. The application now attempts to clear MinIO bucket policy on startup, but deployed buckets still need verification.
