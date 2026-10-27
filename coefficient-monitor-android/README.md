# Coefficient Monitor (Android)

Monitors the result row of a crash-style game on screen, reads the **newest coefficient** with
on-device OCR, and moves through a user-defined sequence of algorithms:

- coefficient **≤ threshold** (default `2.00x`) → advance exactly one algorithm;
- coefficient **> threshold** → back to Algorithm 1 (stay there if already on it).

After every round the **auto-clicker** taps the points saved in the now active algorithm, one by
one, with the step times in between (see [Auto-clicker](#auto-clicker)). Each round is
independent, and the sequence position does not predict the next result.

## Modules

| Module | What it contains | Needs Android SDK |
| --- | --- | --- |
| `core/` | Pure Kotlin: threshold state machine, OCR text parser, new-round detector, row locator, import/export formats. All rules live here. | No |
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
- `RowLocator` (core): finds the result row among the words OCR read on the screen.
- `MonitoringService` / `ScreenCapturer` / `RowTracker` / `CoefficientOcrEngine` (app): the capture pipeline.
- `ClickPlan` (core) / `AutoClicker` / `AutoClickController` / `AutoClickService` (app): the
  auto-clicker. The plan lists the steps with their times; `AutoClicker` (one per app, used by
  monitoring and the floating panel) checks the service and skips taps on the row being read; the controller runs
  the steps one after another; the accessibility service performs the taps.
- `FloatingPanelService` / `OverlayController` (app): floating mode, see [Floating mode](#floating-mode).
- `MonitorRepository` (app): writes the new position and the event row in **one Room transaction**.
  The `events.sequence` column has a unique index, so the database itself also rejects a round
  that was already processed.

## Where the app looks: the tile right of `?`

```
[ ? ] [ 2.01x ] [ 1.53x ] [ 1.20x ] [ 2.03x ] …
       ^^^^^^^  newest tile (new results appear here)
                ^^^^^^^  neighbour: confirms the row shifted, and shows a round that was missed
```

There is nothing to set up: monitoring finds the row on the live screen by itself. ML Kit reads
every word on the screen; the row is `?` followed by coefficients on one line, and the newest
tile is the first slot right of `?` (even when its value is not read in that frame). If `?` is not
recognised, a run of at least three evenly spaced coefficients counts. Single values elsewhere
(the game's big multiplier, a bet field, the floating panel's *Last: 17.35x*) never form a row,
and a value whose `x` was not read still shows where the row is.

Once found, the row is followed: OCR reads only a full-width strip around it each tick, and the
screen where it was found is kept for picking click points in the app. The dashboard shows where
the row is (*Observation region*), and **Find row** (dashboard or panel) looks for it on the whole
screen again at once.

## How a new round is detected (and processed only once)

Each tick (default 300 ms):

1. Crop the newest tile and its neighbour from the newest frame. Compute small
   brightness-normalised image signatures.
2. If the tile differs from the previous frame it is **moving** (a tile sliding in, an app
   switch). For the first 0.5 s of motion nothing is read.
3. ML Kit OCR reads the strip around the row; the values are the words inside the two tiles. OCR
   is skipped while the strip and both tiles are pixel-identical, so a static screen costs almost
   nothing. As when reading by eye, the text decides: the reading must be valid, meet the minimum
   confidence, and be the same **N times in a row** (default 3), readings taken while the tile
   still settles included. Nothing is decided while a tile slides in; the first still frame
   decides. A tile whose picture never stops changing (an animated tile) is decided on after
   2.5 s of motion.
4. The trusted value is compared with the last committed round:
   - **different value** → new round;
   - **same value** → new round only if the row visibly shifted. Either the neighbour tile
     changed (when it showed a different value before), or a short animation happened without
     the screen being replaced in between. Re-reading an unchanged screen never counts, and
     neither does switching to another app and back.
5. A change within the cooldown (default 3 s) after a round counts as a correction, not a new round.
6. The event gets a monotonic sequence number. `MonitorRepository.applyRound` processes it once.

**Continuity check and missed rounds:** besides the newest tile, the neighbour tile (the round
before it) is read too. After a genuine one-tile shift the neighbour must show the value that was
newest before. If it shows another valid value and the neighbour tile visibly changed, that value
is a round that was missed: it is processed first (log: *missed round, read from the previous
tile*; no clicks, its round is over), then the newest one. Rounds missed before that one cannot be
seen with two tiles; if the screen was away or covered meanwhile, the missed round is flagged
*possible missed rounds* in the log and on the dashboard, and you can set the active algorithm by
hand.

**Start / resume / restart:** the round already visible is used only as the starting point
(default). The other option is *Process it as a round* in Settings. The value last seen before a
restart is never processed again.

## Finding the row again

When the game is scrolled, the row moves with it. As long as it stays inside the strip, the next
tick finds it at its new place; otherwise the whole screen is read in the same tick (and every
0.7 s while it is not found), so the row is found again as soon as it is back, wherever it is.
While the row is at the same height it stays put: a newest tile that was not read in one frame,
or a row partly covered by the floating panel, does not move it. A move is followed only when two
looks in a row agree, so a glimpse in the middle of an animation never moves the row.

When the row was found at another place, the detector catches up: if the newest tile still shows
the value seen before, nothing was missed; if it shows another one and the neighbour shows the
value seen before, the newest is the one missed round; if the neighbour is new too, both are
processed (neighbour first) and flagged, since more may be missing. If the neighbour cannot be
read, the newest is processed and the gap is flagged.

## Algorithms, presets, log

- There is no maximum number of algorithms. **Add several** creates numbered algorithms in bulk.
  Each algorithm has a name, description, enabled flag and ordered steps with optional per-step
  delays (the global delay applies otherwise). Algorithms can be reordered, duplicated, imported
  and exported (JSON).
- The sequence is the ordered list of **enabled** algorithms. Deleting or disabling algorithms
  clamps the position; it never silently resets to 1.
- On the last algorithm, a low coefficient keeps the position and posts "Add another algorithm to
  continue". It never wraps.
- Presets store threshold, detection settings, capture interval, delays and (optionally) the
  algorithm list. Loading a preset never touches round de-duplication.
- The event log is searchable and exports to JSON or CSV (CSV is protected against spreadsheet
  formula injection). A separate diagnostics log records rejected OCR readings, errors and
  manual actions.

## Auto-clicker

Each algorithm step is a **click on a point of the screen** plus the **time until the next
click**:

1. In the algorithm editor, tap **+ Click: pick a point on the screen**. The screen saved when
   monitoring last found the row opens (start monitoring once with the game open); tap where the click should land or drag the marker, then **Use this point**. Use zoom for
   precision, and set the time in ms (empty = the global delay). Add as many clicks as you need
   and **Save**. The row being read (shown in red) cannot be chosen, because a popup opened by a
   tap there would hide the coefficient. Clicks can also be added and picked right on the live screen from
   the floating panel's Algorithm tab.
2. **+ Pause (no click)** adds a step that only waits its time, e.g. before the first click while
   the game gets ready for the next round.
3. Turn the service on once: Settings → *Auto-clicker* → **Turn on in Accessibility settings**, and
   enable "Coefficient Monitor: auto-clicker". On Android 13 and newer an APK installed from a file
   is blocked there at first ("restricted setting"): open App info → ⋮ → *Allow restricted
   settings*, then enable it.
4. After every round the active algorithm's clicks run **one after another**: tap step 1, wait its
   time (counted from the start of the tap), tap step 2, and so on. The floating panel shows
   "Auto-click: step 2 of 3 · next in 250 ms", and its **Run clicks** button runs the active
   algorithm's clicks right away, over any app and also while monitoring is stopped. A new run,
   a new round, **Stop clicks**, **Pause** and **Stop** cancel a run in progress.

Points are normalised to the screen and scaled to the current screen. Taps on the row being read
right now are skipped (the step still waits its time). Every run is logged there too ("Algorithm 2: 3 click(s) performed"), as are taps that
Android cancelled (for example because you touched the screen at the same moment). A tap lands on
whatever is on screen at that moment, so keep the game in front while monitoring runs. The
auto-clicker can be turned off in Settings without touching the accessibility service.

## Floating mode

Settings → **Floating mode** puts a movable panel over every app. It stays there until you close it
with **✕** (or the notification's *Close*), whether monitoring runs or not; it runs in its own
foreground service, so Android does not remove it when you switch apps or swipe the app away.
Drag it by the title. **–** (top right) shrinks it to a small circle showing the active
algorithm's number (coloured by state: running, paused, stopped, clicking); drag the circle anywhere
and tap it to open the panel again. It has three tabs, each row on one line:

- **Status**: active algorithm, last coefficient, monitoring and OCR status, auto-click progress,
  warnings, the last log lines, and the buttons **Start** (shows Android's screen-capture dialog
  and starts monitoring without opening the app) or **Pause**/**Resume**, **Stop** and **Find row**
  (see [Finding the row again](#finding-the-row-again)), **Run clicks**/**Stop clicks**, and
  **Open** (the app).
- **Algorithm**: ◀ ▶ show any algorithm without changing the active one (✓ marks the active one);
  **Make active**, **↺ 1** (back to Algorithm 1) and **+ Algorithm**. Every step is one line: its
  time until the next click (− / +, 50 ms per press), **◎** to pick its point again and **✕** to
  delete it. **+ Click** and **+ Pause** add steps. Points are picked right on the screen over the
  game: the panel hides, a tap puts the marker, dragging moves it (a drag that starts on the marker
  keeps its offset so the finger does not cover the point), then **Use this point**. The row
  being read (red) cannot be chosen.
- **Settings**: threshold (± 0.01x), global delay and capture interval (± 50 ms), stable frames,
  minimum time between rounds (± 250 ms), the auto-clicker and round-notification switches, and
  a shortcut to the Accessibility settings while the auto-clicker service is off.

Hold − or + to repeat. Every change is saved at once, exactly as if it was made in the app.
Changing detection settings while monitoring runs re-initialises the detector (the visible round
is not processed).

## Design

Minimal on purpose: graphite (dark) or paper (light) surfaces separated by hairlines, one soft
violet accent, outlined icons and the Inter typeface (bundled in `app/src/main/res/font`, subset to
Latin and Cyrillic; SIL Open Font License, see `licenses/Inter-OFL.txt`). Screens carry short
labels only. A tiny **!** next to a label opens a small bubble with the full explanation; tapping
anywhere closes it. The floating panel uses the same palette, font and pill-shaped buttons, with a
segmented control for its tabs.

## Permissions

| Permission | Why |
| --- | --- |
| Screen capture (MediaProjection consent) | Read the tile. Android asks every time monitoring starts. |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PROJECTION` | Continuous capture requires a visible foreground service. |
| `POST_NOTIFICATIONS` | Monitoring status, "add another algorithm", capture stopped. |
| `SYSTEM_ALERT_WINDOW` (optional) | Floating panel; only if granted in system settings. |
| `FOREGROUND_SERVICE_SPECIAL_USE` | Keeps the floating panel's service running while floating mode is on (with its own notification). |
| Accessibility service "auto-clicker" (optional) | Performing the clicks; only if turned on in Accessibility settings. It reads no screen content and receives no accessibility events. |

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
  Keep the panel away from the tile row, and away from the click points (a click there lands on
  the panel).
- The clicks follow the detected rounds. If a round is missed or misread, the active algorithm
  and therefore the clicks are wrong until you correct the position. Try the setup on a demo or
  minimum stake first, and watch the diagnostics log.
- Some Android 14+ devices offer "share one app" for screen capture. Choose the game or the
  entire screen.
