package app.coefmonitor.e2e

import android.os.Build
import android.os.SystemClock
import android.util.Log
import androidx.test.core.app.ApplicationProvider
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import app.coefmonitor.AppContainer
import app.coefmonitor.CoefMonitorApp
import app.coefmonitor.data.AppSettings
import app.coefmonitor.monitor.MonitorStatus
import app.coefmonitor.monitor.MonitoringService
import app.coefmonitor.monitor.RuntimeState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.junit.Assert.fail
import java.util.regex.Pattern

/** Shared helpers for instrumented tests (shell, screenshots, waiting, state reset). */
object TestEnv {
    const val PACKAGE = "app.coefmonitor"
    const val TAG = "CoefMonitorTest"
    private const val SHOT_DIR = "/sdcard/Download/coefmonitor"

    val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    val app: CoefMonitorApp get() = ApplicationProvider.getApplicationContext()
    val container: AppContainer get() = app.container
    val device: UiDevice get() = UiDevice.getInstance(instrumentation)

    fun log(message: String) {
        Log.i(TAG, message)
    }

    fun shell(command: String): String = device.executeShellCommand(command)

    /** Lets the app capture the screen and draw its panel without interactive dialogs. */
    fun grantPermissions() {
        shell("appops set $PACKAGE PROJECT_MEDIA allow")
        shell("appops set $PACKAGE SYSTEM_ALERT_WINDOW allow")
        if (Build.VERSION.SDK_INT >= 33) shell("pm grant $PACKAGE android.permission.POST_NOTIFICATIONS")
    }

    /** Full-screen PNG written by the shell user so it survives the app being uninstalled. */
    fun screenshot(name: String) {
        shell("mkdir -p $SHOT_DIR")
        shell("screencap -p $SHOT_DIR/api${Build.VERSION.SDK_INT}_$name.png")
        log("screenshot $name")
    }

    fun runtime(): RuntimeState = container.runtime.state.value

    fun stopMonitoring() {
        val state = runtime()
        if (!state.captureActive && state.status != MonitorStatus.MONITORING && state.status != MonitorStatus.PAUSED) return
        runCatching { MonitoringService.command(app, MonitoringService.ACTION_STOP) }
        waitFor("monitoring to stop", 15_000) { (!runtime().captureActive).takeIf { it } }
    }

    fun resetState() = runBlocking {
        stopMonitoring()
        withContext(Dispatchers.IO) { container.database.clearAllTables() }
        container.settings.update { AppSettings() }
        container.runtime.update { RuntimeState() }
    }

    fun eventCount(): Int = runBlocking { container.events.count.first() }

    fun activeAlgorithm(): Int = runBlocking { container.monitor.sequenceState().activeIndex + 1 }

    /** Everything useful for understanding a failure: runtime state, recent diagnostics, events. */
    fun failureContext(): String = runBlocking {
        val diagnostics = container.events.diagnostics(30).first().joinToString("\n") {
            "  ${it.level} ${it.category}: ${it.message}"
        }
        val events = container.events.allRecords().joinToString("\n") { "  ${it.roundId} ${it.summary()} [${it.detectionReason}, ${it.continuity}]" }
        "runtime=${runtime()}\nactive=${activeAlgorithm()}\nevents:\n$events\ndiagnostics (newest first):\n$diagnostics"
    }

    fun <T : Any> waitFor(what: String, timeoutMs: Long, pollMs: Long = 150, probe: () -> T?): T {
        val deadline = SystemClock.uptimeMillis() + timeoutMs
        while (SystemClock.uptimeMillis() < deadline) {
            probe()?.let { return it }
            SystemClock.sleep(pollMs)
        }
        probe()?.let { return it }
        val context = failureContext()
        log("TIMEOUT waiting for $what\n$context")
        fail("Timed out after ${timeoutMs}ms waiting for $what\n$context")
        throw IllegalStateException("unreachable")
    }

    fun awaitStatus(vararg statuses: MonitorStatus, timeoutMs: Long = 30_000): RuntimeState =
        waitFor("status in ${statuses.toList()}", timeoutMs) { runtime().takeIf { it.status in statuses } }

    fun awaitEventCount(expected: Int, timeoutMs: Long = 60_000) {
        waitFor("event count $expected", timeoutMs) { eventCount().takeIf { it >= expected } }
        val actual = eventCount()
        if (actual != expected) fail("Expected $expected events but found $actual\n${failureContext()}")
    }

    /**
     * Accepts the system screen-capture dialog if it is shown (with PROJECT_MEDIA allowed it
     * usually is not). On Android 14+ "Entire screen" is chosen when a single-app option exists.
     */
    fun acceptCaptureDialogIfShown() {
        val singleApp = device.findObject(By.pkg("com.android.systemui").text(Pattern.compile("(?i)a single app")))
        if (singleApp != null) {
            singleApp.click()
            device.wait(Until.findObject(By.text(Pattern.compile("(?i)entire screen"))), 2_000)?.click()
        }
        device.findObject(By.pkg("com.android.systemui").clickable(true).text(Pattern.compile("(?i)start now|start|share screen")))
            ?.click()
    }
}
