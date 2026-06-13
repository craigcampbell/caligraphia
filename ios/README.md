# Caligraphia iOS Workspaces

This folder has two Xcode entry points:

1. `CaligraphiaNative/Package.swift`
   - Reusable Swift package with models, API client, and PencilKit composer pieces.
   - Use this when pulling Caligraphia writing components into another iOS app/workspace.

2. `CaligraphiaApp/CaligraphiaApp.xcodeproj`
   - Standalone iOS/iPadOS app target for fast device testing.
   - Current scheme: `CaligraphiaMobile`.
   - Current bundle id: `com.caligraphia.mobile`.

## Current Testable State

The standalone app opens into the Write tab and uses `LetterComposerView` with a native `PKCanvasView`. It includes PencilKit tool presets for standard pen, quill, calligraphy, italic, blackletter, copperplate, brush, watercolor, gold leaf, and illumination-style writing, plus swatches and a custom color picker. It can export a local rendered PNG and native drawing data after the minimum writing duration, submit authenticated canvas letters, submit imported photo letters, and browse authenticated Postbox, Inbox, and basic read-only detail screens.

Current sharing/photo hooks:

- Import images from Photos with `PhotosPicker`.
- Share exported letter PNGs out to other apps with `ShareLink`.
- Share imported photos back out through the system share sheet.
- Send imported photos as Caligraphia photo letters through the existing multipart post API.

Not yet built:

- iOS Share Extension for receiving images directly from Procreate, Freeform, Notes, Photos, or other drawing apps.
- Save-to-Photos flow.
- Shared app group storage between the main app and a future share extension.

Basic share-out and Photos import are small. A polished share-into-Caligraphia extension is medium-sized because it needs a second target, app-group storage, routing into the composer/send flow, and parity/access tests.

## Run On iPad

1. Open `ios/CaligraphiaApp/CaligraphiaApp.xcodeproj` in Xcode.
2. Select the `CaligraphiaMobile` scheme.
3. Select your connected iPad as the run destination.
4. In Signing & Capabilities, choose your Apple development team.
5. Run.

If the iPad appears offline in Xcode, unlock it, trust the Mac if prompted, and reconnect USB or Wi-Fi debugging.

## Smoke Test

The `CaligraphiaMobileUITests` target includes `CaligraphiaMobileDrawingSmokeTests`, which launches the app with `--ui-smoke`, draws on the PencilKit surface, taps Seal, and verifies the export sheet.

Run:

```sh
xcodebuild -project ios/CaligraphiaApp/CaligraphiaApp.xcodeproj -scheme CaligraphiaMobile -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4)' test
```

Simulator smoke testing proves the writing/export wiring works. It does not prove Apple Pencil latency, pressure fidelity, hover, or palm rejection; those need a physical iPad pass.

## Cross-Platform Rendering

Shared postbox, inbox, profile, and detail views should display the backend `finalImageUrl`. PencilKit drawing data is valuable provenance and may enable future editing, but the rendered image stored by the server is the visual contract that keeps web, iOS, and Android seeing the same letter after it is sent.
