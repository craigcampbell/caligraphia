# Croquia — Hand-Drawn Social Network

> 2026-06-13 status note: this is an early architecture snapshot. The current app has moved toward a correspondence-first Caligraphia product with stamp reactions, native iOS/Android clients, authenticated media proxies, and a shared parity ledger. Use `docs/0613.md`, `docs/parity/TRACKER.md`, and `docs/parity/API_CONTRACT.md` for current implementation status.

## Core Constraint
Users cannot type text anywhere in the application — no text inputs, no keyboards, no pasting. The only exception is the **username field at signup** (single text input). All content creation must use a drawing canvas or photo upload. The goal is to force intentional, authentic expression — no copypasta, no automation, no slop.

## Tech Stack
- **Frontend**: React (Next.js or Vite)
- **Backend**: Node.js (Express or Next.js API routes)
- **Database**: PostgreSQL
- **Storage**: Object storage (S3-compatible, MinIO for local dev)
- **Containerization**: Docker + Docker Compose

## Infrastructure Requirements
- Docker Compose file with services: app, db, storage
- Database migrations using a migration tool (Knex, Prisma, or similar)
- Environment configuration via `.env` file

## Data Model
User
id: uuid (PK)
username: string (unique, text input at signup only)
nom_de_plume: image URL (nullable, uploaded at signup)

Post
id: uuid (PK)
user_id: uuid (FK to User)
post_type: enum ('canvas' | 'photo')
canvas_stroke_data: JSON (array of stroke objects with time, x, y, pressure)
final_image_url: string (rendered PNG for canvas posts)
uploaded_photo_url: string (nullable, for photo posts)
ocr_text: string (raw OCR output)
ocr_hashtags: string[] (extracted from OCR)
created_at: timestamp
deleted_at: timestamp (nullable, soft-delete)

PostInteraction
post_id: uuid (FK to Post)
user_id: uuid (FK to User)
interaction_type: enum ('like' | 'dislike')
created_at: timestamp
(unique constraint on post_id + user_id)

Scratch
id: uuid (PK)
parent_post_id: uuid (FK to Post)
user_id: uuid (FK to User)
scratch_svg_data: text (SVG path data)
composite_image_url: string (rendered overlay image)
created_at: timestamp

Group
id: uuid (PK)
name: string
creator_id: uuid (FK to User)
tag_pattern: string (fuzzy regex pattern for membership)
created_at: timestamp

Flag
id: uuid (PK)
post_id: uuid (FK to Post)
user_id: uuid (FK to User)
reason: enum ('slop' | 'automated' | 'hateful' | 'other')
created_at: timestamp


## Authentication
- Email-based magic link auth (no password field)
- Signup flow: email → receive magic link → set username (text input) → upload nom de plume (image) → done
- No other text input anywhere in the auth flow

## API Endpoints

### Auth
- POST /api/auth/send-magic-link (email)
- POST /api/auth/verify-magic-link (token)
- GET /api/auth/me (current user)

### Posts
- POST /api/posts (create post: canvas stroke data OR photo upload)
- GET /api/posts (feed: paginated, optionally filtered by group or followed users)
- GET /api/posts/:id (single post with scratch overlays)
- DELETE /api/posts/:id (soft-delete, hidden from feed)

### Interactions
- POST /api/posts/:id/like
- POST /api/posts/:id/dislike
- DELETE /api/posts/:id/interaction (remove like/dislike)

### Scratches
- POST /api/posts/:id/scratch (create scratch overlay)
- GET /api/posts/:id/scratches (list scratches on a post)

### Groups
- POST /api/groups (create group)
- DELETE /api/groups/:id (destroy group, creator only)
- GET /api/groups (list groups)
- GET /api/groups/:id/posts (posts in group)

### Users
- POST /api/users/:id/follow
- DELETE /api/users/:id/follow
- GET /api/users/:id/posts (user's posts)
- GET /api/users/:id (profile)

## Post Creation Flow (Canvas)
1. User opens canvas component (full viewport or modal)
2. Canvas renders blank drawing surface
3. User draws with pointer (mouse, stylus, touch)
4. Every stroke is recorded: `[{time: ms, x, y, pressure: 0-1, color: string}]`
5. Minimum draw time: 15 seconds (reject earlier submits)
6. No undo/redo functionality
7. On submit: send stroke data to server, server renders final PNG, store both
8. Server runs OCR (Tesseract.js or similar) on final image, extracts text and hashtags

## Post Creation Flow (Photo)
1. User uploads photo from device
2. Server stores original photo
3. Server runs OCR (same as canvas flow)
4. No canvas recording — photo posts have no stroke data

## Feed & Discovery
- Primary feed: chronological, shows posts from followed users + random sampling
- Explore: visual similarity via image embeddings (CLIP or perceptual hash)
- Group feed: all posts matching group's tag_pattern via fuzzy OCR match
- Search: fuzzy trigram matching on OCR text — no exact match required
- No text search bar in v1 (discovery is scroll + browse only)

## Scratch Overlays
1. User views a post
2. User can enter "scratch mode"
3. User draws on top of the post image (red/scribble style)
4. Scratch is stored as SVG path data (not raster)
5. Composite image is rendered server-side: original post + scratch overlay
6. Composite is served as the "public" version of the scratched post
7. Original post image stays immutable
8. Multiple scratches are composited together in order of creation

## Group Mechanics
- Groups are created by any user with a name and tag_pattern regex
- Posts are automatically added to a group if their OCR hashtags match the pattern
- Example: group "Poetry" with pattern `#poem|#poetry|#verse`
- Group discovery: browse groups, see most popular posts within each
- Post popularity within group: based on likes/dislikes ratio (not global)

## Moderation (v1, community-driven)
- Posts with 0 interactions after 24 hours are hidden from main feed (removed via background job)
- 3+ flags from unique users auto-hides a post
- Scratches from trusted users have higher weight for auto-hide
- No ML moderation in v1

## Anti-Automation (v1, light)
- Rate limiting on post creation (1 post per 30 seconds per user)
- Canvas stroke recording must have minimum 15 seconds of active drawing
- Photo uploads allowed but logged with device metadata
- No paste/drag-drop support on canvas (only native drawing)

## Error Handling & UX
- No text input anywhere except username field (enforce at both frontend and API level)
- Canvas must clearly indicate: draw here, photo upload button, or cancel
- Login/signup flow must feel fast despite the creative constraint
- Soft-deleted posts return 404 for direct access but are not removed from database
- All image storage uses object storage URLs, not base64 in database

## Development Setup
- Docker Compose: `docker compose up` starts all services
- Seed script with sample handwritten posts (for development/testing)
- Database migrations run automatically on startup
- Local MinIO for S3-compatible storage

## Out of Scope for v1
- Direct messaging
- User profiles with text bios
- Embedding external content (links, videos)
- ML-based handwriting detection
- WebSockets / real-time features
- Historical note: mobile native apps were originally out of scope here, but iOS and Android are now active workstreams tracked in `docs/0613.md`.
