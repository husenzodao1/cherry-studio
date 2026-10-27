package app.coefmonitor.monitor

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import app.coefmonitor.R
import kotlin.math.abs

/** One step of the active algorithm as the panel shows it. */
data class PanelStep(val label: String, val time: String)

data class OverlayState(
    val title: String,
    val algorithmName: String,
    val coefficientLine: String,
    val statusLine: String,
    val warning: String?,
    val log: List<String>,
    /** True while a capture session exists (monitoring or paused); false shows Start instead of Pause/Stop. */
    val captureActive: Boolean,
    val paused: Boolean,
    /** "Auto-click: step 2 of 3 · next in 250 ms" while the auto-clicker runs. */
    val clickLine: String?,
    val clicksRunning: Boolean,
    val steps: List<PanelStep>,
    /** Changes when the step list has to be rebuilt (another algorithm, steps added, removed or renamed). */
    val stepsKey: String,
    val threshold: String,
    val globalDelay: String,
    val captureInterval: String,
    val stableFrames: String,
    val cooldown: String,
    val autoClickEnabled: Boolean,
    val clickerConnected: Boolean,
    val roundNotifications: Boolean,
)

/** What the panel's buttons do; implemented by [FloatingPanelService]. */
interface OverlayActions {
    fun startMonitoring()
    fun pauseResume()
    fun stopMonitoring()
    fun runOrStopClicks()
    fun openApp()
    fun openAccessibilitySettings()
    fun close()
    fun selectAlgorithm(delta: Int)
    fun resetToFirst()
    fun changeStepTime(stepIndex: Int, deltaMs: Long)
    fun changeThreshold(deltaHundredths: Long)
    fun changeGlobalDelay(deltaMs: Long)
    fun changeCaptureInterval(deltaMs: Long)
    fun changeStableFrames(delta: Int)
    fun changeCooldown(deltaMs: Long)
    fun toggleAutoClick()
    fun toggleRoundNotifications()
}

/**
 * Movable floating panel over every app (requires the "display over other apps" permission) with
 * three tabs: status and controls, the active algorithm with its click times, and the settings.
 * It is not focusable, so it never blocks system navigation; tap the title to collapse it.
 * Keep it away from the tile row: anything drawn over the observed tile is captured too. Keep it
 * away from the click points as well: an auto-click there would land on the panel.
 */
class OverlayController(
    private val context: Context,
    private val actions: OverlayActions,
) {
    private enum class Tab { STATUS, ALGORITHM, SETTINGS }

    private val windowManager = context.getSystemService(WindowManager::class.java)
    private val repeatHandler = Handler(Looper.getMainLooper())
    private var root: LinearLayout? = null
    private var params: WindowManager.LayoutParams? = null
    private var collapsed = false
    private var stepsKey: String? = null

    private lateinit var title: TextView
    private lateinit var body: LinearLayout
    private val tabButtons = mutableMapOf<Tab, TextView>()
    private val pages = mutableMapOf<Tab, View>()

    // Status tab
    private lateinit var name: TextView
    private lateinit var coefficient: TextView
    private lateinit var status: TextView
    private lateinit var warning: TextView
    private lateinit var clickLine: TextView
    private lateinit var log: TextView
    private lateinit var startButton: TextView
    private lateinit var pauseButton: TextView
    private lateinit var stopButton: TextView
    private lateinit var clicksButton: TextView

    // Algorithm tab
    private lateinit var position: TextView
    private lateinit var algorithmName: TextView
    private lateinit var stepList: LinearLayout
    private val stepTimes = mutableListOf<TextView>()

    // Settings tab
    private lateinit var threshold: TextView
    private lateinit var globalDelay: TextView
    private lateinit var captureInterval: TextView
    private lateinit var stableFrames: TextView
    private lateinit var cooldown: TextView
    private lateinit var autoClickToggle: TextView
    private lateinit var notificationsToggle: TextView
    private lateinit var accessibilityButton: TextView

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
            // Near the top, where games rarely put the result row or their buttons; drag it anywhere.
            gravity = Gravity.TOP or Gravity.START
            x = dp(12)
            y = dp(40)
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
        repeatHandler.removeCallbacksAndMessages(null)
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
        warning.showText(state.warning)
        clickLine.showText(state.clickLine)
        log.showText(state.log.takeIf { it.isNotEmpty() }?.joinToString("\n"))
        startButton.visibility = if (state.captureActive) View.GONE else View.VISIBLE
        pauseButton.visibility = if (state.captureActive) View.VISIBLE else View.GONE
        stopButton.visibility = if (state.captureActive) View.VISIBLE else View.GONE
        pauseButton.text = context.getString(if (state.paused) R.string.action_resume else R.string.action_pause)
        clicksButton.text = context.getString(if (state.clicksRunning) R.string.overlay_stop_clicks else R.string.overlay_clicks_button)

        position.text = state.title
        algorithmName.text = state.algorithmName
        if (state.stepsKey != stepsKey) {
            stepsKey = state.stepsKey
            rebuildSteps(state.steps)
        }
        state.steps.forEachIndexed { i, step -> stepTimes.getOrNull(i)?.text = step.time }

        threshold.text = state.threshold
        globalDelay.text = state.globalDelay
        captureInterval.text = state.captureInterval
        stableFrames.text = state.stableFrames
        cooldown.text = state.cooldown
        autoClickToggle.text = toggleLabel(R.string.auto_click, state.autoClickEnabled)
        notificationsToggle.text = toggleLabel(R.string.round_notifications, state.roundNotifications)
        accessibilityButton.visibility = if (state.clickerConnected) View.GONE else View.VISIBLE
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
        val header = row().apply {
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        title = text(15f, Color.WHITE, bold = true).apply {
            contentDescription = context.getString(R.string.overlay_drag_hint)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            minHeight = dp(32)
            gravity = Gravity.CENTER_VERTICAL
        }
        header.addView(title)
        header.addView(
            button("✕") { actions.close() }.apply {
                contentDescription = context.getString(R.string.action_close)
                minWidth = dp(40)
            },
        )
        panel.addView(header)
        attachDrag(title)

        body = column().apply { minimumWidth = dp(MIN_BODY_WIDTH_DP) }
        val tabs = row().apply { setPadding(0, dp(6), 0, dp(6)) }
        listOf(
            Tab.STATUS to R.string.overlay_tab_status,
            Tab.ALGORITHM to R.string.overlay_tab_algorithm,
            Tab.SETTINGS to R.string.overlay_tab_settings,
        ).forEach { (t, label) ->
            val b = button(context.getString(label)) { select(t) }
            tabButtons[t] = b
            tabs.addView(b)
        }
        body.addView(tabs)
        pages[Tab.STATUS] = buildStatusPage()
        pages[Tab.ALGORITHM] = buildAlgorithmPage()
        pages[Tab.SETTINGS] = buildSettingsPage()
        pages.values.forEach(body::addView)
        panel.addView(body)
        select(Tab.STATUS)
        return panel
    }

    private fun buildStatusPage(): View {
        val page = column()
        name = text(13f, Color.WHITE)
        coefficient = text(20f, Color.WHITE, bold = true)
        status = text(12f, MUTED)
        clickLine = text(13f, Color.rgb(0xFF, 0x8A, 0x8D), bold = true)
        warning = text(12f, Color.rgb(0xFF, 0xB4, 0x54))
        log = text(11f, Color.rgb(0xA9, 0xA7, 0xC9))
        listOf(name, coefficient, status, clickLine, warning, log).forEach(page::addView)
        val buttons = row().apply { setPadding(0, dp(8), 0, 0) }
        startButton = button(context.getString(R.string.overlay_start)) { actions.startMonitoring() }
        pauseButton = button(context.getString(R.string.action_pause)) { actions.pauseResume() }
        stopButton = button(context.getString(R.string.action_stop)) { actions.stopMonitoring() }
        clicksButton = button(context.getString(R.string.overlay_clicks_button)) { actions.runOrStopClicks() }
        val openButton = button(context.getString(R.string.overlay_open_app)) { actions.openApp() }
        listOf(startButton, pauseButton, stopButton, clicksButton, openButton).forEach(buttons::addView)
        page.addView(buttons)
        return page
    }

    private fun buildAlgorithmPage(): View {
        val page = column()
        val selector = row().apply {
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        selector.addView(button("◀") { actions.selectAlgorithm(-1) }.apply { contentDescription = context.getString(R.string.overlay_previous) })
        position = text(14f, Color.WHITE, bold = true).apply {
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        selector.addView(position)
        selector.addView(button("▶") { actions.selectAlgorithm(1) }.apply { contentDescription = context.getString(R.string.overlay_next) })
        page.addView(selector)
        algorithmName = text(13f, Color.WHITE).apply { setPadding(0, dp(4), 0, dp(4)) }
        page.addView(algorithmName)
        page.addView(button(context.getString(R.string.overlay_reset_to_first)) { actions.resetToFirst() })
        page.addView(text(12f, MUTED).apply {
            text = context.getString(R.string.overlay_step_times)
            setPadding(0, dp(8), 0, dp(2))
        })
        stepList = column()
        page.addView(scroll(stepList))
        return page
    }

    private fun rebuildSteps(steps: List<PanelStep>) {
        stepList.removeAllViews()
        stepTimes.clear()
        if (steps.isEmpty()) {
            stepList.addView(text(12f, MUTED).apply { text = context.getString(R.string.overlay_no_steps) })
            return
        }
        steps.forEachIndexed { index, step ->
            stepList.addView(text(12f, Color.WHITE).apply { text = step.label })
            val value = valueText()
            stepTimes += value
            stepList.addView(stepper(value, { actions.changeStepTime(index, -TIME_STEP_MS) }, { actions.changeStepTime(index, TIME_STEP_MS) }))
        }
    }

    private fun buildSettingsPage(): View {
        val page = column()
        threshold = valueText()
        globalDelay = valueText()
        captureInterval = valueText()
        stableFrames = valueText()
        cooldown = valueText()
        setting(page, R.string.threshold, threshold, { actions.changeThreshold(-1) }, { actions.changeThreshold(1) })
        setting(page, R.string.global_delay, globalDelay, { actions.changeGlobalDelay(-TIME_STEP_MS) }, { actions.changeGlobalDelay(TIME_STEP_MS) })
        setting(
            page,
            R.string.capture_interval,
            captureInterval,
            { actions.changeCaptureInterval(-TIME_STEP_MS) },
            { actions.changeCaptureInterval(TIME_STEP_MS) },
        )
        setting(page, R.string.stable_frames, stableFrames, { actions.changeStableFrames(-1) }, { actions.changeStableFrames(1) })
        setting(page, R.string.cooldown, cooldown, { actions.changeCooldown(-COOLDOWN_STEP_MS) }, { actions.changeCooldown(COOLDOWN_STEP_MS) })
        autoClickToggle = button("") { actions.toggleAutoClick() }
        notificationsToggle = button("") { actions.toggleRoundNotifications() }
        accessibilityButton = button(context.getString(R.string.action_enable_auto_click)) { actions.openAccessibilitySettings() }
        listOf(autoClickToggle, accessibilityButton, notificationsToggle).forEach { toggle ->
            toggle.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                .apply { topMargin = dp(6) }
            page.addView(toggle)
        }
        return scroll(page)
    }

    private fun setting(page: LinearLayout, label: Int, value: TextView, minus: () -> Unit, plus: () -> Unit) {
        page.addView(text(12f, MUTED).apply {
            text = context.getString(label)
            setPadding(0, dp(6), 0, dp(2))
        })
        page.addView(stepper(value, minus, plus))
    }

    /** [−] value [+]; holding a button repeats it. */
    private fun stepper(value: TextView, minus: () -> Unit, plus: () -> Unit) = row().apply {
        gravity = Gravity.CENTER_VERTICAL
        addView(repeatButton("−", minus))
        addView(value)
        addView(repeatButton("+", plus))
    }

    private fun select(selected: Tab) {
        pages.forEach { (t, page) -> page.visibility = if (t == selected) View.VISIBLE else View.GONE }
        tabButtons.forEach { (t, b) ->
            (b.background as GradientDrawable).setColor(if (t == selected) context.getColor(R.color.brand_primary) else BUTTON)
        }
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

    private fun toggleLabel(label: Int, on: Boolean) = "${if (on) "✓" else "✗"} ${context.getString(label)}"

    private fun TextView.showText(value: String?) {
        text = value.orEmpty()
        visibility = if (value == null) View.GONE else View.VISIBLE
    }

    private fun column() = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }

    private fun row() = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }

    private fun scroll(content: View) = MaxHeightScrollView(context, dp(MAX_PAGE_HEIGHT_DP)).apply { addView(content) }

    private fun valueText() = text(14f, Color.WHITE, bold = true).apply {
        gravity = Gravity.CENTER
        minWidth = dp(96)
    }

    private fun text(sizeSp: Float, color: Int, bold: Boolean = false) = TextView(context).apply {
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
        setTextColor(color)
        maxWidth = dp(MAX_TEXT_WIDTH_DP)
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
            setColor(BUTTON)
        }
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { marginEnd = dp(6) }
        isClickable = true
        setOnClickListener { onClick() }
    }

    /** Acts once on press and then repeatedly while held, so large changes do not need many taps. */
    @SuppressLint("ClickableViewAccessibility")
    private fun repeatButton(label: String, onStep: () -> Unit) = button(label, onStep).apply {
        minWidth = dp(44)
        val repeat = object : Runnable {
            override fun run() {
                onStep()
                repeatHandler.postDelayed(this, REPEAT_INTERVAL_MS)
            }
        }
        setOnTouchListener { view, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    view.isPressed = true
                    onStep()
                    repeatHandler.postDelayed(repeat, REPEAT_START_MS)
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    view.isPressed = false
                    repeatHandler.removeCallbacks(repeat)
                    if (event.actionMasked == MotionEvent.ACTION_UP) view.performClick()
                    true
                }
                else -> true
            }
        }
        // The touch listener already acted; a click (also from accessibility) must not act twice.
        setOnClickListener(null)
        isClickable = true
    }

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()

    /** A ScrollView that stops growing at [maxHeightPx], so a long page scrolls inside the panel. */
    private class MaxHeightScrollView(context: Context, private val maxHeightPx: Int) : ScrollView(context) {
        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
            super.onMeasure(widthMeasureSpec, MeasureSpec.makeMeasureSpec(maxHeightPx, MeasureSpec.AT_MOST))
        }
    }

    private companion object {
        val MUTED = Color.rgb(0xC7, 0xC5, 0xF0)
        val BUTTON = Color.rgb(0x2E, 0x2B, 0x55)
        const val MAX_TEXT_WIDTH_DP = 260
        const val MIN_BODY_WIDTH_DP = 248
        const val MAX_PAGE_HEIGHT_DP = 300
        const val TIME_STEP_MS = 50L
        const val COOLDOWN_STEP_MS = 250L
        const val REPEAT_START_MS = 400L
        const val REPEAT_INTERVAL_MS = 80L
    }
}
