# Caligraphia Android Implementation

Last updated: 2026-06-13

## Goal

Build a native Android app that tracks the same parity ledger as web and iOS while respecting Android's own drawing and sharing model.

## Current Scaffold

Path: `android/`

- Kotlin + Jetpack Compose app shell.
- Native drawing composer based on `MotionEvent` input, including pressure when reported by the device.
- Photo Picker import.
- Share-in support for `ACTION_SEND image/*`.
- Share-out support through Android Sharesheet with `FileProvider`.
- Cookie-backed dev auth panel for magic-link request/verify.
- Postbox and Inbox tabs that load authenticated post DTOs and display proxied artwork.
- Basic read-only detail for Postbox/Inbox rows through `GET /api/posts/:id`.
- Authenticated canvas post submission through JSON `POST /api/posts`.
- Authenticated imported/shared photo submission through multipart `POST /api/posts`.
- Shared post DTOs and portable canvas payload helpers.

## Tooling Status

Installed and verified locally:

- JDK 17 via Homebrew.
- Android SDK command-line tools.
- `platform-tools`, `platforms;android-35`, `build-tools;35.0.0`, `emulator`, and `system-images;android-35;google_apis;arm64-v8a`.
- Gradle wrapper pinned to Gradle 8.10.2.
- Pixel Tablet API 35 AVD named `CaligraphiaPixelTablet35`.

Verified command:

```sh
cd android
./gradlew :app:assembleDebug
```

The debug APK installs and launches on `CaligraphiaPixelTablet35`. A smoke gesture against the drawing surface changes the composer to `Ready to send`, and `Seal` opens Android Sharesheet. The app now also builds with authenticated canvas/photo send actions wired; physical-device stylus and network end-to-end send testing remain open.

## Sharing Difficulty

- Share out a rendered letter PNG: small.
- Import from the Android Photo Picker: small.
- Receive images from other drawing apps via `ACTION_SEND image/*`: small to medium; the manifest and first intake path are scaffolded.
- Rich direct share targets to specific Caligraphia recipients: medium; requires shortcuts/direct-share metadata and authenticated recipient routing.
- Preserving layered drawing data from third-party apps: hard and app-specific. Most apps share flattened PNG/JPEG/PDF, not editable stroke data.

## First Android Parity Target

1. Draw with finger/stylus and produce a rendered PNG.
2. Preserve normalized stroke provenance compatible with the web model.
3. Import gallery/shared images as photo letters.
4. Share exported letters to other apps.
5. Wire auth and post submission to the existing backend.

Status: auth, Postbox/Inbox loading, read-only detail, canvas post submission, and photo-letter submission are wired for the Android dev client. Remaining Android parity work is detail actions, recipient-aware ComposeFlow contexts, direct-share recipient shortcuts, and physical stylus/phone smoke testing.

References:

- Android Photo Picker: https://developer.android.com/training/data-storage/shared/photo-picker
- Android Sharesheet/ACTION_SEND: https://developer.android.com/training/sharing/send
- Receiving shared data: https://developer.android.com/training/sharing/receive
- Compose graphics/drawing: https://developer.android.com/develop/ui/compose/graphics/draw/overview
