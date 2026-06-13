# Native iOS Kanban

Last updated: 2026-06-13

## Intake

- [ ] Decide deployment target after device inventory. Default assumption: iOS/iPadOS 17+ for modern SwiftUI and Observation, with optional iOS 18+ PencilKit enhancements.
- [ ] Decide whether the native app lives as a standalone Xcode project or is integrated into the user's existing iOS app/workspace.
- [ ] Capture first physical-device writing baseline on iPad with Apple Pencil.

## Contract Needed

- [x] Native post payload for PencilKit drawing + rendered PNG.
- [ ] Native magic-link universal-link contract.
- [x] Image URL/proxy policy for private and dead-letter post images.
- [x] Stable response DTOs for feed, inbox, and detail.
- [ ] Stable response DTOs for profile, requests, groups, and stamps.

## Ready For iOS

- [x] Swift package scaffold: `ios/CaligraphiaNative`.
- [x] Standalone Xcode app target: `ios/CaligraphiaApp`.
- [x] Shared Swift DTOs for users, posts, feed responses, and native post submission.
- [x] PencilKit composer scaffold with paper/ink metadata and submit export.
- [x] iPad Simulator launch smoke test for the Write tab.
- [x] XCUITest drawing/export smoke for the PencilKit composer.
- [x] Basic Photos import and share-out from the iOS app.
- [x] Feed/inbox/detail client methods with fixture tests.
- [x] Composer integration with authenticated post submission.
- [x] Imported Photos image submission through multipart post upload.
- [x] Authenticated guestbook media proxy route for native-safe image loading.
- [ ] iOS Share Extension for share-into-Caligraphia from drawing apps.

## iOS In Progress

- [x] App shell with `TabView` and per-tab `NavigationStack`.
- [ ] Native `ComposeFlow` state machine.
- [x] Basic Postbox feed cards.
- [x] Basic Inbox list and reader.

## Parity QA

- [ ] Web compose letter vs native compose letter acceptance pass.
- [ ] Web inbox/private letter vs native inbox acceptance pass.
- [ ] Web post detail/stamp/postscript/scratch vs native reader acceptance pass.
- [ ] Performance trace: native composer with continuous Pencil writing.

## Parity Complete

- None yet.

## Deferred / Acceptable Variance

- [ ] Exact custom ink parity: acceptable first-slice variance if PencilKit writing feel is measurably better.
- [ ] Native replay: deferred until sidecar timeline or `PKDrawing.strokes` replay is chosen.
- [ ] Web table/board/gallery immersive gestures: iPad-enhanced later, list/card fallback allowed on iPhone.
- [ ] Save exported letters to Photos.
- [ ] Production bucket audit: app startup now attempts to clear MinIO bucket policy, but deployed object storage should still be verified.

## Blocked

- [ ] Current auth is cookie-based; native can use cookie storage, but polished app links need universal-link handling.
