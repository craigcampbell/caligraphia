# Web, iOS, and Android Feature Parity Process

Caligraphia now has three client surfaces: the existing Next web app, a native SwiftUI iOS app, and a native Kotlin/Jetpack Compose Android app. The product rule is simple: a feature is not product-complete until parity is resolved across the platforms where it is meant to ship.

Parity does not mean identical UI. It means each client satisfies the same user promise, data contract, privacy behavior, and acceptance criteria. Native iOS and Android can use platform-specific interaction patterns when the variance is documented.

## Files

- `docs/parity/TRACKER.md`: canonical feature parity ledger.
- `docs/parity/API_CONTRACT.md`: shared API expectations that both clients rely on.
- `docs/parity/SCHEMA_CONTRACT.md`: Prisma/domain model notes that matter to clients.
- `docs/native-ios/IMPLEMENTATION.md`: native architecture and migration plan.
- `docs/native-ios/KANBAN.md`: execution board for native work.
- `docs/android/IMPLEMENTATION.md`: Android architecture, tooling, and parity plan.
- `docs/0613.md`: dated all-platform work ledger for the current mobile parity push.

## Status Values

Web status:

- `missing`: no web implementation.
- `partial`: visible but incomplete or known broken.
- `live`: implemented and usable.
- `changing`: actively being modified.

Native platform status:

- `not started`
- `planned`
- `in progress`
- `implemented`
- `verified`

Parity status:

- `in parity`: both clients meet the same criteria.
- `acceptable variance`: clients differ intentionally, with a documented reason.
- `behind`: one client is missing or incomplete.
- `blocked`: parity cannot proceed until a contract, security, or product decision lands.
- `web only`: explicitly web-only.
- `ios only`: explicitly iOS-only.
- `android only`: explicitly Android-only.
- `deferred`: intentionally postponed.

## Update Checklist

Before implementing a feature or changing behavior:

1. Add or update the row in `TRACKER.md`.
2. Classify the change as `shared`, `web only`, `ios only`, `android only`, or `acceptable variance`.
3. If it touches `src/app/api` or `prisma/schema.prisma`, update `API_CONTRACT.md` or `SCHEMA_CONTRACT.md`.
4. Add acceptance criteria for every affected client.
5. Create or link the matching iOS and Android kanban items when native work is affected.

During review:

- Web route/component updated?
- API/schema contract updated?
- iOS impact labeled?
- Android impact labeled?
- Native UX variance documented?
- Tests, simulator proof, screenshots, or manual evidence listed?

After merge:

- Move the row to `Ready For iOS`, `Parity QA`, `Parity Complete`, `Deferred`, or `Blocked`.
- Update `Last Reviewed`.

## Weekly Parity Pass

Spend 20 minutes each week on:

- Rows where `Web Status = changing`.
- API/schema changes since the last pass.
- Stale `behind` rows that need scheduling, explicit deferral, or a blocker.
- Native variances that have become product problems.
