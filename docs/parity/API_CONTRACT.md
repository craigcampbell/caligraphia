# Shared API Contract Notes

Last updated: 2026-06-13

The native app should use the same API surface as the web app whenever possible. Any endpoint used by both clients should have stable request/response shapes, documented privacy behavior, and fixture coverage.

## Auth

The current session mechanism is an HTTP-only cookie named `croquis_session`.

Native options:

- Short term: use `URLSession` with shared cookie storage and call the existing auth routes.
- Required for production polish: universal links that capture magic-link tokens and route them into `POST /api/auth/verify-magic-link`.
- Optional later: first-class native token/session exchange if cookie behavior becomes painful.

## Posts

### Cross-Platform Artwork Rule

Every client must treat `imageUrl` as the preferred display URL and `finalImageUrl` as the canonical stored artwork field for a posted letter. API responses rewrite post image fields to the authenticated `/api/images/:id` proxy when a post has display media.

Native clients may keep richer local or provenance data:

- Web stores normalized stroke points.
- iOS stores PencilKit `PKDrawing.dataRepresentation()` plus its rendered PNG.
- Android should submit normalized stroke points when using the portable stroke engine, or a rendered PNG when it later gains a first-class native-artifact endpoint.

Those raw formats are for editing, replay, diagnostics, or future migration. They are not the visual source of truth in shared feeds, inboxes, profile grids, or detail screens. Once a letter is sent, all three platforms should display the server-owned artwork through `imageUrl` or the proxied `finalImageUrl` so everyone sees the same paper, ink, penmanship, watercolor, and gilding result.

### Web Canvas Payload

`POST /api/posts` accepts the existing web stroke format:

```json
{
  "canvas_stroke_data": [
    {
      "time": 1710000000000,
      "x": 0.42,
      "y": 0.24,
      "pressure": 0.7,
      "color": "#1a1a2e",
      "ink": "standard"
    }
  ],
  "drawing_duration_ms": 16000,
  "paper": "ruled",
  "ink_style": "standard"
}
```

### Native PencilKit Payload

`POST /api/posts` also accepts:

```json
{
  "native_drawing_data_base64": "base64 PKDrawing dataRepresentation",
  "rendered_image_data_base64": "base64 PNG",
  "drawing_duration_ms": 16000,
  "paper": "ruled",
  "ink_style": "standard",
  "format": "letter"
}
```

Shared behavior:

- Minimum duration still applies.
- Server uploads both the native drawing artifact and the rendered PNG.
- Server runs OCR on the rendered PNG.
- API responses expose `imageUrl` as the display image for every client.
- `finalImageUrl` remains the canonical stored image field and is proxied in client responses.
- `canvasStrokeData` stores provenance metadata. For native, the shape is:

```json
{
  "format": "pencilkit-v1",
  "drawingDataUrl": "object storage URL",
  "source": "ios",
  "paper": "ruled",
  "inkStyle": "standard"
}
```

## Remaining Contract Risks

- Existing object-storage buckets may still have public policies from older setup. The app now reads through authenticated media proxies and attempts to clear the MinIO bucket policy at startup, but deployed storage still needs a production audit for defense in depth.
- Response shapes now include stable `imageUrl` and `counts` on post responses, while legacy `_count` remains during the web transition. Profile, requests, groups, stamps, and guestbook still need full DTO fixtures.
- Guestbook, post comment, and scratch media now use authenticated media proxy routes. Native clients should still keep conservative private caches until production storage policy is verified.
- Stamps mean two things: social reaction balance and collectible stamp objects. Do not conflate these in native models.
