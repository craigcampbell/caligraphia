# Caligraphia Native iOS Implementation

Last updated: 2026-06-13

## Goal

Build a SwiftUI-native Caligraphia app that keeps feature parity with the web app while making the handwriting experience feel native on iPad and iPhone. The writing surface is the product-critical path: Apple Pencil and finger writing must feel immediate, stable, and intentional.

The web app remains the canonical shipped client and the Next API remains the system of record during the migration. Native work should not fork product behavior silently; every native screen or endpoint change must update the parity ledger in `docs/parity/TRACKER.md`.

## Research Summary

- Use SwiftUI for the app shell, navigation, feeds, inbox, profile, and social flows.
- Use PencilKit through `PKCanvasView` for the primary writing surface. Apple positions PencilKit/`PKCanvasView` as the system drawing environment for Apple Pencil and finger input, and `PKDrawing` as the persisted drawing artifact.
- Keep a native escape hatch for custom rendering later. The current web ink engine has expressive effects such as runny splatter, quill wobble, calligraphy ribbons, and brush speed thinning. PencilKit will not exactly match those styles at first, but it should win the first performance round.
- Store both a display image and a native drawing artifact. The existing product already separates provenance (`canvasStrokeData`) from display (`finalImageUrl`). Native should preserve that split by uploading a rendered PNG plus `PKDrawing.dataRepresentation()`.
- Use the existing backend routes first. Add native-specific payload contracts only when the web stroke array cannot represent a native artifact cleanly.
- Profile before polishing. Apple's SwiftUI performance guidance points to Instruments, the SwiftUI template, Time Profiler, and Hangs/Hitches for evidence. The Pencil path should not be considered complete until it has device traces on iPad.

Primary references:

- Apple Pencil and PencilKit overview: https://developer.apple.com/documentation/pencilkit
- PKDrawing storage/rendering: https://developer.apple.com/documentation/pencilkit/pkdrawing-swift.struct
- Touch input, coalesced touches, and predicted touches: https://developer.apple.com/documentation/UIKit/leveraging-touch-input-for-drawing-apps
- SwiftUI performance profiling: https://developer.apple.com/documentation/Xcode/understanding-and-improving-swiftui-performance
- WWDC24 Apple Pencil/PencilKit tool picker updates: https://developer.apple.com/videos/play/wwdc2024/10214/

## Native Architecture

### App Shell

- `TabView` top level: Postbox, Write, Inbox, Browse, Desk.
- Per-tab `NavigationStack` paths so deep browsing does not reset other tabs.
- Central sheet routing for composer, profile actions, request answer, and envelope preview.
- Shared services in environment: API client, session store, image cache, draft store.
- Feature-local state stays local. Avoid a single global observable app model that invalidates every screen.

### Writing Surface

First native slice:

- `LetterComposerView`: SwiftUI state machine for writing a letter.
- `PencilKitCanvasView`: `UIViewRepresentable` bridge around `PKCanvasView`.
- Paper preset selector matching web IDs: `blank`, `ruled`, `graph`, `watercolor`, `vellum`, `midnight`.
- Ink metadata selector matching web IDs: `standard`, `runny`, `quill`, `calligraphy`, `copperplate`, `brush`.
- Minimum draw timer: 15 seconds for letters, 8 seconds for postcards/round-robin sections, 2 seconds for postscripts.
- Undo via `PKCanvasView.undoManager`.
- Submit exports:
  - `PKDrawing.dataRepresentation()`
  - rendered PNG preview
  - duration
  - paper/ink metadata
  - destination context

Native variance to track:

- PencilKit ink will feel native but will not match every web ink style exactly.
- Web replay uses timestamped stroke points. Native replay needs either `PKDrawing.strokes` inspection or a separate event timeline.
- Web splatter is currently not stored in stroke data; it must become an explicit event before native parity can be complete.

### Backend Contract

The existing `POST /api/posts` JSON body accepts web canvas stroke arrays. Native adds a parallel JSON payload:

```json
{
  "native_drawing_data_base64": "base64 PKDrawing dataRepresentation",
  "rendered_image_data_base64": "base64 PNG rendered by the device",
  "drawing_duration_ms": 17340,
  "paper": "ruled",
  "ink_style": "standard",
  "format": "letter",
  "recipient_id": "optional uuid",
  "is_private": true,
  "delivery": "slow",
  "is_dead_letter": false
}
```

Server behavior:

- Validate native duration and non-empty binary payloads.
- Upload the drawing artifact to object storage.
- Upload the rendered PNG to object storage as `finalImageUrl`.
- Store `canvasStrokeData` as metadata with `format: "pencilkit-v1"` and the drawing artifact URL.
- Run OCR on the rendered PNG, same as the web flow.
- Reuse existing inbox/feed/privacy fields.

## Feature Parity Rule

Every native feature must have a tracker row before implementation. A feature is product-complete only when one of these is true:

- Web, iOS, and Android all meet the same acceptance criteria for the platforms where the feature is meant to ship.
- The difference is marked `acceptable variance` with a reason.
- The feature is explicitly marked `web only`, `ios only`, `android only`, or `deferred`.

Use `docs/parity/README.md` for the operating process and `docs/parity/TRACKER.md` as the execution ledger.

## Performance Requirements

- Test on physical iPad with Apple Pencil before claiming writing performance.
- Capture the composer interaction in Instruments using SwiftUI, Time Profiler, and Hangs/Hitches.
- Confirm drawing does not depend on SwiftUI body updates during active pencil movement. PencilKit should own hot-path ink rendering.
- Keep thumbnails downsampled in feeds; never decode full letter images inside a scrolling row.
- Use stable IDs in all feed/list surfaces.
- Do not run OCR, image encoding, upload preparation, or heavy sorting in SwiftUI `body`.

## First Implementation Kanban

### Now

- [x] Create native migration research and implementation plan.
- [x] Create a web/iOS parity process and seed tracker.
- [x] Add a native post payload contract to the backend.
- [x] Add a Swift package scaffold for the native client and PencilKit composer.
- [x] Add a standalone Xcode app target for iPad testing.
- [x] Run web validation tests and typecheck after backend changes.
- [x] Build the Swift package and app for an iOS Simulator destination.
- [x] Launch the app on an iPad simulator and confirm the Write tab renders.
- [x] Add automated drawing/export smoke test with XCUITest.
- [x] Add basic Photos import and share-out hooks.
- [x] Add native feed/inbox/detail API methods and fixtures.
- [x] Wire authenticated native canvas send.
- [x] Wire imported Photos images to multipart photo-letter send.

### Next

- [ ] Add native auth deep-link flow for magic-link verification.
- [ ] Add native `ComposeFlow` contexts: public, private recipient, dead letter, request ask, request fulfillment, exchange reply, round-robin section.
- [ ] Add an iOS Share Extension for images shared from other drawing apps.
- [ ] Add iPad layout pass: split-view reader, full-page composer, tabletop browse.
- [ ] Add screenshot/video evidence slots to the parity tracker.

### Later

- [ ] Native drawing replay from `PKDrawing.strokes` or a sidecar event timeline.
- [ ] Custom ink renderer parity for calligraphy/quill/runny effects if PencilKit variance feels too large.
- [ ] Pencil Pro affordances: squeeze palette, hover preview, haptics.
- [ ] Offline drafts with local persistence and upload retry.
- [ ] Push notifications for arrived letters and exchange matches.
