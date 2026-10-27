package app.coefmonitor.monitor

import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.provider.Settings
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import app.coefmonitor.R
import app.coefmonitor.appContainer
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.Continuity
import app.coefmonitor.core.DelayPolicy
import app.coefmonitor.core.DetectorConfig
import app.coefmonitor.data.AppSettings
import app.coefmonitor.data.StoredAlgorithm
import app.coefmonitor.data.db.EventEntity
import app.coefmonitor.data.db.MonitorStateEntity
import app.coefmonitor.ui.CaptureConsentActivity
import app.coefmonitor.ui.Labels
import app.coefmonitor.ui.MainActivity
import app.coefmonitor.ui.accessibilitySettingsIntent
import app.coefmonitor.withAppLocale
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Floating mode: keeps the floating panel over every app until the user closes it, whether
 * monitoring runs or not. The panel shows the live status, starts and stops monitoring, runs the
 * auto-clicker, and holds the settings (active algorithm and its click times, threshold, delays,
 * capture interval, detection, switches). Turned on and off by [AppSettings.overlayEnabled].
 */
class FloatingPanelService : LifecycleService(), OverlayActions {

    private val container by lazy { appContainer }
    private var panel: OverlayController? = null
    private var inForeground = false
    private val stepEdits = Mutex()
    private var latest: Presentation? = null

    /** The active algorithm the panel shows; step time changes apply to it. */
    @Volatile
    private var shownAlgorithm: StoredAlgorithm? = null

    override fun onCreate() {
        super.onCreate()
        MonitorNotifications(this).ensureChannels()
        lifecycleScope.launch {
            container.settings.settings.collect { if (!it.overlayEnabled) stop() }
        }
        lifecycleScope.launch { observePresentation() }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        if (intent?.action == ACTION_CLOSE) {
            close()
            return START_NOT_STICKY
        }
        // Started with startForegroundService: Android requires startForeground even if we stop right away.
        if (!goForeground()) {
            stop()
            return START_NOT_STICKY
        }
        if (panel == null) {
            val controller = OverlayController(withAppLocale(), this)
            if (!controller.show()) {
                stop()
                return START_NOT_STICKY
            }
            panel = controller
            latest?.let(::render)
        }
        // Restarted by Android if it ever kills the process, so the panel does not just vanish.
        return START_STICKY
    }

    override fun onDestroy() {
        panel?.hide()
        panel = null
        super.onDestroy()
    }

    /** False if Android refuses (e.g. a restart while the app is in the background on newer versions). */
    private fun goForeground(): Boolean {
        if (inForeground) return true
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
        return try {
            ServiceCompat.startForeground(this, MonitorNotifications.ID_FLOATING, MonitorNotifications(this).floating(), type)
            inForeground = true
            true
        } catch (e: RuntimeException) {
            false
        }
    }

    private fun stop() {
        panel?.hide()
        panel = null
        if (inForeground) {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
            inForeground = false
        }
        stopSelf()
    }

    // ---- Panel content ----------------------------------------------------------------------

    private data class Presentation(
        val runtime: RuntimeState,
        val clickerConnected: Boolean,
        val state: MonitorStateEntity,
        val algorithms: List<StoredAlgorithm>,
        val recent: List<EventEntity>,
        val settings: AppSettings,
    )

    private suspend fun observePresentation() {
        combine(
            combine(container.runtime.state, AutoClickService.connected, ::Pair),
            container.monitor.state,
            container.algorithms.algorithms,
            container.events.recent(LOG_LINES),
            container.settings.settings,
        ) { (rt, clickerConnected), state, algorithms, recent, s ->
            Presentation(rt, clickerConnected, state, algorithms.filter { it.definition.enabled }, recent, s)
        }.collect { render(it) }
    }

    private fun render(p: Presentation) {
        latest = p
        val str = withAppLocale()
        val total = p.algorithms.size
        val index = if (total == 0) 0 else p.state.activeIndex.coerceIn(0, total - 1)
        val stored = p.algorithms.getOrNull(index)
        shownAlgorithm = stored
        val active = stored?.definition
        val title = if (total == 0) {
            str.getString(R.string.no_algorithms_short)
        } else {
            str.getString(R.string.algorithm_position, index + 1, total)
        }
        val lastValue = p.state.lastAcceptedHundredths?.let { Coefficient(it).toString() } ?: "—"
        val clickerOff = !p.clickerConnected && active?.steps?.any { it.point != null } == true
        val warning = when {
            p.runtime.calibrationProblem != null -> Labels.calibrationProblem(str, p.runtime.calibrationProblem)
            clickerOff -> str.getString(R.string.warning_auto_click_off)
            total > 0 && index == total - 1 -> str.getString(R.string.warning_last_algorithm)
            p.runtime.lastContinuity == Continuity.GAP_SUSPECTED -> str.getString(R.string.warning_gap)
            else -> null
        }
        val steps = active?.steps.orEmpty().mapIndexed { i, step ->
            val label = step.text.ifBlank { str.getString(if (step.point != null) R.string.overlay_step_click else R.string.overlay_step_pause) }
            val time = step.delayMs?.let { str.getString(R.string.delay_ms, it) }
                ?: str.getString(R.string.overlay_step_time_global, p.settings.globalDelayMs)
            PanelStep("${i + 1}. $label", time)
        }
        panel?.update(
            OverlayState(
                title = title,
                algorithmName = active?.name ?: "—",
                coefficientLine = str.getString(R.string.overlay_last_coefficient, lastValue),
                statusLine = "${Labels.status(str, p.runtime.status)} · ${Labels.ocrStatus(str, p.runtime.ocrStatus)}",
                warning = warning,
                log = p.recent.map { Labels.eventLine(str, it) },
                captureActive = p.runtime.captureActive,
                paused = p.runtime.status == MonitorStatus.PAUSED,
                clickLine = p.runtime.clicks?.let { str.getString(R.string.overlay_clicks, it.position, it.total, it.delayMs) },
                clicksRunning = p.runtime.clicks != null,
                steps = steps,
                stepsKey = "${stored?.id}:${steps.size}",
                threshold = p.settings.threshold.toString(),
                globalDelay = str.getString(R.string.delay_ms, p.settings.globalDelayMs),
                captureInterval = str.getString(R.string.delay_ms, p.settings.captureIntervalMs),
                stableFrames = p.settings.detector.requiredStableFrames.toString(),
                cooldown = str.getString(R.string.delay_ms, p.settings.detector.minRoundIntervalMs),
                autoClickEnabled = p.settings.autoClickEnabled,
                clickerConnected = p.clickerConnected,
                roundNotifications = p.settings.roundNotifications,
            ),
        )
    }

    // ---- Panel actions ----------------------------------------------------------------------

    override fun startMonitoring() {
        // Every capture session needs the system consent dialog, which only an activity can show.
        startActivity(Intent(this, CaptureConsentActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    override fun pauseResume() {
        val paused = container.runtime.state.value.status == MonitorStatus.PAUSED
        monitorCommand(if (paused) MonitoringService.ACTION_RESUME else MonitoringService.ACTION_PAUSE)
    }

    override fun stopMonitoring() = monitorCommand(MonitoringService.ACTION_STOP)

    private fun monitorCommand(action: String) {
        runCatching { MonitoringService.command(this, action) }
    }

    override fun runOrStopClicks() {
        if (container.runtime.state.value.clicks != null) {
            container.autoClicker.cancel()
        } else {
            lifecycleScope.launch { container.autoClicker.runActive() }
        }
    }

    override fun openApp() {
        startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP))
    }

    override fun openAccessibilitySettings() {
        startActivity(accessibilitySettingsIntent().addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    override fun close() {
        lifecycleScope.launch { container.settings.update { it.copy(overlayEnabled = false) } }
    }

    override fun selectAlgorithm(delta: Int) {
        lifecycleScope.launch {
            val total = container.algorithms.enabledCount()
            if (total == 0) return@launch
            val current = container.monitor.sequenceState().activeIndex
            val target = (current + delta).coerceIn(0, total - 1)
            if (target != current) container.monitor.selectAlgorithm(target)
        }
    }

    override fun resetToFirst() {
        lifecycleScope.launch { container.monitor.resetToFirst() }
    }

    override fun changeStepTime(stepIndex: Int, deltaMs: Long) {
        val id = shownAlgorithm?.id ?: return
        lifecycleScope.launch {
            // One edit at a time: holding a button sends many, each must see the previous one.
            stepEdits.withLock {
                val stored = container.algorithms.get(id) ?: return@withLock
                val steps = stored.definition.steps
                val step = steps.getOrNull(stepIndex) ?: return@withLock
                val globalDelayMs = container.settings.current().globalDelayMs
                val time = (DelayPolicy.effective(step, globalDelayMs) + deltaMs).coerceIn(DelayPolicy.MIN_MS, DelayPolicy.MAX_MS)
                val updated = steps.toMutableList().apply { set(stepIndex, step.copy(delayMs = time)) }
                container.algorithms.update(id, stored.definition.copy(steps = updated))
            }
        }
    }

    override fun changeThreshold(deltaHundredths: Long) = updateSettings {
        val hundredths = (it.threshold.hundredths + deltaHundredths)
            .coerceIn(Coefficient.MIN_THRESHOLD.hundredths, Coefficient.MAX_THRESHOLD.hundredths)
        it.copy(threshold = Coefficient(hundredths))
    }

    override fun changeGlobalDelay(deltaMs: Long) = updateSettings {
        it.copy(globalDelayMs = (it.globalDelayMs + deltaMs).coerceIn(DelayPolicy.MIN_MS, DelayPolicy.MAX_MS))
    }

    override fun changeCaptureInterval(deltaMs: Long) = updateSettings {
        val interval = (it.captureIntervalMs + deltaMs).coerceIn(AppSettings.MIN_CAPTURE_INTERVAL_MS, AppSettings.MAX_CAPTURE_INTERVAL_MS)
        it.copy(captureIntervalMs = interval)
    }

    override fun changeStableFrames(delta: Int) = updateSettings {
        val frames = (it.detector.requiredStableFrames + delta).coerceIn(DetectorConfig.MIN_STABLE_FRAMES, DetectorConfig.MAX_STABLE_FRAMES)
        it.copy(detector = it.detector.copy(requiredStableFrames = frames))
    }

    override fun changeCooldown(deltaMs: Long) = updateSettings {
        it.copy(detector = it.detector.copy(minRoundIntervalMs = it.detector.minRoundIntervalMs + deltaMs).sanitized())
    }

    override fun toggleAutoClick() = updateSettings { it.copy(autoClickEnabled = !it.autoClickEnabled) }

    override fun toggleRoundNotifications() = updateSettings { it.copy(roundNotifications = !it.roundNotifications) }

    private fun updateSettings(transform: (AppSettings) -> AppSettings) {
        lifecycleScope.launch { container.settings.update(transform) }
    }

    companion object {
        private const val ACTION_CLOSE = "app.coefmonitor.action.CLOSE_FLOATING"
        private const val LOG_LINES = 3

        /**
         * Starts or stops floating mode to match the setting. Starting needs the "display over other
         * apps" permission; without it nothing happens and Settings offers the permission.
         */
        fun sync(context: Context, enabled: Boolean) {
            val intent = Intent(context, FloatingPanelService::class.java)
            if (!enabled) {
                context.stopService(intent)
                return
            }
            if (!Settings.canDrawOverlays(context)) return
            // Android can refuse a foreground start while the app is in the background; the next
            // time the app or monitoring starts, this is called again.
            runCatching { ContextCompat.startForegroundService(context, intent) }
        }

        /** The notification's Close action. */
        fun closeIntent(context: Context): Intent = Intent(context, FloatingPanelService::class.java).setAction(ACTION_CLOSE)
    }
}
