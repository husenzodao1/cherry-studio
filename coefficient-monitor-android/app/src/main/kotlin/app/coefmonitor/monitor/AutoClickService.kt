package app.coefmonitor.monitor

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Intent
import android.graphics.Path
import android.hardware.display.DisplayManager
import android.util.DisplayMetrics
import android.view.Display
import android.view.accessibility.AccessibilityEvent
import app.coefmonitor.core.NormalizedPoint
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import java.lang.ref.WeakReference
import kotlin.coroutines.resume

/**
 * Performs the auto-clicker's taps. Android only lets an app tap on other apps through an
 * accessibility service that the user turns on in system settings. This one reads no screen
 * content and handles no accessibility events; it only dispatches taps.
 */
class AutoClickService : AccessibilityService() {

    override fun onServiceConnected() {
        super.onServiceConnected()
        current = WeakReference(this)
        mutableConnected.value = true
    }

    override fun onUnbind(intent: Intent?): Boolean {
        disconnect()
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        disconnect()
        super.onDestroy()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

    override fun onInterrupt() = Unit

    private fun disconnect() {
        if (current?.get() === this) {
            current = null
            mutableConnected.value = false
        }
    }

    private suspend fun tapAt(point: NormalizedPoint): Boolean {
        val (width, height) = displaySize()
        val path = Path().apply {
            moveTo((point.x * width).coerceIn(0f, width - 1f), (point.y * height).coerceIn(0f, height - 1f))
        }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, TAP_DURATION_MS))
            .build()
        return suspendCancellableCoroutine { continuation ->
            val callback = object : AccessibilityService.GestureResultCallback() {
                override fun onCompleted(gestureDescription: GestureDescription?) {
                    if (continuation.isActive) continuation.resume(true)
                }

                override fun onCancelled(gestureDescription: GestureDescription?) {
                    if (continuation.isActive) continuation.resume(false)
                }
            }
            if (!dispatchGesture(gesture, callback, null) && continuation.isActive) continuation.resume(false)
        }
    }

    @Suppress("DEPRECATION")
    private fun displaySize(): Pair<Int, Int> {
        val metrics = DisplayMetrics()
        getSystemService(DisplayManager::class.java).getDisplay(Display.DEFAULT_DISPLAY).getRealMetrics(metrics)
        return metrics.widthPixels to metrics.heightPixels
    }

    companion object {
        private const val TAP_DURATION_MS = 50L

        @Volatile
        private var current: WeakReference<AutoClickService>? = null
        private val mutableConnected = MutableStateFlow(false)

        /** True while the user has turned the service on in Accessibility settings and Android has connected it. */
        val connected: StateFlow<Boolean> = mutableConnected.asStateFlow()

        /**
         * Taps [point] (normalised to the full display, like the calibration screenshot). Returns
         * false if the service is off or Android cancelled the tap (e.g. the user touched the screen).
         */
        suspend fun tap(point: NormalizedPoint): Boolean = current?.get()?.tapAt(point) ?: false
    }
}
