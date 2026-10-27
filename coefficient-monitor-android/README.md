# Coefficient Monitor (Android)

Monitors the result row of a crash-style game on screen, reads the **newest coefficient** with
on-device OCR, and moves through a user-defined sequence of algorithms:

- coefficient **≤ threshold** (default `2.00x`) → advance exactly one algorithm;
- coefficient **> threshold** → back to Algorithm 1 (stay there if already on it).

It is a monitoring tool only. It never taps, places bets or acts inside other apps. Each round
is independent, and the sequence position does not predict the next result.

## Modules

| Module | What it contains | Needs Android SDK |
| --- | --- | --- |
| `core/` | Pure Kotlin: threshold state machine, OCR text parser, new-round detector, calibration geometry, import/export formats. All rules live here. | No |
| `app/` | Android app: MediaProjection capture service, ML Kit OCR, Room + DataStore, Compose UI, floating panel. | Yes |

`core` is a standalone Gradle build included by the root build (`includeBuild("core")`). You can
test it with plain Maven Central access: `cd core && gradle test`.

### Main classes

- `AlgorithmSequenceEngine` (core): the threshold rule. No length limit and no wrap-around.
- `CoefficientParser` (core): strict OCR text → `1.53x`. Accepts `x`, `X`, `×` and Cyrillic `х`, and
  `.` or `,` as the decimal separator. Rejects partial (`2.0`), malformed, multi-value and
  implausible readings.
- `NewRoundDetector` (core): turns frames into exactly one `RoundEvent` per round.
- `RoundProcessor` (core): applies an event to the stored state. It refuses already-processed
  sequence numbers and builds the event record.
- `ObservationRegionManager` (core): normalised calibration ↔ pixels, plus validation.
- `MonitoringService` / `ScreenCapturer` / `FramePipeline` / `CoefficientOcrEngine` (app): the capture pipeline.
- `MonitorRepository` (app): writes the new position and the event row in **one Room transaction**.
  The `events.sequence` column has a unique index, so the database itself also rejects a round
  that was already processed.

## Where the app looks: the tile right of `?`

```
[ ? ] [ 2.01x ] [ 1.53x ] [ 1.20x ] [ 2.03x ] …
       ^^^^^^^  observed tile (new results appear here)
                ^^^^^^^  neighbour, used only to confirm the row shifted
```

Calibration (Monitor → Calibrate) uses a screenshot of your device:

1. **Capture screen (5 s)** asks for capture consent, waits 5 s so you can switch to the game, and
   takes one frame. Alternatively, **pick a screenshot** you took yourself.
2. **Auto-detect** runs OCR over the whole screenshot. It finds `?` and the coefficient
   immediately to its right and proposes the rectangle. You can also do it by hand: mark `?`,
   then draw, move or resize the rectangle (zoom, pan, ±2 px nudges).
3. **Test OCR** reads the selected tile and its neighbour. **Save** stores the region in normalised
   coordinates together with the screenshot size.

At runtime the region is scaled to the capture size. If the aspect ratio changed (rotation,
split-screen), monitoring stops with "recalibrate" instead of guessing a rectangle.

## How a new round is detected (and processed only once)

Each tick (default 300 ms):

1. Crop the observed tile and its neighbour from the newest frame. Compute small
   brightness-normalised image signatures.
2. If the tile differs from the previous frame it is **moving** (animation, app switch). Nothing is
   read and the candidate value is discarded.
3. On still frames, ML Kit OCR reads the tile. OCR is skipped while the picture is pixel-identical,
   so a static screen costs almost nothing. The reading must be valid, meet the minimum
   confidence, and be identical on **N consecutive still frames** (default 3).
4. The trusted value is compared with the last committed round:
   - **different value** → new round;
   - **same value** → new round only if the row visibly shifted. Either the neighbour tile
     changed (when it showed a different value before), or a short animation happened without
     the screen being replaced in between. Re-reading an unchanged screen never counts, and
     neither does switching to another app and back.
5. A change within the cooldown (default 3 s) after a round counts as a correction, not a new round.
6. The event gets a monotonic sequence number. `MonitorRepository.applyRound` processes it once.

**Continuity check:** after a genuine one-tile shift, the neighbour must show the value that was
newest before. If it does not, for example after you were away from the game, the event is
flagged *possible missed rounds* in the log and on the dashboard. You can then set the active
algorithm by hand.

**Start / resume / restart:** the round already visible is used only as the starting point
(default). The other option is *Process it as a round* in Settings. The value last seen before a
restart is never processed again.

## Algorithms, presets, log

- There is no maximum number of algorithms. **Add several** creates numbered algorithms in bulk.
  Each algorithm has a name, description, enabled flag and ordered steps with optional per-step
  delays (the global delay applies otherwise). Algorithms can be reordered, duplicated, imported
  and exported (JSON).
- The sequence is the ordered list of **enabled** algorithms. Deleting or disabling algorithms
  clamps the position; it never silently resets to 1.
- On the last algorithm, a low coefficient keeps the position and posts "Add another algorithm to
  continue". It never wraps.
- Presets store threshold, detection settings, capture interval, delays, calibration and
  (optionally) the algorithm list. Loading a preset never touches round de-duplication.
- The event log is searchable and exports to JSON or CSV (CSV is protected against spreadsheet
  formula injection). A separate diagnostics log records rejected OCR readings, errors and
  manual actions.

## Step points guide

Each algorithm step can be a **point on the screen** plus the **time until the next point**:

1. In the algorithm editor, tap **+ Step: pick a point on the screen**. The calibration
   screenshot opens; tap where the step should point. Use zoom for precision, and set the time
   in ms. The row being read (shown in red) cannot be chosen, because a marker there would
   disturb detection.
2. After every round, the active algorithm's points are shown **one by one** over the game. Each
   is a numbered circle that stays for its step time; very short times are stretched to 0.7 s so
   they are visible. The floating panel shows "Point 2 of 3 · next in 250 ms", and its **Steps**
   button replays the guide.
3. The markers ignore touches, so you tap the game underneath yourself. **The app never taps,
   places bets or cashes out**: automated actions in a real-money game are out of scope.

Points are normalised to the calibration screenshot. If the screen orientation no longer
matches it, the guide is not shown. The guide can be turned off in Settings.

## Permissions

| Permission | Why |
| --- | --- |
| Screen capture (MediaProjection consent) | Read the tile. Android asks every time monitoring starts. |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PROJECTION` | Continuous capture requires a visible foreground service. |
| `POST_NOTIFICATIONS` | Monitoring status, "add another algorithm", capture stopped. |
| `SYSTEM_ALERT_WINDOW` (optional) | Floating panel and step-point markers; only if granted in system settings. |

The app makes no network requests itself. OCR uses ML Kit's bundled model (no download at runtime)
and runs on the device. Network problems therefore cannot affect detection, so there is no network
monitor.

## Build

```bash
./gradlew :app:assembleDebug        # APK: app/build/outputs/apk/debug/app-debug.apk
./gradlew :core:test                # pure-Kotlin rules (no SDK needed: cd core && gradle test)
./gradlew :app:testDebugUnitTest    # Room/DataStore persistence tests (Robolectric)
```

The repository workflow `.github/workflows/coefficient-monitor-android.yml` runs all three on
GitHub Actions and uploads the debug APK as an artifact.

## Known limitations (need real-device verification)

- The detection thresholds (stillness, same-picture, animation length) are sensible defaults
  tested on synthetic tiles. They are adjustable under Settings → Advanced detection, but have
  not been tuned against the real game on a device.
- If the capture interval is longer than the game's row animation, a round with the same value
  as the previous one is only detected through the neighbour tile. Keep the interval at or below
  300 ms.
- Anything drawn over the observed tile is captured too: notifications, or the floating panel.
  Keep the panel away from the tile row.
- Some Android 14+ devices offer "share one app" for screen capture. Choose the game or the
  entire screen.
