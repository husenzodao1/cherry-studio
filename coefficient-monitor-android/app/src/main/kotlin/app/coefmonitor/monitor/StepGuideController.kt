package app.coefmonitor.monitor

import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.hardware.display.DisplayManager
import android.os.Build
import android.provider.Settings
import android.util.DisplayMetrics
import android.util.TypedValue
import android.view.Display
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import app.coefmonitor.core.GuideMarker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Shows an algorithm's step points one after another as numbered circles over the game, each for
 * its step delay. The markers ignore touches (FLAG_NOT_TOUCHABLE): the user taps the game
 * underneath. Nothing is ever tapped by the app.
 */
class StepGuideController(
    private val context: Context,
    private val scope: CoroutineScope,
    private val onProgress: (GuideProgress?) -> Unit,
) {
    private val windowManager = context.getSystemService(WindowManager::class.java)
    private val displayManager = context.getSystemService(DisplayManager::class.java)
    private var job: Job? = null
    private var marker: View? = null

    /** Must be called on the main thread. Replaces any guide that is still running. */
    fun play(algorithmNumber: Int, markers: List<GuideMarker>) {
        cancel()
        if (markers.isEmpty() || !Settings.canDrawOverlays(context)) return
        job = scope.launch {
            try {
                markers.forEachIndexed { index, item ->
                    show(item)
                    onProgress(GuideProgress(algorithmNumber, item.stepNumber, index + 1, markers.size, item.label, item.delayMs))
                    delay(item.visibleMs)
                }
            } finally {
                hide()
                onProgress(null)
            }
        }
    }

    fun cancel() {
        job?.cancel()
        job = null
        hide()
    }

    private fun show(item: GuideMarker) {
        hide()
        val (width, height) = displaySize()
        val size = dp(MARKER_DP)
        val view = TextView(context).apply {
            text = item.stepNumber.toString()
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
            typeface = Typeface.DEFAULT_BOLD
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(MARKER_FILL)
                setStroke(dp(3), Color.WHITE)
            }
        }
        val params = WindowManager.LayoutParams(
            size,
            size,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = (item.point.x * width).toInt() - size / 2
            y = (item.point.y * height).toInt() - size / 2
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }
        try {
            windowManager.addView(view, params)
            marker = view
        } catch (e: RuntimeException) {
            marker = null
        }
    }

    private fun hide() {
        marker?.let { runCatching { windowManager.removeView(it) } }
        marker = null
    }

    @Suppress("DEPRECATION")
    private fun displaySize(): Pair<Int, Int> {
        val metrics = DisplayMetrics()
        displayManager.getDisplay(Display.DEFAULT_DISPLAY).getRealMetrics(metrics)
        return metrics.widthPixels to metrics.heightPixels
    }

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()

    private companion object {
        const val MARKER_DP = 56
        const val MARKER_FILL = 0xCCE5484D.toInt()
    }
}
