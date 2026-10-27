package app.coefmonitor.e2e

import android.os.SystemClock
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.Until
import app.coefmonitor.R
import app.coefmonitor.core.AlgorithmDefinition
import app.coefmonitor.core.AlgorithmStep
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.NormalizedPoint
import app.coefmonitor.debug.SimulatorActivity
import app.coefmonitor.debug.SimulatorBoard
import app.coefmonitor.e2e.TestEnv.activeAlgorithm
import app.coefmonitor.e2e.TestEnv.app
import app.coefmonitor.e2e.TestEnv.container
import app.coefmonitor.e2e.TestEnv.device
import app.coefmonitor.e2e.TestEnv.log
import app.coefmonitor.e2e.TestEnv.screenshot
import app.coefmonitor.e2e.TestEnv.waitFor
import app.coefmonitor.monitor.FloatingPanelService
import app.coefmonitor.monitor.MonitorStatus
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.math.abs

/**
 * Floating mode on a device, with monitoring stopped: the panel shows over another app, its
 * Run clicks button taps the active algorithm's points there, its tabs change the settings and
 * the active algorithm, and only ✕ closes it.
 */
@RunWith(AndroidJUnit4::class)
@LargeTest
class FloatingModeTest {

    private lateinit var scenario: ActivityScenario<SimulatorActivity>

    @Before
    fun setUp() {
        TestEnv.grantPermissions()
        TestEnv.resetState()
        runBlocking {
            container.algorithms.addNumbered(2, "Algorithm")
            val first = container.database.algorithmDao().getAll()[0]
            container.algorithms.update(
                first.id,
                AlgorithmDefinition(
                    name = first.name,
                    steps = listOf(
                        AlgorithmStep("Bet", delayMs = 1_000, point = NormalizedPoint(0.30f, 0.80f)),
                        AlgorithmStep("Confirm", delayMs = 500, point = NormalizedPoint(0.70f, 0.86f)),
                    ),
                ),
            )
        }
        scenario = ActivityScenario.launch(SimulatorActivity::class.java)
        SystemClock.sleep(1_000)
    }

    @After
    fun tearDown() {
        TestEnv.disableAutoClicker()
        runBlocking { container.settings.update { it.copy(overlayEnabled = false) } }
        scenario.close()
    }

    @Test
    fun panelWorksOverAnotherAppWithoutMonitoring() {
        TestEnv.enableAutoClicker()
        runBlocking { container.settings.update { it.copy(overlayEnabled = true) } }
        FloatingPanelService.sync(app, enabled = true)
        assertNotNull("floating panel not shown", device.wait(Until.findObject(panel().textContains("1 / 2")), 10_000))
        assertEquals("monitoring must not be running", MonitorStatus.STOPPED, TestEnv.runtime().status)
        screenshot("floating_01_status")

        // Run clicks: both points of Algorithm 1 are tapped on the simulator, 1 s apart.
        SimulatorBoard.taps.clear()
        button(R.string.overlay_clicks_button).click()
        val taps = waitFor("two clicks from the floating panel", 15_000) { SimulatorBoard.taps.toList().takeIf { it.size >= 2 } }
        log("clicks from the panel: $taps")
        assertNear("first click", NormalizedPoint(0.30f, 0.80f), taps[0].point)
        assertNear("second click", NormalizedPoint(0.70f, 0.86f), taps[1].point)
        val interval = taps[1].atMs - taps[0].atMs
        assertTrue("time between the clicks was $interval ms, expected about 1000 ms", interval in 800L..2_000L)
        waitFor("click run to finish", 10_000) { (TestEnv.runtime().clicks == null).takeIf { it } }

        // Settings tab: the first + raises the threshold by 0.01x.
        button(R.string.overlay_tab_settings).click()
        device.wait(Until.findObject(panel().text("+")), 5_000).click()
        waitFor("threshold 2.01x", 5_000) { runBlocking { container.settings.current().threshold }.takeIf { it == Coefficient(201) } }
        screenshot("floating_02_settings")

        // Algorithm tab: ▶ makes Algorithm 2 active.
        button(R.string.overlay_tab_algorithm).click()
        device.wait(Until.findObject(panel().text("▶")), 5_000).click()
        waitFor("Algorithm 2 active", 5_000) { activeAlgorithm().takeIf { it == 2 } }
        assertNotNull("panel does not show Algorithm 2", device.wait(Until.findObject(panel().textContains("2 / 2")), 5_000))
        screenshot("floating_03_algorithm")

        // The panel stays while another app is used; only ✕ closes it and turns floating mode off.
        SystemClock.sleep(3_000)
        assertNotNull("panel disappeared", device.findObject(panel().text("✕")))
        device.findObject(panel().text("✕")).click()
        waitFor("floating mode off", 5_000) { runBlocking { container.settings.current().overlayEnabled }.takeIf { !it } }
        assertTrue("panel still shown", device.wait(Until.gone(panel().text("✕")), 5_000))
    }

    private fun panel() = By.pkg(TestEnv.PACKAGE)

    private fun button(label: Int): UiObject2 =
        device.wait(Until.findObject(panel().text(app.getString(label))), 5_000) ?: error("button \"${app.getString(label)}\" not found")

    private fun assertNear(what: String, expected: NormalizedPoint, actual: NormalizedPoint) {
        assertTrue("$what at $actual, expected $expected", abs(expected.x - actual.x) < 0.01f && abs(expected.y - actual.y) < 0.01f)
    }
}
