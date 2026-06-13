# Caligraphia Android

This is the start of the native Android equivalent of the SwiftUI app.

Current scope:

- Kotlin + Jetpack Compose app shell.
- Native drawing composer using Android touch/stylus `MotionEvent` input.
- Tool palette with standard pen, quill, italic, blackletter, copperplate, brush, watercolor, gold leaf, and illumination modes.
- Photo Picker import for gallery images.
- `ACTION_SEND` image intake so other drawing apps can share an exported image into Caligraphia.
- Share-out for rendered drawings via Android Sharesheet and `FileProvider`.
- Authenticated canvas-letter and photo-letter send through the existing Next API.
- Authenticated Postbox and Inbox list/detail loading with server-proxied artwork.

Local status: Android tooling is installed on this machine and the debug APK builds, installs, launches, draws, opens the Android Sharesheet, and compiles authenticated send paths in the Pixel Tablet emulator.

## Setup

Installed local tooling:

- JDK 17: `/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`
- Android SDK root: `/opt/homebrew/share/android-commandlinetools`
- Gradle wrapper: `./gradlew`, pinned to Gradle 8.10.2
- AVD: `CaligraphiaPixelTablet35`

Useful shell setup:

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

Build:

```sh
cd android
./gradlew :app:assembleDebug
```

Run on the local emulator:

```sh
emulator -avd CaligraphiaPixelTablet35 -no-snapshot-save -no-boot-anim -no-audio
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.caligraphia.mobile/.MainActivity
```

Android Studio can also open the `android/` folder directly and use the same SDK/Gradle wrapper.

## Smoke Test

The current smoke path has been verified on `CaligraphiaPixelTablet35`:

- install and launch `app-debug.apk`,
- draw with `adb shell input touchscreen swipe ...`,
- confirm UI state changes to `Ready to send`,
- tap `Seal`,
- confirm the Android Sharesheet appears,
- loop back through Caligraphia as an `ACTION_SEND image/png` receiver.

## Product Parity Notes

The Android drawing surface is not a one-to-one PencilKit clone. Android has many stylus implementations, so the first parity target is:

- low-latency finger/stylus input,
- pressure-aware strokes when the device reports pressure,
- rendered PNG export,
- gallery import,
- share-in/share-out image flows.
- authenticated send to the same `/api/posts` endpoints used by web and iOS.

Replay/provenance should use the same normalized stroke model as web until Android needs a richer native artifact format. Shared postbox, inbox, profile, and detail views should display the backend `finalImageUrl`, not the local Android renderer, so web, iOS, and Android all see the same sent artwork.
