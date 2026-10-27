package app.coefmonitor.monitor

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.hardware.display.DisplayManager
import android.provider.Settings
import android.util.DisplayMetrics
import android.util.TypedValue
import android.view.Display
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import app.coefmonitor.R
import app.coefmonitor.core.ClickPlan
import app.coefmonitor.core.NormalizedPoint
import app.coefmonitor.core.NormalizedRect
import kotlin.math.hypot

/**
 * Picks a click point directly on the screen, over any app: a full-screen layer where a tap puts the
 * marker and dragging moves it (a drag that starts on the marker keeps its offset, so the finger
 * does not hide the point), plus a small bar with the position, Cancel and Use this point. The point
 * is normalised to the full display, like the auto-clicker's taps.
 */
class PointPickerOverlay(
    private val context: Context,
    initial: NormalizedPoint?,
    private val readingBand: NormalizedRect?,
    private val onDone: (NormalizedPoint?) -> Unit,
) {
    private val windowManager = context.getSystemService(WindowManager::class.java)
    private var root: FrameLayout? = null
    private var point: NormalizedPoint? = initial

    private lateinit var surface: PickSurface
    private lateinit var bar: LinearLayout
    private lateinit var info: TextView
    private lateinit var useButton: TextView

    fun show(): Boolean {
        if (root != null) return true
        if (!Settings.canDrawOverlays(context)) return false
        val view = build()
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply { gravity = Gravity.TOP or Gravity.START }
        return try {
            windowManager.addView(view, params)
            root = view
            refresh()
            true
        } catch (e: RuntimeException) {
            false
        }
    }

    /** Closes the picker without a point. */
    fun dismiss() = finish(null)

    private fun finish(result: NormalizedPoint?) {
        val view = root ?: return
        root = null
        runCatching { windowManager.removeView(view) }
        onDone(result)
    }

    private fun build(): FrameLayout {
        val container = FrameLayout(context)
        surface = PickSurface(context)
        container.addView(surface, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        bar = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(8), dp(12), dp(8))
            // Touches on the bar must not move the marker underneath.
            isClickable = true
            background = GradientDrawable().apply {
                cornerRadius = dp(12).toFloat()
                setColor(context.getColor(R.color.overlay_background))
                setStroke(dp(1), context.getColor(R.color.brand_primary))
            }
        }
        info = TextView(context).apply {
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            setTextColor(Color.WHITE)
            maxWidth = dp(260)
        }
        bar.addView(info)
        val buttons = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.END
            setPadding(0, dp(6), 0, 0)
        }
        buttons.addView(button(context.getString(R.string.action_cancel)) { finish(null) })
        useButton = button(context.getString(R.string.action_use_point)) { point?.let(::finish) }
        buttons.addView(useButton)
        bar.addView(buttons)
        container.addView(
            bar,
            FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT),
        )
        return container
    }

    private fun refresh() {
        val p = point
        val allowed = p != null && ClickPlan.isAllowed(p, readingBand)
        info.text = when {
            p == null -> context.getString(R.string.overlay_pick_hint)
            !allowed -> context.getString(R.string.point_on_reading_band)
            else -> context.getString(R.string.overlay_pick_position, percent(p.x), percent(p.y))
        }
        useButton.isEnabled = allowed
        useButton.alpha = if (allowed) 1f else 0.4f
        // Keep the bar away from the marker: at the bottom while the point is in the upper part.
        val atTop = p != null && p.y < 0.35f
        val params = bar.layoutParams as FrameLayout.LayoutParams
        params.gravity = (if (atTop) Gravity.BOTTOM else Gravity.TOP) or Gravity.CENTER_HORIZONTAL
        params.topMargin = if (atTop) 0 else dp(BAR_MARGIN_DP)
        params.bottomMargin = if (atTop) dp(BAR_MARGIN_DP) else 0
        bar.layoutParams = params
        surface.invalidate()
    }

    private fun percent(value: Float) = "%.1f".format(value * 100)

    @Suppress("DEPRECATION")
    private fun displaySize(): Pair<Float, Float> {
        val metrics = DisplayMetrics()
        context.getSystemService(DisplayManager::class.java).getDisplay(Display.DEFAULT_DISPLAY).getRealMetrics(metrics)
        return metrics.widthPixels.toFloat() to metrics.heightPixels.toFloat()
    }

    private fun button(label: String, onClick: () -> Unit) = TextView(context).apply {
        text = label
        setTextColor(Color.WHITE)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
        setPadding(dp(12), dp(6), dp(12), dp(6))
        minHeight = dp(34)
        gravity = Gravity.CENTER
        background = GradientDrawable().apply {
            cornerRadius = dp(8).toFloat()
            setColor(Color.rgb(0x2E, 0x2B, 0x55))
        }
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { marginStart = dp(6) }
        isClickable = true
        setOnClickListener { onClick() }
    }

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()

    /** Dims the screen a little, shows the row being read in red and the marker with a crosshair. */
    @SuppressLint("ViewConstructor")
    private inner class PickSurface(context: Context) : View(context) {
        private val dim = Paint().apply { color = Color.argb(60, 0, 0, 0) }
        private val band = Paint().apply { color = Color.argb(90, 0xE5, 0x48, 0x4D) }
        private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(170, 0xE5, 0x48, 0x4D) }
        private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = dp(2).toFloat()
            color = Color.WHITE
        }
        private val location = IntArray(2)
        private var offsetX = 0f
        private var offsetY = 0f

        override fun onDraw(canvas: Canvas) {
            canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), dim)
            getLocationOnScreen(location)
            val (w, h) = displaySize()
            val left = location[0].toFloat()
            val top = location[1].toFloat()
            readingBand?.let { b -> canvas.drawRect(b.left * w - left, b.top * h - top, b.right * w - left, b.bottom * h - top, band) }
            point?.let { p ->
                val cx = p.x * w - left
                val cy = p.y * h - top
                val radius = dp(MARKER_RADIUS_DP).toFloat()
                val arm = dp(MARKER_RADIUS_DP + 12).toFloat()
                canvas.drawCircle(cx, cy, radius, fill)
                canvas.drawCircle(cx, cy, radius, ring)
                canvas.drawLine(cx - arm, cy, cx + arm, cy, ring)
                canvas.drawLine(cx, cy - arm, cx, cy + arm, ring)
            }
        }

        @SuppressLint("ClickableViewAccessibility")
        override fun onTouchEvent(event: MotionEvent): Boolean {
            val (w, h) = displaySize()
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    val current = point
                    // Starting on the marker drags it by the finger's movement; elsewhere it jumps there.
                    if (current != null && hypot(current.x * w - event.rawX, current.y * h - event.rawY) <= dp(GRAB_RADIUS_DP)) {
                        offsetX = current.x * w - event.rawX
                        offsetY = current.y * h - event.rawY
                    } else {
                        offsetX = 0f
                        offsetY = 0f
                    }
                    moveTo(event.rawX + offsetX, event.rawY + offsetY, w, h)
                }
                MotionEvent.ACTION_MOVE -> moveTo(event.rawX + offsetX, event.rawY + offsetY, w, h)
            }
            return true
        }

        private fun moveTo(x: Float, y: Float, w: Float, h: Float) {
            point = NormalizedPoint((x / w).coerceIn(0f, 1f), (y / h).coerceIn(0f, 1f))
            refresh()
        }
    }

    private companion object {
        const val MARKER_RADIUS_DP = 14
        const val GRAB_RADIUS_DP = 44
        const val BAR_MARGIN_DP = 48
    }
}
