package app.coefmonitor.e2e

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.os.SystemClock
import android.view.View
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import app.coefmonitor.core.AlgorithmDefinition
import app.coefmonitor.core.AlgorithmStep
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.Continuity
import app.coefmonitor.core.DetectionReason
import app.coefmonitor.core.ImageSignature
import app.coefmonitor.core.NormalizedPoint
import app.coefmonitor.core.NormalizedRect
import app.coefmonitor.core.OcrReading
import app.coefmonitor.core.RowLocator
import app.coefmonitor.core.TransitionType
import app.coefmonitor.debug.SimulatorActivity
import app.coefmonitor.debug.SimulatorBoard
import app.coefmonitor.e2e.TestEnv.activeAlgorithm
import app.coefmonitor.e2e.TestEnv.app
import app.coefmonitor.e2e.TestEnv.awaitEventCount
import app.coefmonitor.e2e.TestEnv.awaitStatus
import app.coefmonitor.e2e.TestEnv.container
import app.coefmonitor.e2e.TestEnv.device
import app.coefmonitor.e2e.TestEnv.eventCount
import app.coefmonitor.e2e.TestEnv.failureContext
import app.coefmonitor.e2e.TestEnv.instrumentation
import app.coefmonitor.e2e.TestEnv.log
import app.coefmonitor.e2e.TestEnv.screenshot
import app.coefmonitor.e2e.TestEnv.waitFor
import app.coefmonitor.monitor.CoefficientOcrEngine
import app.coefmonitor.monitor.MonitorStatus
import app.coefmonitor.monitor.MonitoringService
import app.coefmonitor.ui.MainActivity
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.abs

/**
 * Whole app on a device: real MediaProjection capture of the simulator screen → real ML Kit OCR
 * finds the row by itself and follows it → round detection → Room transaction → dashboard/overlay.
 */
@RunWith(AndroidJUnit4::class)
@LargeTest
class EndToEndMonitoringTest {

    private lateinit var scenario: ActivityScenario<SimulatorActivity>

    @Before
    fun setUp() {
        TestEnv.grantPermissions()
        TestEnv.resetState()
        runBlocking { container.algorithms.addNumbered(ALGORITHMS, "Algorithm") }
        scenario = ActivityScenario.launch(SimulatorActivity::class.java)
        onSimulator { it.board.setHistory(listOf("3.33x", "1.11x", "2.45x", "1.07x")) }
        SystemClock.sleep(1_000)
    }

    @After
    fun tearDown() {
        TestEnv.stopMonitoring()
        TestEnv.disableAutoClicker()
        log("final state\n${failureContext()}")
        scenario.close()
    }

    private fun <T> onSimulator(block: (SimulatorActivity) -> T): T {
        val result = AtomicReference<T>()
        instrumentation.runOnMainSync {
            val activity = SimulatorActivity.current?.get() ?: error("simulator not resumed")
            result.set(block(activity))
        }
        return result.get()
    }

    private fun push(value: String) {
        log("push $value")
        onSimulator { it.board.push(value) }
    }

    /** Requests capture consent from the simulator and starts monitoring. */
    private fun startCapture() {
        val delivered = AtomicReference<Int?>(null)
        onSimulator { activity ->
            activity.requestCapture { code, data ->
                delivered.set(code)
                if (code == Activity.RESULT_OK && data != null) MonitoringService.start(activity, code, data)
            }
        }
        waitFor("screen-capture consent", 20_000) {
            TestEnv.acceptCaptureDialogIfShown()
            delivered.get()
        }
        assertEquals("consent result", Activity.RESULT_OK, delivered.get())
    }

    /** After the first round (→ Algorithm 2) its two points must be tapped on the simulator in order, 1.5 s apart. */
    private fun assertAlgorithm2Clicked() {
        var screenshotTaken = false
        val taps = waitFor("two auto-clicks on the simulator", 15_000) {
            val progress = TestEnv.runtime().clicks
            if (progress != null && !screenshotTaken) {
                assertEquals(2, progress.algorithmNumber)
                screenshot("e2e_01b_auto_click_running")
                screenshotTaken = true
            }
            SimulatorBoard.taps.toList().takeIf { it.size >= 2 }
        }
        log("auto-clicks seen: $taps")
        assertNear("first click", NormalizedPoint(0.30f, 0.80f), taps[0].point)
        assertNear("second click", NormalizedPoint(0.70f, 0.86f), taps[1].point)
        val interval = taps[1].atMs - taps[0].atMs
        assertTrue("time between the clicks was $interval ms, expected about 1500 ms", interval in 1_300L..2_500L)
        waitFor("auto-click run to finish", 10_000) { (TestEnv.runtime().clicks == null).takeIf { it } }
        assertEquals("only the two clicks of Algorithm 2", 2, SimulatorBoard.taps.size)
        assertEquals("the clicks must not create rounds", 1, eventCount())
    }

    private fun assertNear(what: String, expected: NormalizedPoint, actual: NormalizedPoint) {
        assertTrue("$what at $actual, expected $expected", abs(expected.x - actual.x) < 0.01f && abs(expected.y - actual.y) < 0.01f)
    }

    /** Next round may only arrive after the detector's cooldown (default 3 s), as in the real game. */
    private fun waitCooldown() = SystemClock.sleep(3_400)

    @Test
    fun findsTheRowOnTheSimulatorScreen() {
        val screen = screen()
        screenshot("e2e_00_simulator")
        val expectedTile = onSimulator { it.tileBounds(0) }
        val words = runBlocking { CoefficientOcrEngine().use { it.readWords(screen) } }
        log("words on the simulator: ${words.joinToString { "${it.text}@${it.left},${it.top}" }}; image=${screen.width}x${screen.height}")
        val cells = RowLocator.locate(words, screen.width, screen.height)
        assertTrue("row not found", cells != null)
        cells!!
        log("row found: $cells; expected newest tile $expectedTile")
        val centerX = (cells.newest.left + cells.newest.width / 2f) / screen.width
        val centerY = (cells.newest.top + cells.newest.height / 2f) / screen.height
        assertTrue("newest cell outside the first result tile", contains(expectedTile, centerX, centerY))
        assertEquals(Coefficient(333), (cells.readNewest(words) as OcrReading.Valid).value)
        assertEquals(Coefficient(111), (cells.readNeighbor(words) as OcrReading.Valid).value)
    }

    @Test
    fun fullMonitoringSession() {
        runBlocking {
            container.settings.update { it.copy(overlayEnabled = true, autoClickEnabled = true) }
            // Algorithm 2 has two click steps; the auto-clicker must tap them one after another.
            val second = container.database.algorithmDao().getAll()[1]
            container.algorithms.update(
                second.id,
                AlgorithmDefinition(
                    name = second.name,
                    steps = listOf(
                        AlgorithmStep("Bet", delayMs = 1_500, point = NormalizedPoint(0.30f, 0.80f)),
                        AlgorithmStep("Confirm", delayMs = 1_200, point = NormalizedPoint(0.70f, 0.86f)),
                    ),
                ),
            )
        }

        TestEnv.enableAutoClicker()

        // Start: the row is found without any setup; the visible 3.33x only initialises the detector.
        startCapture()
        awaitStatus(MonitorStatus.MONITORING, timeoutMs = FIRST_READ_TIMEOUT_MS)
        SystemClock.sleep(2_000)
        assertEquals("visible round must not be processed at start", 0, eventCount())
        screenshot("e2e_01_monitoring_started")

        // Specification example.
        val values = listOf("1.70x", "1.60x", "1.20x", "2.10x", "2.30x", "1.50x", "1.70x", "1.90x", "2.50x")
        val expected = listOf(2, 3, 4, 1, 1, 2, 3, 4, 1)
        SimulatorBoard.taps.clear()
        values.forEachIndexed { i, value ->
            push(value)
            awaitEventCount(i + 1)
            assertEquals("after $value\n${failureContext()}", expected[i], activeAlgorithm())
            if (i == 0) assertAlgorithm2Clicked()
            if (i == 3) screenshot("e2e_02_after_reset_2_10x")
            waitCooldown()
        }

        // Equal values in separate rounds: 1.50x three times (the third time the neighbour is also 1.50x).
        listOf(2, 3, 4).forEachIndexed { i, expectedActive ->
            push("1.50x")
            awaitEventCount(values.size + i + 1)
            assertEquals("equal value round ${i + 1}\n${failureContext()}", expectedActive, activeAlgorithm())
            waitCooldown()
        }
        var events = values.size + 3

        // Floating panel shows the live position.
        assertTrue(
            "floating panel does not show Algorithm 4 / $ALGORITHMS",
            device.wait(Until.hasObject(By.pkg(TestEnv.PACKAGE).textContains("4 / $ALGORITHMS")), 5_000),
        )
        screenshot("e2e_03_overlay_algorithm_4")

        // Idle screen re-read for 8 s: no duplicate events.
        SystemClock.sleep(8_000)
        assertEquals("idle frames must not create rounds\n${failureContext()}", events, eventCount())

        // Switching to another app and back is not a round.
        device.pressHome()
        SystemClock.sleep(4_000)
        app.startActivity(
            Intent(app, SimulatorActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT),
        )
        SystemClock.sleep(6_000)
        assertEquals("app switch must not create rounds\n${failureContext()}", events, eventCount())

        // Pause: rounds are ignored; after resume the visible value only re-initialises.
        MonitoringService.command(app, MonitoringService.ACTION_PAUSE)
        awaitStatus(MonitorStatus.PAUSED)
        push("1.30x")
        SystemClock.sleep(4_000)
        assertEquals("paused monitor must not process", events, eventCount())
        MonitoringService.command(app, MonitoringService.ACTION_RESUME)
        awaitStatus(MonitorStatus.MONITORING, timeoutMs = FIRST_READ_TIMEOUT_MS)
        SystemClock.sleep(3_000)
        assertEquals("round shown during pause must not be processed after resume", events, eventCount())
        push("2.80x")
        awaitEventCount(++events)
        assertEquals("2.80x resets to Algorithm 1", 1, activeAlgorithm())
        waitCooldown()

        // Stop and start a new session: the round on screen is not replayed.
        MonitoringService.command(app, MonitoringService.ACTION_STOP)
        awaitStatus(MonitorStatus.STOPPED)
        startCapture()
        awaitStatus(MonitorStatus.MONITORING, timeoutMs = FIRST_READ_TIMEOUT_MS)
        SystemClock.sleep(4_000)
        assertEquals("restart must not replay the visible round\n${failureContext()}", events, eventCount())
        push("1.40x")
        awaitEventCount(++events)
        assertEquals(2, activeAlgorithm())
        screenshot("e2e_04_after_restart")

        // Event log integrity: one record per round, contiguous ids, transitions match positions.
        val records = runBlocking { container.events.allRecords() }
        records.forEach { log("record ${it.roundId} ${it.summary()} [${it.detectionReason}, ${it.continuity}, ocr=${it.ocrConfidence}]") }
        assertEquals(events, records.size)
        assertEquals((1L..events.toLong()).toList(), records.map { it.sequence })
        records.zipWithNext().forEach { (a, b) -> assertEquals("chain ${a.roundId}->${b.roundId}", a.newAlgorithm, b.previousAlgorithm) }
        assertEquals(TransitionType.RESET_TO_FIRST, records[3].transitionType)
        assertEquals(TransitionType.NO_POSITION_CHANGE, records[4].transitionType)
        assertTrue("unexpected gap warnings", records.none { it.continuity == Continuity.GAP_SUSPECTED })
        assertEquals(
            listOf(170L, 160L, 120L, 210L, 230L, 150L, 170L, 190L, 250L, 150L, 150L, 150L, 280L, 140L),
            records.map { it.coefficientHundredths },
        )

        TestEnv.stopMonitoring()
        val dashboard = ActivityScenario.launch(MainActivity::class.java)
        SystemClock.sleep(2_000)
        screenshot("e2e_05_dashboard_after_session")
        device.findObject(By.text("Log"))?.click()
        SystemClock.sleep(1_500)
        screenshot("e2e_06_event_log")
        dashboard.close()
    }

    @Test
    fun findsTheRowAgainAfterTheGameMoved() {
        startCapture()
        awaitStatus(MonitorStatus.MONITORING, timeoutMs = FIRST_READ_TIMEOUT_MS)
        val before = waitFor("row found", 10_000) { TestEnv.runtime().rowBand }

        // The game is scrolled away while two rounds end, and does not come back to exactly the
        // same place: the row is now 60 dp lower.
        onSimulator { it.board.visibility = View.INVISIBLE }
        SystemClock.sleep(1_500)
        push("1.70x")
        SystemClock.sleep(800)
        push("1.20x")
        SystemClock.sleep(1_000)
        onSimulator {
            it.board.translationY = 60 * it.resources.displayMetrics.density
            it.board.visibility = View.VISIBLE
        }
        val moved = waitFor("row found at its new place", 30_000) { TestEnv.runtime().rowBand?.takeIf { it.top > before.top + 0.01f } }
        log("row moved from $before to $moved")

        // Both rounds are counted in order: the newest from its tile, the one before from the neighbour.
        awaitEventCount(2)
        val records = runBlocking { container.events.allRecords() }.sortedBy { it.sequence }
        assertEquals("rounds after the row was found again\n${failureContext()}", listOf(170L, 120L), records.map { it.coefficientHundredths })
        assertEquals("after 1.70x and 1.20x\n${failureContext()}", 3, activeAlgorithm())
        // Both ended out of view: they count, but their clicks are not run.
        assertEquals(listOf(DetectionReason.MISSED_ROUND_NEIGHBOR, DetectionReason.SEEN_LATE), records.map { it.detectionReason })
        screenshot("e2e_07_row_found_again")

        // Monitoring goes on by itself: the next round is read at the new place.
        waitCooldown()
        push("2.50x")
        awaitEventCount(3)
        assertEquals("after 2.50x\n${failureContext()}", 1, activeAlgorithm())
        val live = runBlocking { container.events.allRecords() }.maxBy { it.sequence }
        assertEquals("the next round is seen live again", DetectionReason.VALUE_CHANGED, live.detectionReason)
    }

    @Test
    fun staticTileSignatureIsStableAcrossFrames() {
        // Two pictures of an unchanged tile must look identical to the detector (no false motion).
        val tile = onSimulator { it.tileBounds(0) }
        val first = screen()
        SystemClock.sleep(300)
        val second = screen()
        fun signature(bitmap: Bitmap): ImageSignature {
            val left = (tile.left * bitmap.width).toInt()
            val top = (tile.top * bitmap.height).toInt()
            val width = (tile.width * bitmap.width).toInt()
            val height = (tile.height * bitmap.height).toInt()
            val pixels = IntArray(width * height)
            bitmap.getPixels(pixels, 0, width, left, top, width, height)
            return ImageSignature.fromArgb(pixels, width, height)
        }
        val similarity = signature(first).similarity(signature(second))
        log("static tile similarity between captures = $similarity")
        assertTrue("static tile similarity $similarity", similarity >= 0.985f)
    }

    /** The whole display, as monitoring captures it. */
    private fun screen(): Bitmap {
        val shot = instrumentation.uiAutomation.takeScreenshot() ?: error("screenshot failed")
        // Screenshots can be hardware bitmaps, whose pixels cannot be read directly.
        return shot.copy(Bitmap.Config.ARGB_8888, false)
    }

    private fun contains(rect: NormalizedRect, x: Float, y: Float) = x in rect.left..rect.right && y in rect.top..rect.bottom

    private companion object {
        const val ALGORITHMS = 25

        /** Emulators without a GPU run OCR far slower than phones; the first read includes model loading. */
        const val FIRST_READ_TIMEOUT_MS = 120_000L
    }
}
