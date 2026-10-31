package tj.hamnavo.e2e

import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.util.Log
import android.view.View
import android.widget.EditText
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import org.junit.Assert.fail
import tj.hamnavo.AppState
import tj.hamnavo.MainActivity
import tj.hamnavo.R
import tj.hamnavo.core.LevelRuns
import java.util.regex.Pattern

/** Helpers for the device tests: real UI clicks, shell, waiting and level recording. */
object E2e {
    const val TAG = "HamnavoTest"
    private const val PKG = "tj.hamnavo"

    val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    val device: UiDevice get() = UiDevice.getInstance(instrumentation)

    fun log(message: String) {
        Log.i(TAG, message)
    }

    fun shell(command: String): String = device.executeShellCommand(command)

    fun grantPermissions() {
        shell("pm grant $PKG android.permission.RECORD_AUDIO")
        if (Build.VERSION.SDK_INT >= 33) shell("pm grant $PKG android.permission.POST_NOTIFICATIONS")
        // Lets the screen-capture consent pass without the dialog (it is still clicked if shown).
        shell("appops set $PKG PROJECT_MEDIA allow")
        shell("settings put global hide_error_dialogs 1")
    }

    fun launch(): MainActivity {
        val intent = Intent(instrumentation.targetContext, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return instrumentation.startActivitySync(intent) as MainActivity
    }

    fun close(activity: MainActivity?) {
        activity ?: return
        instrumentation.runOnMainSync { activity.finish() }
        val deadline = SystemClock.uptimeMillis() + 5000
        while (!activity.isDestroyed && SystemClock.uptimeMillis() < deadline) SystemClock.sleep(50)
    }

    fun click(activity: MainActivity, id: Int) {
        log("click ${activity.resources.getResourceEntryName(id)}")
        instrumentation.runOnMainSync { activity.findViewById<View>(id).performClick() }
    }

    fun typeIp(activity: MainActivity, text: String) {
        instrumentation.runOnMainSync { activity.findViewById<EditText>(R.id.ip_input).setText(text) }
    }

    fun screenshot(name: String) {
        shell("mkdir -p /sdcard/Download/hamnavo")
        shell("screencap -p /sdcard/Download/hamnavo/api${Build.VERSION.SDK_INT}_$name.png")
    }

    fun state(): String =
        "sender=${AppState.senderRunning} clients=${AppState.senderClients} capture=${AppState.senderCaptureLevel} " +
            "beep=${AppState.senderBeepActive} receiver=${AppState.receiverRunning} " +
            "status='${AppState.receiverStatus}' connected=${AppState.receiverConnectedTo}\nlog:\n${AppState.logText()}"

    fun waitFor(what: String, timeoutMs: Long, condition: () -> Boolean) {
        val deadline = SystemClock.uptimeMillis() + timeoutMs
        while (SystemClock.uptimeMillis() < deadline) {
            if (condition()) return
            acceptCaptureDialogIfShown()
            SystemClock.sleep(100)
        }
        if (condition()) return
        val s = state()
        log("TIMEOUT waiting for $what\n$s")
        fail("Timed out after ${timeoutMs} ms waiting for $what\n$s")
    }

    /** Accepts the system screen-capture dialog if it appears ("Entire screen" + "Start now"). */
    fun acceptCaptureDialogIfShown() {
        val ui = By.pkg("com.android.systemui")
        device.findObject(ui.clickable(true).text(Pattern.compile("(?i)start now|start|share screen")))?.click()
    }

    fun startSender(activity: MainActivity) {
        click(activity, R.id.btn_send)
        waitFor("sender to run", 30_000) { AppState.senderRunning }
    }

    fun stopAll(activity: MainActivity?) {
        if (activity != null) click(activity, R.id.btn_stop)
        val deadline = SystemClock.uptimeMillis() + 10_000
        while ((AppState.senderRunning || AppState.receiverRunning) && SystemClock.uptimeMillis() < deadline) {
            SystemClock.sleep(100)
        }
        AppState.senderFrameListener = null
        AppState.receiverFrameListener = null
    }

    /** Starts the separate tone app: ordinary media playback from another app (another uid). */
    fun playToneInOtherApp(durationMs: Int) {
        log("tonegen $durationMs ms")
        shell("am start -n tj.hamnavo.tonegen/.ToneActivity --ei duration_ms $durationMs")
    }
}

/** Level timeline with uptime timestamps, filled from a frame listener (10 ms per entry). */
class LevelRecorder {
    private val times = ArrayList<Long>()
    private val levels = ArrayList<Float>()

    @Synchronized fun add(level: Float) {
        times += SystemClock.uptimeMillis()
        levels += level
    }

    @Synchronized fun runs(threshold: Float, fromMs: Long = 0, toMs: Long = Long.MAX_VALUE, mergeGapMs: Long = 40): List<LevelRuns.Run> {
        val idx = times.indices.filter { times[it] in fromMs..toMs }
        return LevelRuns.runs(
            LongArray(idx.size) { times[idx[it]] }, FloatArray(idx.size) { levels[idx[it]] },
            threshold, mergeGapMs = mergeGapMs,
        )
    }

    @Synchronized fun max(fromMs: Long, toMs: Long = Long.MAX_VALUE): Float =
        times.indices.filter { times[it] in fromMs..toMs }.maxOfOrNull { levels[it] } ?: 0f

    @Synchronized fun frames(fromMs: Long, toMs: Long = Long.MAX_VALUE): Int = times.count { it in fromMs..toMs }

    /** Compact text of the loud parts, for failure messages. */
    fun describe(fromMs: Long, threshold: Float): String =
        runs(threshold, fromMs).joinToString { "[${it.startMs - fromMs}..${it.endMs - fromMs}]" }
}
