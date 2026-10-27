package app.coefmonitor.monitor

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import app.coefmonitor.R
import kotlin.math.abs

data class OverlayState(
    val title: String,
    val algorithmName: String,
    val coefficientLine: String,
    val statusLine: String,
    val delayLine: String?,
    val warning: String?,
    val log: List<String>,
    val paused: Boolean,
    /** "Auto-click: step 2 of 3 · next in 250 ms" while the auto-clicker runs. */
    val clickLine: String? = null,
)

/**
 * Small movable floating panel (requires the "display over other apps" permission).
 * It is not focusable, so it never blocks system navigation; tap the title to collapse it.
 * Keep it away from the tile row: anything drawn over the observed tile is captured too. Keep it
 * away from the click points as well: an auto-click there would land on the panel.
 */
class OverlayController(
    private val context: Context,
    private val onPauseResume: () -> Unit,
    private val onStop: () -> Unit,
    private val onRunClicks: () -> Unit,
    private val onOpenApp: () -> Unit,
) {
    private val windowManager = context.getSystemService(WindowManager::class.java)
    private var root: LinearLayout? = null
    private var params: WindowManager.LayoutParams? = null
    private var collapsed = false

    private lateinit var title: TextView
    private lateinit var body: LinearLayout
    private lateinit var name: TextView
    private lateinit var coefficient: TextView
    private lateinit var status: TextView
    private lateinit var delay: TextView
    private lateinit var warning: TextView
    private lateinit var clickLine: TextView
    private lateinit var log: TextView
    private lateinit var pauseButton: TextView

    val isShowing: Boolean get() = root != null

    fun show(): Boolean {
        if (root != null) return true
        if (!Settings.canDrawOverlays(context)) return false
        val view = buildView()
        val layoutParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = dp(12)
            y = dp(160)
        }
        return try {
            windowManager.addView(view, layoutParams)
            root = view
            params = layoutParams
            true
        } catch (e: RuntimeException) {
            false
        }
    }

    fun hide() {
        root?.let { runCatching { windowManager.removeView(it) } }
        root = null
        params = null
    }

    fun update(state: OverlayState) {
        if (root == null) return
        title.text = state.title
        name.text = state.algorithmName
        coefficient.text = state.coefficientLine
        status.text = state.statusLine
        delay.text = state.delayLine.orEmpty()
        delay.visibility = if (state.delayLine == null) View.GONE else View.VISIBLE
        warning.text = state.warning.orEmpty()
        warning.visibility = if (state.warning == null) View.GONE else View.VISIBLE
        clickLine.text = state.clickLine.orEmpty()
        clickLine.visibility = if (state.clickLine == null) View.GONE else View.VISIBLE
        log.text = state.log.joinToString("\n")
        log.visibility = if (state.log.isEmpty()) View.GONE else View.VISIBLE
        pauseButton.text = context.getString(if (state.paused) R.string.action_resume else R.string.action_pause)
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun buildView(): LinearLayout {
        val panel = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(10), dp(12), dp(10))
            background = GradientDrawable().apply {
                cornerRadius = dp(16).toFloat()
                setColor(context.getColor(R.color.overlay_background))
                setStroke(dp(1), context.getColor(R.color.brand_primary))
            }
        }
        title = text(15f, Color.WHITE, bold = true).apply {
            contentDescription = context.getString(R.string.overlay_drag_hint)
        }
        panel.addView(title)
        body = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
        name = text(13f, Color.WHITE)
        coefficient = text(20f, Color.WHITE, bold = true)
        status = text(12f, Color.rgb(0xC7, 0xC5, 0xF0))
        delay = text(12f, Color.rgb(0xC7, 0xC5, 0xF0))
        warning = text(12f, Color.rgb(0xFF, 0xB4, 0x54))
        clickLine = text(13f, Color.rgb(0xFF, 0x8A, 0x8D), bold = true)
        log = text(11f, Color.rgb(0xA9, 0xA7, 0xC9))
        listOf(name, coefficient, status, delay, clickLine, warning, log).forEach(body::addView)
        val buttons = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dp(8), 0, 0)
        }
        pauseButton = button(context.getString(R.string.action_pause)) { onPauseResume() }
        buttons.addView(pauseButton)
        buttons.addView(button(context.getString(R.string.action_stop)) { onStop() })
        buttons.addView(button(context.getString(R.string.overlay_clicks_button)) { onRunClicks() })
        buttons.addView(button(context.getString(R.string.overlay_open_app)) { onOpenApp() })
        body.addView(buttons)
        panel.addView(body)
        attachDrag(title)
        return panel
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun attachDrag(handle: View) {
        var startX = 0
        var startY = 0
        var touchX = 0f
        var touchY = 0f
        var moved = false
        handle.setOnTouchListener { view, event ->
            val p = params ?: return@setOnTouchListener false
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    startX = p.x
                    startY = p.y
                    touchX = event.rawX
                    touchY = event.rawY
                    moved = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - touchX
                    val dy = event.rawY - touchY
                    if (abs(dx) > dp(4) || abs(dy) > dp(4)) moved = true
                    if (moved) {
                        p.x = (startX + dx).toInt().coerceAtLeast(0)
                        p.y = (startY + dy).toInt().coerceAtLeast(0)
                        root?.let { runCatching { windowManager.updateViewLayout(it, p) } }
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!moved) {
                        view.performClick()
                        toggleCollapsed()
                    }
                    true
                }
                else -> false
            }
        }
    }

    private fun toggleCollapsed() {
        collapsed = !collapsed
        body.visibility = if (collapsed) View.GONE else View.VISIBLE
    }

    private fun text(sizeSp: Float, color: Int, bold: Boolean = false) = TextView(context).apply {
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
        setTextColor(color)
        maxWidth = dp(230)
        if (bold) typeface = Typeface.DEFAULT_BOLD
    }

    private fun button(label: String, onClick: () -> Unit) = TextView(context).apply {
        text = label
        setTextColor(Color.WHITE)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
        setPadding(dp(12), dp(8), dp(12), dp(8))
        minHeight = dp(40)
        gravity = Gravity.CENTER
        background = GradientDrawable().apply {
            cornerRadius = dp(10).toFloat()
            setColor(Color.rgb(0x2E, 0x2B, 0x55))
        }
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { marginEnd = dp(6) }
        isClickable = true
        setOnClickListener { onClick() }
    }

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()
}
