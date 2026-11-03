package app.coefmonitor.monitor

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.TextUtils
import android.util.DisplayMetrics
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.VelocityTracker
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
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
    /** The last coefficient is above 10.00x: shown in yellow. */
    val coefficientHighlighted: Boolean,
    val statusLine: String,
    /** Guarded start progress; null while it is off. */
    val guardLine: String?,
    /** The balance seen at the start is not the expected one: offer to go on with it. */
    val balancePrompt: Boolean,
    val warning: String?,
    /** Recent event lines; coefficients above 10.00x are already coloured yellow. */
    val log: List<CharSequence>,
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
    fun acceptBalance()
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
 * Floating window over every app (requires the "display over other apps" permission), drawn like
 * a pop-up window on recent Android versions: a rounded card with a thin bar at the top centre to
 * move it, edges and corners to resize it, and three tabs (status and controls, the algorithms with
 * their clicks, the settings). Thrown (or dragged past) the left or right edge, or with –, it
 * docks there: only a slim tab with the active algorithm's number stays at the edge; tap it or pull
 * it out to open the window again. Position, size and the docked side are remembered.
 *
 * It is not focusable, so it never blocks system navigation. Keep it away from the tile row
 * (anything drawn over the observed tile is captured too) and from the click points (an auto-click
 * there would land on the window).
 */
class OverlayController(
    private val context: Context,
    private val actions: OverlayActions,
) {
    private enum class Tab { STATUS, ALGORITHM, SETTINGS }

    private enum class Side { LEFT, RIGHT }

    private val windowManager = context.getSystemService(WindowManager::class.java)
    private val repeatHandler = Handler(Looper.getMainLooper())
    private val style = OverlayStyle(context)
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private var root: PanelFrame? = null
    private var params: WindowManager.LayoutParams? = null
    private var stepsKey: String? = null
    private var animator: ValueAnimator? = null

    /** The window's size while open, in pixels. */
    private var panelWidth = 0
    private var panelHeight = 0

    /** Where the open window was before it docked, so it opens there again. */
    private var panelY = 0
    private var docked: Side? = null

    private lateinit var panel: LinearLayout
    private lateinit var edgeTab: TextView
    private lateinit var title: TextView
    private val tabButtons = mutableMapOf<Tab, TextView>()
    private val pages = mutableMapOf<Tab, View>()

    // Status tab
    private lateinit var name: TextView
    private lateinit var coefficient: TextView
    private lateinit var status: TextView
    private lateinit var guard: TextView
    private lateinit var warning: TextView
    private lateinit var clickLine: TextView
    private lateinit var log: TextView
    private lateinit var startButton: TextView
    private lateinit var pauseButton: TextView
    private lateinit var stopButton: TextView
    private lateinit var findRowButton: TextView
    private lateinit var acceptBalanceButton: TextView
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
        val (screenWidth, screenHeight) = screenSize()
        panelWidth = prefs.getInt(KEY_WIDTH, dp(DEFAULT_WIDTH_DP)).coerceIn(dp(MIN_WIDTH_DP), screenWidth)
        panelHeight = prefs.getInt(KEY_HEIGHT, dp(DEFAULT_HEIGHT_DP)).coerceIn(dp(MIN_HEIGHT_DP), screenHeight)
        panelY = prefs.getInt(KEY_Y, dp(40)).coerceIn(0, (screenHeight - dp(BAR_DP)).coerceAtLeast(0))
        docked = prefs.getString(KEY_DOCKED, null)?.let { saved -> Side.entries.firstOrNull { it.name == saved } }
        val view = buildView()
        val layoutParams = WindowManager.LayoutParams(
            panelWidth,
            panelHeight,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            // May reach past the screen edge while it is thrown to dock there.
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = prefs.getInt(KEY_X, dp(12)).coerceIn(0, (screenWidth - panelWidth).coerceAtLeast(0))
            y = panelY
        }
        return try {
            windowManager.addView(view, layoutParams)
            root = view
            params = layoutParams
            docked?.let { side -> showDocked(side, animate = false) }
            true
        } catch (e: RuntimeException) {
            false
        }
    }

    fun hide() {
        animator?.cancel()
        repeatHandler.removeCallbacksAndMessages(null)
        root?.let { runCatching { windowManager.removeView(it) } }
        root = null
        params = null
    }

    /** Hides the whole window (e.g. while a click point is picked on the screen) without closing it. */
    fun setHidden(hidden: Boolean) {
        root?.visibility = if (hidden) View.GONE else View.VISIBLE
    }

    fun update(state: OverlayState) {
        if (root == null) return
        title.text = state.title
        edgeTab.text = state.bubbleText

        name.text = state.algorithmName
        coefficient.text = state.coefficientLine
        coefficient.setTextColor(if (state.coefficientHighlighted) OverlayStyle.BIG else OverlayStyle.TEXT)
        status.text = state.statusLine
        guard.showText(state.guardLine)
        warning.showText(state.warning)
        clickLine.showText(state.clickLine)
        log.showText(state.log.takeIf { it.isNotEmpty() }?.let { TextUtils.join("\n", it) })
        startButton.visibleIf(!state.captureActive)
        pauseButton.visibleIf(state.captureActive)
        stopButton.visibleIf(state.captureActive)
        findRowButton.visibleIf(state.captureActive && !state.balancePrompt)
        acceptBalanceButton.visibleIf(state.balancePrompt)
        pauseButton.text = context.getString(if (state.paused) R.string.action_resume else R.string.action_pause)
        clicksButton.text = context.getString(if (state.clicksRunning) R.string.overlay_stop_clicks else R.string.overlay_clicks_button)
        (edgeTab.background as GradientDrawable).setColor(
            when {
                state.clicksRunning -> OverlayStyle.DANGER
                !state.captureActive -> OverlayStyle.STOPPED
                state.paused -> OverlayStyle.WARNING
                else -> OverlayStyle.ACCENT_DEEP
            },
        )
        clicksButton.setTextColor(if (state.clicksRunning) OverlayStyle.DANGER else OverlayStyle.TEXT)

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
        autoClickToggle.showToggle(R.string.auto_click, state.autoClickEnabled)
        notificationsToggle.showToggle(R.string.round_notifications, state.roundNotifications)
        accessibilityButton.visibleIf(!state.clickerConnected)
    }

    private fun buildView(): PanelFrame {
        val container = PanelFrame(context, dp(EDGE_TOUCH_DP), ::onResize)
        panel = column().apply {
            setPadding(dp(12), 0, dp(12), dp(12))
            background = style.card(CORNER_DP)
            elevation = dp(12).toFloat()
            clipToOutline = true
        }

        // The top: a thin bar in the middle to move the window, – (dock) and ✕ at the sides.
        val bar = FrameLayout(context).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(BAR_DP))
            contentDescription = context.getString(R.string.overlay_drag_hint)
        }
        bar.addView(
            View(context).apply {
                background = style.pill(OverlayStyle.HANDLE)
            },
            FrameLayout.LayoutParams(dp(HANDLE_WIDTH_DP), dp(HANDLE_HEIGHT_DP), Gravity.CENTER),
        )
        bar.addView(
            barButton("–") { dock(nearestSide()) }.apply { contentDescription = context.getString(R.string.overlay_minimize) },
            FrameLayout.LayoutParams(dp(BAR_BUTTON_DP), dp(BAR_BUTTON_DP), Gravity.START or Gravity.CENTER_VERTICAL),
        )
        bar.addView(
            barButton("✕") { actions.close() }.apply { contentDescription = context.getString(R.string.action_close) },
            FrameLayout.LayoutParams(dp(BAR_BUTTON_DP), dp(BAR_BUTTON_DP), Gravity.END or Gravity.CENTER_VERTICAL),
        )
        attachMove(bar)
        panel.addView(bar)

        // Segmented control: a dark track with the selected tab raised on it.
        val tabs = row().apply {
            setPadding(dp(3), dp(3), dp(3), dp(3))
            background = style.pill(OverlayStyle.TRACK)
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                .apply { bottomMargin = dp(10) }
        }
        listOf(
            Tab.STATUS to R.string.overlay_tab_status,
            Tab.ALGORITHM to R.string.overlay_tab_algorithm,
            Tab.SETTINGS to R.string.overlay_tab_settings,
        ).forEach { (t, label) ->
            val b = style.text(11.5f, OverlayStyle.MUTED, style.medium).apply {
                text = context.getString(label)
                gravity = Gravity.CENTER
                minHeight = dp(26)
                singleLine()
                // A narrow window shrinks the labels instead of cutting them.
                setAutoSizeTextTypeUniformWithConfiguration(8, 11, 1, TypedValue.COMPLEX_UNIT_SP)
                background = style.pill(Color.TRANSPARENT)
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                isClickable = true
                setOnClickListener { select(t) }
            }
            tabButtons[t] = b
            tabs.addView(b)
        }
        panel.addView(tabs)

        // The pages fill the rest of the window and scroll inside it, whatever its size.
        val pagesHost = FrameLayout(context).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f)
        }
        pages[Tab.STATUS] = page(buildStatusPage())
        pages[Tab.ALGORITHM] = page(buildAlgorithmPage())
        pages[Tab.SETTINGS] = page(buildSettingsPage())
        pages.values.forEach(pagesHost::addView)
        panel.addView(pagesHost)
        select(Tab.STATUS)

        // Docked: a slim tab at the screen edge with the active algorithm's number.
        edgeTab = text(12f, Color.WHITE, bold = true).apply {
            gravity = Gravity.CENTER
            elevation = dp(8).toFloat()
            background = GradientDrawable().apply { setColor(OverlayStyle.STOPPED) }
            contentDescription = context.getString(R.string.overlay_expand)
            visibility = View.GONE
        }
        attachEdgeTab(edgeTab)
        container.addView(panel, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        container.addView(edgeTab, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        return container
    }

    // ---- Moving, throwing to an edge, resizing --------------------------------------------

    /** Dragging the top bar moves the window; thrown (or dragged far enough) past a side edge, it docks there. */
    @SuppressLint("ClickableViewAccessibility")
    private fun attachMove(handle: View) {
        var startX = 0
        var startY = 0
        var touchX = 0f
        var touchY = 0f
        var tracker: VelocityTracker? = null
        handle.setOnTouchListener { _, event ->
            val p = params ?: return@setOnTouchListener false
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    animator?.cancel()
                    startX = p.x
                    startY = p.y
                    touchX = event.rawX
                    touchY = event.rawY
                    tracker = VelocityTracker.obtain().also { it.addMovement(event) }
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    tracker?.addMovement(event)
                    val (screenWidth, screenHeight) = screenSize()
                    // Half the window may leave the screen sideways: that far it docks when let go.
                    p.x = (startX + event.rawX - touchX).toInt().coerceIn(-p.width / 2, screenWidth - p.width / 2)
                    p.y = (startY + event.rawY - touchY).toInt().coerceIn(0, (screenHeight - dp(BAR_DP)).coerceAtLeast(0))
                    relayout()
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    val velocity = tracker?.let {
                        it.addMovement(event)
                        it.computeCurrentVelocity(1_000)
                        it.xVelocity
                    } ?: 0f
                    tracker?.recycle()
                    tracker = null
                    val (screenWidth, _) = screenSize()
                    val fling = dp(FLING_DP_PER_S)
                    when {
                        velocity < -fling || p.x < -p.width / 4 -> dock(Side.LEFT)
                        velocity > fling || p.x + p.width > screenWidth + p.width / 4 -> dock(Side.RIGHT)
                        else -> {
                            animateX(p.x.coerceIn(0, (screenWidth - p.width).coerceAtLeast(0)))
                            panelY = p.y
                            savePlace()
                        }
                    }
                    true
                }
                else -> false
            }
        }
    }

    /** The docked tab: a tap or a pull away from the edge opens the window again; dragging along the edge moves it. */
    @SuppressLint("ClickableViewAccessibility")
    private fun attachEdgeTab(tab: View) {
        var startY = 0
        var touchX = 0f
        var touchY = 0f
        var moved = false
        tab.setOnTouchListener { view, event ->
            val p = params ?: return@setOnTouchListener false
            val side = docked ?: return@setOnTouchListener false
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    startY = p.y
                    touchX = event.rawX
                    touchY = event.rawY
                    moved = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - touchX
                    val dy = event.rawY - touchY
                    val pulledOut = if (side == Side.LEFT) dx > dp(PULL_OUT_DP) else dx < -dp(PULL_OUT_DP)
                    if (pulledOut) {
                        undock()
                        return@setOnTouchListener true
                    }
                    if (abs(dy) > dp(4)) moved = true
                    if (moved) {
                        p.y = (startY + dy).toInt().coerceIn(0, (screenSize().second - p.height).coerceAtLeast(0))
                        relayout()
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (docked == null) return@setOnTouchListener true
                    if (moved) {
                        panelY = p.y
                        savePlace()
                    } else {
                        view.performClick()
                        undock()
                    }
                    true
                }
                else -> false
            }
        }
    }

    /** Throws the window to [side]: it slides out of the screen and only the tab stays at the edge. */
    private fun dock(side: Side) {
        val p = params ?: return
        if (docked != null) return
        panelY = p.y
        val (screenWidth, _) = screenSize()
        val outside = if (side == Side.LEFT) -p.width else screenWidth
        animateX(outside) { showDocked(side, animate = true) }
    }

    private fun showDocked(side: Side, animate: Boolean) {
        val p = params ?: return
        docked = side
        root?.resizable = false
        val (screenWidth, screenHeight) = screenSize()
        panel.visibility = View.GONE
        edgeTab.visibility = View.VISIBLE
        val radius = dp(TAB_RADIUS_DP).toFloat()
        // Rounded on the side that faces the screen, flush with the edge.
        (edgeTab.background as GradientDrawable).cornerRadii = if (side == Side.LEFT) {
            floatArrayOf(0f, 0f, radius, radius, radius, radius, 0f, 0f)
        } else {
            floatArrayOf(radius, radius, 0f, 0f, 0f, 0f, radius, radius)
        }
        p.width = dp(TAB_WIDTH_DP)
        p.height = dp(TAB_HEIGHT_DP)
        p.y = (panelY + dp(BAR_DP)).coerceIn(0, (screenHeight - p.height).coerceAtLeast(0))
        val target = if (side == Side.LEFT) 0 else screenWidth - p.width
        if (animate) {
            p.x = if (side == Side.LEFT) -p.width else screenWidth
            relayout()
            animateX(target)
        } else {
            p.x = target
            relayout()
        }
        savePlace()
    }

    /** Opens the docked window again next to its edge, sliding in. */
    private fun undock() {
        val p = params ?: return
        val side = docked ?: return
        docked = null
        root?.resizable = true
        val (screenWidth, screenHeight) = screenSize()
        edgeTab.visibility = View.GONE
        panel.visibility = View.VISIBLE
        p.width = panelWidth.coerceAtMost(screenWidth)
        p.height = panelHeight.coerceAtMost(screenHeight)
        p.y = (p.y - dp(BAR_DP)).coerceIn(0, (screenHeight - p.height).coerceAtLeast(0))
        panelY = p.y
        p.x = if (side == Side.LEFT) -p.width else screenWidth
        relayout()
        animateX(if (side == Side.LEFT) dp(MARGIN_DP) else screenWidth - p.width - dp(MARGIN_DP))
        savePlace()
    }

    private fun nearestSide(): Side {
        val p = params ?: return Side.RIGHT
        return if (p.x + p.width / 2 < screenSize().first / 2) Side.LEFT else Side.RIGHT
    }

    /**
     * Resizing from an edge or a corner ([PanelFrame] found which): the opposite edges stay where
     * they are, within the screen and above the smallest size.
     */
    private fun onResize(phase: PanelFrame.Phase, edges: Int, dx: Float, dy: Float) {
        val p = params ?: return
        when (phase) {
            PanelFrame.Phase.START -> {
                animator?.cancel()
                resizeFrom = intArrayOf(p.x, p.y, p.width, p.height)
                panel.background = style.card(CORNER_DP, OverlayStyle.ACCENT)
            }
            PanelFrame.Phase.MOVE -> {
                val (x0, y0, w0, h0) = resizeFrom
                val (screenWidth, screenHeight) = screenSize()
                val minW = dp(MIN_WIDTH_DP)
                val minH = dp(MIN_HEIGHT_DP)
                if (edges and PanelFrame.RIGHT != 0) p.width = (w0 + dx.toInt()).coerceIn(minW, screenWidth - x0.coerceAtLeast(0))
                if (edges and PanelFrame.LEFT != 0) {
                    val right = x0 + w0
                    p.width = (w0 - dx.toInt()).coerceIn(minW, right.coerceAtMost(screenWidth))
                    p.x = right - p.width
                }
                if (edges and PanelFrame.BOTTOM != 0) p.height = (h0 + dy.toInt()).coerceIn(minH, screenHeight - y0)
                if (edges and PanelFrame.TOP != 0) {
                    val bottom = y0 + h0
                    p.height = (h0 - dy.toInt()).coerceIn(minH, bottom)
                    p.y = bottom - p.height
                }
                relayout()
            }
            PanelFrame.Phase.END -> {
                panel.background = style.card(CORNER_DP)
                panelWidth = p.width
                panelHeight = p.height
                panelY = p.y
                savePlace()
            }
        }
    }

    private var resizeFrom = intArrayOf(0, 0, 0, 0)

    private fun animateX(target: Int, then: () -> Unit = {}) {
        val p = params ?: return
        animator?.cancel()
        animator = ValueAnimator.ofInt(p.x, target).apply {
            duration = SLIDE_MS
            interpolator = DecelerateInterpolator()
            addUpdateListener {
                params?.x = it.animatedValue as Int
                relayout()
            }
            addListener(object : AnimatorListenerAdapter() {
                private var cancelled = false

                override fun onAnimationCancel(animation: Animator) {
                    cancelled = true
                }

                override fun onAnimationEnd(animation: Animator) {
                    if (!cancelled && root != null) then()
                }
            })
            start()
        }
    }

    private fun relayout() {
        val p = params ?: return
        root?.let { runCatching { windowManager.updateViewLayout(it, p) } }
    }

    private fun savePlace() {
        val p = params ?: return
        prefs.edit()
            .putInt(KEY_WIDTH, panelWidth)
            .putInt(KEY_HEIGHT, panelHeight)
            .putInt(KEY_Y, panelY)
            .putInt(KEY_X, if (docked == null) p.x else prefs.getInt(KEY_X, dp(12)))
            .putString(KEY_DOCKED, docked?.name)
            .apply()
    }

    @Suppress("DEPRECATION")
    private fun screenSize(): Pair<Int, Int> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            windowManager.currentWindowMetrics.bounds.let { it.width() to it.height() }
        } else {
            DisplayMetrics().also { windowManager.defaultDisplay.getRealMetrics(it) }.let { it.widthPixels to it.heightPixels }
        }

    private fun buildStatusPage(): View {
        val page = column()
        title = text(13f, OverlayStyle.TEXT, bold = true).apply { singleLine() }
        name = text(12f, OverlayStyle.MUTED).apply { singleLine() }
        coefficient = text(22f, OverlayStyle.TEXT, bold = true).apply { setPadding(0, dp(4), 0, dp(4)) }
        status = text(11f, OverlayStyle.MUTED)
        guard = text(11f, OverlayStyle.TEXT, bold = true).apply { setPadding(0, dp(4), 0, 0) }
        clickLine = text(12f, OverlayStyle.ACCENT, bold = true).apply { setPadding(0, dp(4), 0, 0) }
        warning = text(11f, OverlayStyle.WARNING).apply { setPadding(0, dp(4), 0, 0) }
        log = text(10.5f, OverlayStyle.MUTED).apply {
            setPadding(0, dp(6), 0, 0)
            setLineSpacing(dp(2).toFloat(), 1f)
        }
        listOf(title, name, coefficient, status, guard, clickLine, warning, log).forEach(page::addView)
        val monitorButtons = row().apply { setPadding(0, dp(10), 0, 0) }
        startButton = button(context.getString(R.string.overlay_start), primary = true) { actions.startMonitoring() }
        pauseButton = button(context.getString(R.string.action_pause)) { actions.pauseResume() }
        stopButton = button(context.getString(R.string.action_stop)) { actions.stopMonitoring() }
        findRowButton = button(context.getString(R.string.overlay_find_row)) { actions.findRow() }
        acceptBalanceButton = button(context.getString(R.string.action_continue), primary = true) { actions.acceptBalance() }
        listOf(startButton, pauseButton, stopButton, findRowButton, acceptBalanceButton).forEach(monitorButtons::addView)
        page.addView(monitorButtons)
        val clickButtons = row().apply { setPadding(0, dp(6), 0, 0) }
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
        viewedTitle = text(13f, OverlayStyle.TEXT, bold = true).apply {
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            singleLine()
        }
        selector.addView(viewedTitle)
        selector.addView(smallButton("▶") { actions.browseAlgorithm(1) }.apply { contentDescription = context.getString(R.string.overlay_next) })
        page.addView(selector)
        viewedName = text(12f, OverlayStyle.MUTED).apply {
            gravity = Gravity.CENTER
            setPadding(0, dp(4), 0, dp(8))
            singleLine()
        }
        page.addView(viewedName)
        val algorithmButtons = row()
        activateButton = button(context.getString(R.string.overlay_activate)) { actions.activateViewed() }
        algorithmButtons.addView(activateButton)
        algorithmButtons.addView(button("↺ 1") { actions.resetToFirst() }.apply { contentDescription = context.getString(R.string.overlay_reset_to_first) })
        algorithmButtons.addView(button(context.getString(R.string.overlay_add_algorithm)) { actions.addAlgorithm() })
        page.addView(algorithmButtons)
        page.addView(caption(context.getString(R.string.overlay_step_times)))
        stepList = column()
        page.addView(stepList)
        val addButtons = row().apply { setPadding(0, dp(8), 0, 0) }
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
            stepList.addView(text(11f, OverlayStyle.MUTED).apply { text = context.getString(R.string.overlay_no_steps) })
            return
        }
        steps.forEachIndexed { index, step ->
            val line = row().apply {
                gravity = Gravity.CENTER_VERTICAL
                setPadding(0, dp(2), 0, dp(2))
            }
            line.addView(text(11.5f, OverlayStyle.TEXT).apply {
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
                .apply { topMargin = dp(6) }
            page.addView(toggle)
        }
        return page
    }

    /** One line: label, then [−] value [+]; holding a button repeats it. */
    private fun setting(page: LinearLayout, label: Int, value: TextView, minus: () -> Unit, plus: () -> Unit) {
        val line = row().apply {
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(3), 0, dp(3))
        }
        line.addView(text(11.5f, OverlayStyle.MUTED).apply {
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
            (b.background as GradientDrawable).setColor(if (t == selected) OverlayStyle.CHIP_SELECTED else Color.TRANSPARENT)
            b.setTextColor(if (t == selected) OverlayStyle.TEXT else OverlayStyle.MUTED)
        }
    }

    /** A switch as a chip: accent-tinted with a check while on, plain while off. */
    private fun TextView.showToggle(label: Int, on: Boolean) {
        text = "${if (on) "✓" else "✗"} ${context.getString(label)}"
        setTextColor(if (on) OverlayStyle.ACCENT else OverlayStyle.MUTED)
        (background as GradientDrawable).setColor(if (on) OverlayStyle.ACCENT_SOFT else OverlayStyle.CHIP)
    }

    /** Small uppercase label above a group, like the section titles in the app. */
    private fun caption(label: String) = text(10.5f, OverlayStyle.MUTED).apply {
        text = label.uppercase()
        letterSpacing = 0.08f
        setPadding(0, dp(12), 0, dp(4))
    }

    private fun TextView.showText(value: CharSequence?) {
        text = value ?: ""
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

    /** A tab's page: fills the window below the tabs and scrolls when its content is taller. */
    private fun page(content: View) = ScrollView(context).apply {
        isVerticalScrollBarEnabled = false
        overScrollMode = View.OVER_SCROLL_NEVER
        addView(content, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    }

    private fun valueText(widthDp: Int) = text(12.5f, OverlayStyle.TEXT, bold = true).apply {
        gravity = Gravity.CENTER
        singleLine()
        layoutParams = LinearLayout.LayoutParams(dp(widthDp), ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    private fun text(sizeSp: Float, color: Int, bold: Boolean = false) =
        style.text(sizeSp, color, if (bold) style.semibold else style.regular)

    private fun button(label: String, primary: Boolean = false, onClick: () -> Unit) = style.button(label, primary, onClick).apply {
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { marginEnd = dp(6) }
    }

    /** Round icon-sized button for −, +, ◀, ▶, ✕ and the like. */
    private fun smallButton(label: String, onClick: () -> Unit) = button(label, onClick = onClick).apply {
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
        setPadding(0, 0, 0, 0)
        minWidth = dp(SMALL_BUTTON_DP)
        minHeight = dp(SMALL_BUTTON_DP)
        (layoutParams as LinearLayout.LayoutParams).marginEnd = dp(4)
    }

    /** – and ✕ on the top bar: just the glyph, muted, no fill. */
    private fun barButton(label: String, onClick: () -> Unit) = style.text(13f, OverlayStyle.MUTED, style.medium).apply {
        text = label
        gravity = Gravity.CENTER
        isClickable = true
        setOnClickListener { onClick() }
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

    private fun dp(value: Int): Int = style.dp(value)

    private companion object {
        const val PREFS = "floating_window"
        const val KEY_X = "x"
        const val KEY_Y = "y"
        const val KEY_WIDTH = "width"
        const val KEY_HEIGHT = "height"
        const val KEY_DOCKED = "docked"

        const val DEFAULT_WIDTH_DP = 288
        const val DEFAULT_HEIGHT_DP = 340
        const val MIN_WIDTH_DP = 200
        const val MIN_HEIGHT_DP = 150
        const val CORNER_DP = 24

        /** The top bar and its handle: a short thin line in the middle. */
        const val BAR_DP = 28
        const val HANDLE_WIDTH_DP = 36
        const val HANDLE_HEIGHT_DP = 4
        const val BAR_BUTTON_DP = 28

        /** Touches this close to an edge resize the window. */
        const val EDGE_TOUCH_DP = 14

        /** The tab left at the screen edge while docked, and how far it is pulled to open. */
        const val TAB_WIDTH_DP = 20
        const val TAB_HEIGHT_DP = 56
        const val TAB_RADIUS_DP = 12
        const val PULL_OUT_DP = 16
        const val MARGIN_DP = 8

        /** A throw at least this fast (dp per second) docks the window at that side. */
        const val FLING_DP_PER_S = 1_000
        const val SLIDE_MS = 220L

        const val SMALL_BUTTON_DP = 28
        const val VALUE_WIDTH_DP = 64
        const val STEP_VALUE_WIDTH_DP = 58
        const val TIME_STEP_MS = 50L
        const val COOLDOWN_STEP_MS = 250L
        const val REPEAT_START_MS = 400L
        const val REPEAT_INTERVAL_MS = 80L
    }
}

/**
 * The floating window's root. A touch that starts on an edge or a corner resizes the window
 * instead of reaching the content (the top edge only at its corners: its middle is the bar that
 * moves the window). [onResize] gets the edges ([LEFT], [RIGHT], [TOP], [BOTTOM]) and how far the
 * finger moved since it went down.
 */
private class PanelFrame(
    context: Context,
    private val edgePx: Int,
    private val onResize: (Phase, Int, Float, Float) -> Unit,
) : FrameLayout(context) {
    enum class Phase { START, MOVE, END }

    /** Off while docked: the tab is not resized. */
    var resizable = true

    private var edges = 0
    private var downX = 0f
    private var downY = 0f

    override fun onInterceptTouchEvent(event: MotionEvent): Boolean {
        if (event.actionMasked != MotionEvent.ACTION_DOWN) return edges != 0
        edges = if (resizable) edgesAt(event.x, event.y) else 0
        if (edges == 0) return false
        downX = event.rawX
        downY = event.rawY
        onResize(Phase.START, edges, 0f, 0f)
        return true
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (edges == 0) return super.onTouchEvent(event)
        when (event.actionMasked) {
            MotionEvent.ACTION_MOVE -> onResize(Phase.MOVE, edges, event.rawX - downX, event.rawY - downY)
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                onResize(Phase.END, edges, 0f, 0f)
                edges = 0
            }
        }
        return true
    }

    private fun edgesAt(x: Float, y: Float): Int {
        val left = x < edgePx
        val right = x > width - edgePx
        var found = 0
        if (left) found = found or LEFT
        if (right) found = found or RIGHT
        if (y > height - edgePx) found = found or BOTTOM
        if (y < edgePx && (left || right)) found = found or TOP
        return found
    }

    companion object {
        const val LEFT = 1
        const val RIGHT = 2
        const val TOP = 4
        const val BOTTOM = 8
    }
}
