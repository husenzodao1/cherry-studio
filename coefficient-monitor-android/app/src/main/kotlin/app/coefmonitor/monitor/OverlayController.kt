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
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import app.coefmonitor.R
import kotlin.math.abs

/** One step of the algorithm shown in the panel's Algorithm tab. */
data class PanelStep(val label: String, val time: String)

data class OverlayState(
    /** Active algorithm, e.g. "Algorithm 3 / 10". */
    val title: String,
    /** Shown in the minimised circle: the active algorithm's number. */
    val bubbleText: String,
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
    /** Algorithm tab: the algorithm being viewed, which need not be the active one. */
    val viewedTitle: String,
    val viewedName: String,
    val viewedIsActive: Boolean,
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
    fun findRow()
    fun runOrStopClicks()
    fun openApp()
    fun openAccessibilitySettings()
    fun close()
    fun browseAlgorithm(delta: Int)
    fun activateViewed()
    fun resetToFirst()
    fun addAlgorithm()
    fun changeStepTime(stepIndex: Int, deltaMs: Long)
    fun pickStepPoint(stepIndex: Int)
    fun deleteStep(stepIndex: Int)
    fun addClickStep()
    fun addPauseStep()
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
 * three tabs: status and controls, the algorithms with their clicks, and the settings. The – button
 * shrinks it to a small circle; tap the circle to open it again. It is not focusable, so it never
 * blocks system navigation. Keep it away from the tile row (anything drawn over the observed tile
 * is captured too) and from the click points (an auto-click there would land on the panel).
 */
class OverlayController(
    private val context: Context,
    private val actions: OverlayActions,
) {
    private enum class Tab { STATUS, ALGORITHM, SETTINGS }

    private val windowManager = context.getSystemService(WindowManager::class.java)
    private val repeatHandler = Handler(Looper.getMainLooper())
    private var root: FrameLayout? = null
    private var params: WindowManager.LayoutParams? = null
    private var stepsKey: String? = null

    private lateinit var panel: LinearLayout
    private lateinit var bubble: TextView
    private lateinit var title: TextView
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
    private lateinit var findRowButton: TextView
    private lateinit var clicksButton: TextView

    // Algorithm tab
    private lateinit var viewedTitle: TextView
    private lateinit var viewedName: TextView
    private lateinit var activateButton: TextView
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

    /** Hides the whole panel (e.g. while a click point is picked on the screen) without closing it. */
    fun setHidden(hidden: Boolean) {
        root?.visibility = if (hidden) View.GONE else View.VISIBLE
    }

    fun update(state: OverlayState) {
        if (root == null) return
        title.text = state.title
        bubble.text = state.bubbleText

        name.text = state.algorithmName
        coefficient.text = state.coefficientLine
        status.text = state.statusLine
        warning.showText(state.warning)
        clickLine.showText(state.clickLine)
        log.showText(state.log.takeIf { it.isNotEmpty() }?.joinToString("\n"))
        startButton.visibleIf(!state.captureActive)
        pauseButton.visibleIf(state.captureActive)
        stopButton.visibleIf(state.captureActive)
        findRowButton.visibleIf(state.captureActive)
        pauseButton.text = context.getString(if (state.paused) R.string.action_resume else R.string.action_pause)
        clicksButton.text = context.getString(if (state.clicksRunning) R.string.overlay_stop_clicks else R.string.overlay_clicks_button)
        (bubble.background as GradientDrawable).setColor(
            when {
                state.clicksRunning -> CLICKING
                !state.captureActive -> STOPPED
                state.paused -> PAUSED
                else -> context.getColor(R.color.brand_primary)
            },
        )

        viewedTitle.text = if (state.viewedIsActive) "${state.viewedTitle} ✓" else state.viewedTitle
        viewedName.text = state.viewedName
        activateButton.visibleIf(!state.viewedIsActive)
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
        accessibilityButton.visibleIf(!state.clickerConnected)
    }

    private fun buildView(): FrameLayout {
        val container = FrameLayout(context)
        panel = column().apply {
            setPadding(dp(10), dp(8), dp(10), dp(10))
            background = GradientDrawable().apply {
                cornerRadius = dp(14).toFloat()
                setColor(context.getColor(R.color.overlay_background))
                setStroke(dp(1), context.getColor(R.color.brand_primary))
            }
        }
        val header = row().apply {
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        title = text(14f, Color.WHITE, bold = true).apply {
            contentDescription = context.getString(R.string.overlay_drag_hint)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            minHeight = dp(30)
            gravity = Gravity.CENTER_VERTICAL
            singleLine()
        }
        header.addView(title)
        header.addView(smallButton("–") { setMinimized(true) }.apply { contentDescription = context.getString(R.string.overlay_minimize) })
        header.addView(smallButton("✕") { actions.close() }.apply { contentDescription = context.getString(R.string.action_close) })
        panel.addView(header)
        attachDrag(title) {}

        // A fixed width, so every text is measured once at its final width and long ones wrap fully.
        val body = column().apply {
            layoutParams = LinearLayout.LayoutParams(dp(BODY_WIDTH_DP), LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        val tabs = row().apply { setPadding(0, dp(4), 0, dp(6)) }
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

        bubble = text(18f, Color.WHITE, bold = true).apply {
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(dp(BUBBLE_DP), dp(BUBBLE_DP))
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(STOPPED)
                setStroke(dp(2), Color.WHITE)
            }
            contentDescription = context.getString(R.string.overlay_expand)
            visibility = View.GONE
        }
        attachDrag(bubble) { setMinimized(false) }
        container.addView(panel, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        container.addView(bubble)
        return container
    }

    private fun buildStatusPage(): View {
        val page = column()
        name = text(12f, Color.WHITE).apply { singleLine() }
        coefficient = text(18f, Color.WHITE, bold = true)
        status = text(11f, MUTED)
        clickLine = text(12f, Color.rgb(0xFF, 0x8A, 0x8D), bold = true)
        warning = text(11f, Color.rgb(0xFF, 0xB4, 0x54))
        log = text(10f, Color.rgb(0xA9, 0xA7, 0xC9))
        listOf(name, coefficient, status, clickLine, warning, log).forEach(page::addView)
        val monitorButtons = row().apply { setPadding(0, dp(6), 0, 0) }
        startButton = button(context.getString(R.string.overlay_start)) { actions.startMonitoring() }
        pauseButton = button(context.getString(R.string.action_pause)) { actions.pauseResume() }
        stopButton = button(context.getString(R.string.action_stop)) { actions.stopMonitoring() }
        findRowButton = button(context.getString(R.string.overlay_find_row)) { actions.findRow() }
        listOf(startButton, pauseButton, stopButton, findRowButton).forEach(monitorButtons::addView)
        page.addView(monitorButtons)
        val clickButtons = row().apply { setPadding(0, dp(4), 0, 0) }
        clicksButton = button(context.getString(R.string.overlay_clicks_button)) { actions.runOrStopClicks() }
        clickButtons.addView(clicksButton)
        clickButtons.addView(button(context.getString(R.string.overlay_open_app)) { actions.openApp() })
        page.addView(clickButtons)
        return page
    }

    private fun buildAlgorithmPage(): View {
        val page = column()
        val selector = row().apply {
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        selector.addView(smallButton("◀") { actions.browseAlgorithm(-1) }.apply { contentDescription = context.getString(R.string.overlay_previous) })
        viewedTitle = text(13f, Color.WHITE, bold = true).apply {
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            singleLine()
        }
        selector.addView(viewedTitle)
        selector.addView(smallButton("▶") { actions.browseAlgorithm(1) }.apply { contentDescription = context.getString(R.string.overlay_next) })
        page.addView(selector)
        viewedName = text(12f, Color.WHITE).apply {
            setPadding(0, dp(2), 0, dp(2))
            singleLine()
        }
        page.addView(viewedName)
        val algorithmButtons = row()
        activateButton = button(context.getString(R.string.overlay_activate)) { actions.activateViewed() }
        algorithmButtons.addView(activateButton)
        algorithmButtons.addView(button("↺ 1") { actions.resetToFirst() }.apply { contentDescription = context.getString(R.string.overlay_reset_to_first) })
        algorithmButtons.addView(button(context.getString(R.string.overlay_add_algorithm)) { actions.addAlgorithm() })
        page.addView(algorithmButtons)
        page.addView(text(11f, MUTED).apply {
            text = context.getString(R.string.overlay_step_times)
            setPadding(0, dp(6), 0, dp(2))
        })
        stepList = column()
        page.addView(scroll(stepList, MAX_STEPS_HEIGHT_DP))
        val addButtons = row().apply { setPadding(0, dp(4), 0, 0) }
        addButtons.addView(button(context.getString(R.string.overlay_add_click)) { actions.addClickStep() })
        addButtons.addView(button(context.getString(R.string.overlay_add_pause)) { actions.addPauseStep() })
        page.addView(addButtons)
        return page
    }

    /** One line per step: name, [−] time [+], pick the point on the screen, delete. */
    private fun rebuildSteps(steps: List<PanelStep>) {
        stepList.removeAllViews()
        stepTimes.clear()
        if (steps.isEmpty()) {
            stepList.addView(text(11f, MUTED).apply { text = context.getString(R.string.overlay_no_steps) })
            return
        }
        steps.forEachIndexed { index, step ->
            val line = row().apply {
                gravity = Gravity.CENTER_VERTICAL
                setPadding(0, dp(2), 0, dp(2))
            }
            line.addView(text(11f, Color.WHITE).apply {
                text = step.label
                singleLine()
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            })
            val value = valueText(STEP_VALUE_WIDTH_DP)
            stepTimes += value
            line.addView(repeatButton("−") { actions.changeStepTime(index, -TIME_STEP_MS) })
            line.addView(value)
            line.addView(repeatButton("+") { actions.changeStepTime(index, TIME_STEP_MS) })
            line.addView(smallButton("◎") { actions.pickStepPoint(index) }.apply { contentDescription = context.getString(R.string.overlay_pick_point) })
            line.addView(smallButton("✕") { actions.deleteStep(index) }.apply { contentDescription = context.getString(R.string.overlay_delete_step) })
            stepList.addView(line)
        }
    }

    private fun buildSettingsPage(): View {
        val page = column()
        threshold = valueText(VALUE_WIDTH_DP)
        globalDelay = valueText(VALUE_WIDTH_DP)
        captureInterval = valueText(VALUE_WIDTH_DP)
        stableFrames = valueText(VALUE_WIDTH_DP)
        cooldown = valueText(VALUE_WIDTH_DP)
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
                .apply { topMargin = dp(4) }
            page.addView(toggle)
        }
        return scroll(page, MAX_PAGE_HEIGHT_DP)
    }

    /** One line: label, then [−] value [+]; holding a button repeats it. */
    private fun setting(page: LinearLayout, label: Int, value: TextView, minus: () -> Unit, plus: () -> Unit) {
        val line = row().apply {
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(2), 0, dp(2))
        }
        line.addView(text(11f, MUTED).apply {
            text = context.getString(label)
            singleLine()
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        })
        line.addView(repeatButton("−", minus))
        line.addView(value)
        line.addView(repeatButton("+", plus))
        page.addView(line)
    }

    private fun select(selected: Tab) {
        pages.forEach { (t, page) -> page.visibility = if (t == selected) View.VISIBLE else View.GONE }
        tabButtons.forEach { (t, b) ->
            (b.background as GradientDrawable).setColor(if (t == selected) context.getColor(R.color.brand_primary) else BUTTON)
        }
    }

    private fun setMinimized(minimized: Boolean) {
        panel.visibility = if (minimized) View.GONE else View.VISIBLE
        bubble.visibility = if (minimized) View.VISIBLE else View.GONE
    }

    /** Dragging moves the window; a tap without movement calls [onTap]. */
    @SuppressLint("ClickableViewAccessibility")
    private fun attachDrag(handle: View, onTap: () -> Unit) {
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
                        onTap()
                    }
                    true
                }
                else -> false
            }
        }
    }

    private fun toggleLabel(label: Int, on: Boolean) = "${if (on) "✓" else "✗"} ${context.getString(label)}"

    private fun TextView.showText(value: String?) {
        text = value.orEmpty()
        visibility = if (value == null) View.GONE else View.VISIBLE
    }

    private fun View.visibleIf(visible: Boolean) {
        visibility = if (visible) View.VISIBLE else View.GONE
    }

    private fun TextView.singleLine() {
        maxLines = 1
        ellipsize = TextUtils.TruncateAt.END
    }

    private fun column() = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }

    private fun row() = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }

    private fun scroll(content: View, maxHeightDp: Int) = MaxHeightScrollView(context, dp(maxHeightDp)).apply { addView(content) }

    private fun valueText(widthDp: Int) = text(12f, Color.WHITE, bold = true).apply {
        gravity = Gravity.CENTER
        singleLine()
        layoutParams = LinearLayout.LayoutParams(dp(widthDp), ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    private fun text(sizeSp: Float, color: Int, bold: Boolean = false) = TextView(context).apply {
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
        setTextColor(color)
        maxWidth = dp(BODY_WIDTH_DP)
        if (bold) typeface = Typeface.DEFAULT_BOLD
    }

    private fun button(label: String, onClick: () -> Unit) = TextView(context).apply {
        text = label
        setTextColor(Color.WHITE)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
        setPadding(dp(10), dp(5), dp(10), dp(5))
        minHeight = dp(32)
        gravity = Gravity.CENTER
        maxLines = 1
        background = GradientDrawable().apply {
            cornerRadius = dp(8).toFloat()
            setColor(BUTTON)
        }
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { marginEnd = dp(4) }
        isClickable = true
        setOnClickListener { onClick() }
    }

    /** Square icon-sized button for −, +, ◀, ▶, ✕ and the like. */
    private fun smallButton(label: String, onClick: () -> Unit) = button(label, onClick).apply {
        setPadding(0, 0, 0, 0)
        minWidth = dp(SMALL_BUTTON_DP)
        minHeight = dp(SMALL_BUTTON_DP)
        (layoutParams as LinearLayout.LayoutParams).marginEnd = dp(3)
    }

    /** Acts once on press and then repeatedly while held, so large changes do not need many taps. */
    @SuppressLint("ClickableViewAccessibility")
    private fun repeatButton(label: String, onStep: () -> Unit) = smallButton(label, onStep).apply {
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
        val STOPPED = Color.rgb(0x4A, 0x47, 0x66)
        val PAUSED = Color.rgb(0xC7, 0x7C, 0x1E)
        val CLICKING = Color.rgb(0xE5, 0x48, 0x4D)
        const val BODY_WIDTH_DP = 264
        const val BUBBLE_DP = 52
        const val SMALL_BUTTON_DP = 30
        const val VALUE_WIDTH_DP = 64
        const val STEP_VALUE_WIDTH_DP = 58

        /** Tall pages scroll inside the panel instead of covering the game's result row. */
        const val MAX_PAGE_HEIGHT_DP = 200
        const val MAX_STEPS_HEIGHT_DP = 150
        const val TIME_STEP_MS = 50L
        const val COOLDOWN_STEP_MS = 250L
        const val REPEAT_START_MS = 400L
        const val REPEAT_INTERVAL_MS = 80L
    }
}
