package app.coefmonitor.monitor

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.SystemClock
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import app.coefmonitor.R
import app.coefmonitor.appContainer
import app.coefmonitor.core.CalibrationProblem
import app.coefmonitor.core.ClickPlan
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.Continuity
import app.coefmonitor.core.DelayPolicy
import app.coefmonitor.core.DetectorResult
import app.coefmonitor.core.FirstRoundPolicy
import app.coefmonitor.core.NewRoundDetector
import app.coefmonitor.core.ObservationCalibration
import app.coefmonitor.core.ObservationRegionManager
import app.coefmonitor.core.OcrReading
import app.coefmonitor.core.ProcessResult
import app.coefmonitor.core.RegionResolution
import app.coefmonitor.core.RejectionReason
import app.coefmonitor.core.RoundEvent
import app.coefmonitor.core.TransitionReason
import app.coefmonitor.data.AppSettings
import app.coefmonitor.data.DiagnosticLevel
import app.coefmonitor.data.StoredAlgorithm
import app.coefmonitor.data.db.EventEntity
import app.coefmonitor.data.db.MonitorStateEntity
import app.coefmonitor.data.db.enumOrDefault
import app.coefmonitor.ui.MainActivity
import app.coefmonitor.ui.Labels
import app.coefmonitor.withAppLocale
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Foreground service that owns the screen-capture session.
 *
 * Pipeline per tick: capture → crop tile right of "?" → signature/OCR → [NewRoundDetector] →
 * [app.coefmonitor.data.MonitorRepository.applyRound] (one transaction). Pause keeps the capture
 * session; Stop releases it. The sequence position is never touched here except through applyRound.
 */
class MonitoringService : LifecycleService() {

    enum class Mode { MONITOR, SNAPSHOT_ONLY }

    private val container by lazy { appContainer }
    private val runtime get() = container.runtime
    private lateinit var notifications: MonitorNotifications

    private var capturer: ScreenCapturer? = null
    private var ocr: CoefficientOcrEngine? = null
    private var loopJob: Job? = null
    private var snapshotJob: Job? = null
    private var overlay: OverlayController? = null
    private lateinit var clicker: AutoClickController
    private var mode = Mode.MONITOR
    private var inForeground = false
    private var detectorReady = false
    private var lastLoggedRejection: Pair<RejectionReason?, String>? = null
    private var clickerOffReported = false

    @Volatile
    private var settings = AppSettings()

    override fun onCreate() {
        super.onCreate()
        notifications = MonitorNotifications(this)
        notifications.ensureChannels()
        clicker = AutoClickController(
            scope = lifecycleScope,
            onProgress = { progress -> runtime.update { it.copy(clicks = progress) } },
            onFinished = ::reportClicks,
        )
        lifecycleScope.launch {
            container.settings.settings.collect {
                settings = it
                applyOverlaySetting(it)
            }
        }
        lifecycleScope.launch { observePresentation() }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        when (intent?.action) {
            ACTION_START -> handleStart(intent)
            ACTION_PAUSE -> pause()
            ACTION_RESUME -> resume()
            ACTION_STOP -> shutdown(error = null)
            ACTION_SNAPSHOT -> requestSnapshot(intent.getLongExtra(EXTRA_DELAY_MS, DEFAULT_SNAPSHOT_DELAY_MS))
            else -> stopIfIdle()
        }
        // Never restart automatically: a new capture session always needs fresh user consent.
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        if (::clicker.isInitialized) clicker.cancel()
        loopJob?.cancel()
        snapshotJob?.cancel()
        releaseCapture()
        ocr?.close()
        ocr = null
        hideOverlay()
        runtime.update {
            if (it.status == MonitorStatus.ERROR) it.copy(captureActive = false) else it.copy(status = MonitorStatus.STOPPED, captureActive = false, ocrStatus = OcrStatus.IDLE)
        }
        super.onDestroy()
    }

    private fun handleStart(intent: Intent) {
        mode = enumOrDefault(intent.getStringExtra(EXTRA_MODE), Mode.MONITOR)
        // Android 14+: the foreground service must be running before the projection is obtained.
        goForeground()
        loopJob?.cancel()
        releaseCapture()

        val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED)
        val data = IntentCompat.getParcelableExtra(intent, EXTRA_RESULT_DATA, Intent::class.java)
        val projection = if (resultCode == Activity.RESULT_OK && data != null) {
            runCatching { getSystemService(MediaProjectionManager::class.java).getMediaProjection(resultCode, data) }.getOrNull()
        } else {
            null
        }
        if (projection == null) {
            shutdown(MonitorError.CAPTURE_FAILED)
            return
        }
        val capture = ScreenCapturer(this, projection) { lifecycleScope.launch { onCaptureEnded() } }
        try {
            capture.start()
        } catch (e: RuntimeException) {
            capture.release()
            log(DiagnosticLevel.ERROR, "CAPTURE", "Could not start screen capture: ${e.message}")
            shutdown(MonitorError.CAPTURE_FAILED)
            return
        }
        capturer = capture
        runtime.update { it.copy(captureActive = true, error = null) }
        when (mode) {
            Mode.MONITOR -> startMonitoring()
            Mode.SNAPSHOT_ONLY -> requestSnapshot(intent.getLongExtra(EXTRA_DELAY_MS, DEFAULT_SNAPSHOT_DELAY_MS))
        }
    }

    private fun startMonitoring() {
        ocr?.close()
        ocr = CoefficientOcrEngine()
        runtime.update {
            it.copy(
                status = MonitorStatus.INITIALIZING,
                ocrStatus = OcrStatus.WAITING_FOR_SCREEN,
                error = null,
                calibrationProblem = null,
            )
        }
        log(DiagnosticLevel.INFO, "MONITOR", "Monitoring started")
        launchLoop(forceInitializeOnly = false)
    }

    private fun pause() {
        if (capturer == null) return stopIfIdle()
        loopJob?.cancel()
        loopJob = null
        clicker.cancel()
        runtime.update { it.copy(status = MonitorStatus.PAUSED, ocrStatus = OcrStatus.IDLE) }
        log(DiagnosticLevel.INFO, "MONITOR", "Paused")
    }

    private fun resume() {
        if (capturer == null) return stopIfIdle()
        if (loopJob?.isActive == true) return
        if (ocr == null) ocr = CoefficientOcrEngine()
        mode = Mode.MONITOR
        runtime.update { it.copy(status = MonitorStatus.INITIALIZING, ocrStatus = OcrStatus.WAITING_FOR_SCREEN) }
        log(DiagnosticLevel.INFO, "MONITOR", "Resumed")
        launchLoop(forceInitializeOnly = false)
    }

    /** Stops everything. [error] non-null leaves the dashboard in the Error state with a reason. */
    private fun shutdown(error: MonitorError?) {
        clicker.cancel()
        loopJob?.cancel()
        loopJob = null
        snapshotJob?.cancel()
        snapshotJob = null
        releaseCapture()
        ocr?.close()
        ocr = null
        hideOverlay()
        runtime.update {
            it.copy(
                status = if (error != null) MonitorStatus.ERROR else MonitorStatus.STOPPED,
                captureActive = false,
                ocrStatus = OcrStatus.IDLE,
                error = error,
            )
        }
        if (inForeground) {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
            inForeground = false
        }
        stopSelf()
    }

    private fun stopIfIdle() {
        if (capturer == null) stopSelf()
    }

    private fun releaseCapture() {
        capturer?.release()
        capturer = null
    }

    private suspend fun onCaptureEnded() {
        if (capturer == null) return
        log(DiagnosticLevel.WARNING, "CAPTURE", "Screen capture was stopped by the system or the user")
        val s = withAppLocale()
        notifications.alert(
            MonitorNotifications.ID_CAPTURE_STOPPED,
            s.getString(R.string.alert_capture_stopped_title),
            s.getString(R.string.alert_capture_stopped_text),
        )
        // The sequence position stays as it is; the user restarts monitoring with new consent.
        shutdown(MonitorError.CAPTURE_REVOKED)
    }

    private fun goForeground() {
        val s = withAppLocale()
        val notification = notifications.monitoring(
            title = s.getString(R.string.app_name),
            text = s.getString(R.string.status_initializing),
            paused = false,
            controls = false,
        )
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION else 0
        ServiceCompat.startForeground(this, MonitorNotifications.ID_MONITOR, notification, type)
        inForeground = true
    }

    // ---- Monitoring loop -------------------------------------------------------------------

    private fun launchLoop(forceInitializeOnly: Boolean) {
        loopJob?.cancel()
        loopJob = lifecycleScope.launch {
            settings = container.settings.current()
            if (settings.overlayEnabled) showOverlay()
            val engine = ocr ?: return@launch
            val pipeline = FramePipeline(
                ocr = engine,
                onOcrStarted = { runtime.update { it.copy(ocrStatus = OcrStatus.READING) } },
                onOcrFinished = ::reportOcrDuration,
            )
            var active = settings
            var detector = newDetector(active, forceInitializeOnly)
            withContext(Dispatchers.Default) {
                while (isActive) {
                    val tickStart = SystemClock.elapsedRealtime()
                    val latest = settings
                    if (latest.detector != active.detector || latest.calibration != active.calibration) {
                        // Reconfigured mid-session (settings, preset, recalibration): re-initialise
                        // from the stored baseline without processing the round on screen.
                        detector = newDetector(latest, forceInitializeOnly = true)
                        pipeline.reset()
                        log(DiagnosticLevel.INFO, "MONITOR", "Detector re-initialised after a configuration change")
                    }
                    active = latest
                    tick(detector, pipeline, active)
                    val elapsed = SystemClock.elapsedRealtime() - tickStart
                    delay((active.captureIntervalMs - elapsed).coerceAtLeast(MIN_IDLE_MS))
                }
            }
        }
    }

    private suspend fun newDetector(s: AppSettings, forceInitializeOnly: Boolean): NewRoundDetector {
        detectorReady = false
        val config = if (forceInitializeOnly) s.detector.copy(firstRoundPolicy = FirstRoundPolicy.INITIALIZE_ONLY) else s.detector
        return NewRoundDetector(config, container.monitor.baseline())
    }

    private suspend fun tick(detector: NewRoundDetector, pipeline: FramePipeline, s: AppSettings) {
        val capture = capturer ?: return
        val step = try {
            pipeline.next(capture, s.calibration, s.detector.frameStableSimilarity, System.currentTimeMillis())
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            // OCR is local: a failure here is never treated as a round or as a network problem.
            runtime.update { it.copy(ocrStatus = OcrStatus.FAILED) }
            log(DiagnosticLevel.ERROR, "OCR", "Frame processing failed: ${e.message}")
            return
        }
        when (step) {
            PipelineStep.NoFrame -> runtime.update { it.copy(ocrStatus = OcrStatus.WAITING_FOR_SCREEN) }
            is PipelineStep.InvalidRegion -> runtime.update {
                it.copy(
                    status = MonitorStatus.ERROR,
                    error = MonitorError.CALIBRATION_INVALID,
                    calibrationProblem = step.problem,
                    ocrStatus = OcrStatus.NO_REGION,
                )
            }
            is PipelineStep.Sample -> {
                val reading = step.sample.reading
                runtime.update {
                    it.copy(
                        status = if (detectorReady) MonitorStatus.MONITORING else MonitorStatus.INITIALIZING,
                        error = if (it.error == MonitorError.CALIBRATION_INVALID) null else it.error,
                        calibrationProblem = null,
                        lastRawText = reading?.rawText ?: it.lastRawText,
                        lastConfidence = (reading as? OcrReading.Valid)?.confidence ?: it.lastConfidence,
                    )
                }
                handle(detector.onFrame(step.sample), s)
            }
        }
    }

    private suspend fun handle(result: DetectorResult, s: AppSettings) {
        when (result) {
            DetectorResult.Transitioning -> runtime.update { it.copy(ocrStatus = OcrStatus.TRANSITIONING) }
            DetectorResult.AwaitingReading -> runtime.update { it.copy(ocrStatus = OcrStatus.READING) }
            is DetectorResult.Rejected -> onRejected(result.reading, s)
            is DetectorResult.Stabilizing -> runtime.update {
                it.copy(ocrStatus = OcrStatus.READING, lastReadValue = result.value, lastRejection = null)
            }
            is DetectorResult.Initialized -> {
                markReady(result.value)
                container.monitor.recordObservation(result.value)
                log(DiagnosticLevel.INFO, "DETECTOR", "Observation initialised at ${result.value} (not processed as a round)")
            }
            is DetectorResult.SameRound -> markReady(result.value)
            is DetectorResult.SuppressedByCooldown -> {
                markReady(result.value)
                container.monitor.recordObservation(result.value)
                log(DiagnosticLevel.WARNING, "DETECTOR", "Change to ${result.value} inside the cooldown ignored")
            }
            is DetectorResult.NewRound -> {
                markReady(result.event.value)
                applyRound(result.event, s)
            }
        }
    }

    /**
     * Runs the clicks of the algorithm at [activeIndex] (position in the enabled sequence), step by
     * step with the step times in between. Taps on the row being read are skipped, and nothing is
     * tapped if the screen orientation no longer matches the calibration screenshot the points
     * were picked on.
     */
    private suspend fun runClicks(activeIndex: Int) {
        val s = settings
        val calibration = s.calibration
        val definition = container.algorithms.allDefinitions().filter { it.enabled }.getOrNull(activeIndex) ?: return
        val band = calibration?.let { ObservationRegionManager.readingBand(it) }
        val clicks = ClickPlan.plan(definition.steps, s.globalDelayMs, band)
        if (clicks.isEmpty()) return
        if (calibration != null && !sameOrientationAs(calibration)) {
            log(DiagnosticLevel.WARNING, "AUTO_CLICK", "Screen orientation differs from the calibration screenshot; Algorithm ${activeIndex + 1} was not clicked")
            return
        }
        if (!AutoClickService.connected.value) {
            if (!clickerOffReported) {
                log(DiagnosticLevel.WARNING, "AUTO_CLICK", "The auto-clicker is off in Accessibility settings; Algorithm ${activeIndex + 1} was not clicked")
            }
            clickerOffReported = true
            return
        }
        clickerOffReported = false
        withContext(Dispatchers.Main) { clicker.play(activeIndex + 1, clicks) }
    }

    private fun reportClicks(algorithmNumber: Int, tapped: Int, missed: List<Int>) {
        if (missed.isEmpty()) {
            log(DiagnosticLevel.INFO, "AUTO_CLICK", "Algorithm $algorithmNumber: $tapped click(s) performed")
        } else {
            log(
                DiagnosticLevel.WARNING,
                "AUTO_CLICK",
                "Algorithm $algorithmNumber: $tapped click(s) performed; step(s) ${missed.joinToString()} could not be clicked",
            )
        }
    }

    @Suppress("DEPRECATION")
    private fun sameOrientationAs(calibration: ObservationCalibration): Boolean {
        val metrics = android.util.DisplayMetrics()
        getSystemService(android.hardware.display.DisplayManager::class.java)
            .getDisplay(android.view.Display.DEFAULT_DISPLAY).getRealMetrics(metrics)
        return ObservationRegionManager.resolve(calibration, metrics.widthPixels, metrics.heightPixels).let {
            it !is RegionResolution.Invalid || it.problem != CalibrationProblem.GEOMETRY_CHANGED
        }
    }

    private var lastSlowOcrReportMs = 0L

    /** OCR is normally tens of milliseconds; report (at most once a minute) when the device is much slower. */
    private fun reportOcrDuration(durationMs: Long) {
        if (durationMs < SLOW_OCR_MS) return
        val now = SystemClock.elapsedRealtime()
        if (now - lastSlowOcrReportMs < SLOW_OCR_REPORT_INTERVAL_MS) return
        lastSlowOcrReportMs = now
        log(DiagnosticLevel.WARNING, "OCR", "OCR took $durationMs ms; rounds are detected later than usual on this device")
    }

    private fun markReady(value: Coefficient) {
        detectorReady = true
        runtime.update {
            it.copy(
                status = MonitorStatus.MONITORING,
                ocrStatus = OcrStatus.OK,
                lastReadValue = value,
                lastRejection = null,
            )
        }
    }

    private suspend fun onRejected(reading: OcrReading, s: AppSettings) {
        val reason = (reading as? OcrReading.Rejected)?.reason
        runtime.update {
            it.copy(
                ocrStatus = if (reading is OcrReading.Placeholder) OcrStatus.PLACEHOLDER else OcrStatus.REJECTED,
                lastRejection = reason,
                lastRawText = reading.rawText,
            )
        }
        val key = reason to reading.rawText
        if (s.logRejectedReadings && key != lastLoggedRejection) {
            lastLoggedRejection = key
            val label = reason?.name ?: "PLACEHOLDER"
            container.events.log(DiagnosticLevel.INFO, "OCR_REJECTED", "$label: \"${reading.rawText.take(80)}\"")
        }
    }

    private suspend fun applyRound(event: RoundEvent, s: AppSettings) {
        val result = try {
            container.monitor.applyRound(event, s.threshold)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            container.events.log(DiagnosticLevel.ERROR, "PROCESSING", "Could not store ${event.roundId}: ${e.message}")
            return
        }
        when (result) {
            is ProcessResult.Duplicate ->
                container.events.log(DiagnosticLevel.WARNING, "DUPLICATE", "Round ${event.roundId} was already processed; ignored")
            is ProcessResult.Applied -> {
                runtime.update { it.copy(lastContinuity = event.continuity) }
                if (event.continuity == Continuity.GAP_SUSPECTED) {
                    container.events.log(
                        DiagnosticLevel.WARNING,
                        "CONTINUITY",
                        "Possible missed round(s) before ${event.roundId}; check the game history",
                    )
                }
                val str = withAppLocale()
                val position = result.transition.newIndex + 1
                when (result.transition.reason) {
                    TransitionReason.END_OF_SEQUENCE -> notifications.alert(
                        MonitorNotifications.ID_END_OF_SEQUENCE,
                        str.getString(R.string.alert_end_title),
                        str.getString(R.string.alert_end_text, position),
                        MainActivity.OPEN_ALGORITHMS,
                    )
                    TransitionReason.NO_ALGORITHMS -> notifications.alert(
                        MonitorNotifications.ID_NO_ALGORITHMS,
                        str.getString(R.string.alert_no_algorithms_title),
                        str.getString(R.string.alert_no_algorithms_text),
                        MainActivity.OPEN_ALGORITHMS,
                    )
                    else -> Unit
                }
                if (s.autoClickEnabled) runClicks(result.transition.newIndex)
                if (s.roundNotifications) {
                    notifications.round(
                        str.getString(R.string.notif_round_title, event.value.toString()),
                        Labels.transitionSummary(str, result.record.previousAlgorithm, result.record.newAlgorithm, result.transition.type),
                    )
                }
            }
        }
    }

    // ---- Snapshot for calibration ------------------------------------------------------------

    private fun requestSnapshot(delayMs: Long) {
        val capture = capturer ?: return stopIfIdle()
        snapshotJob?.cancel()
        runtime.update { it.copy(snapshot = SnapshotState.Pending(System.currentTimeMillis() + delayMs)) }
        snapshotJob = lifecycleScope.launch {
            delay(delayMs)
            val bitmap = withContext(Dispatchers.Default) { capture.withLatestFrame { it.toBitmap() } }
            if (bitmap != null) {
                container.calibrationImages.save(bitmap)
                bitmap.recycle()
                runtime.update { it.copy(snapshot = SnapshotState.Captured(System.currentTimeMillis())) }
                val s = withAppLocale()
                notifications.alert(
                    MonitorNotifications.ID_SNAPSHOT,
                    s.getString(R.string.alert_snapshot_title),
                    s.getString(R.string.alert_snapshot_text),
                    MainActivity.OPEN_CALIBRATION,
                )
            } else {
                runtime.update { it.copy(snapshot = SnapshotState.Failed) }
            }
            if (mode == Mode.SNAPSHOT_ONLY) shutdown(error = null)
        }
    }

    // ---- Floating panel and notification ----------------------------------------------------

    private fun applyOverlaySetting(s: AppSettings) {
        if (capturer == null || mode != Mode.MONITOR) return
        if (s.overlayEnabled) showOverlay() else hideOverlay()
    }

    private fun showOverlay() {
        if (overlay?.isShowing == true) return
        val controller = OverlayController(
            context = withAppLocale(),
            onPauseResume = { if (runtime.state.value.status == MonitorStatus.PAUSED) resume() else pause() },
            onStop = { shutdown(error = null) },
            onRunClicks = {
                lifecycleScope.launch { runClicks(container.monitor.sequenceState().activeIndex) }
            },
            onOpenApp = {
                startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP))
            },
        )
        if (controller.show()) overlay = controller
    }

    private fun hideOverlay() {
        overlay?.hide()
        overlay = null
    }

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
            combine(runtime.state, AutoClickService.connected, ::Pair),
            container.monitor.state,
            container.algorithms.algorithms,
            container.events.recent(OVERLAY_LOG_LINES),
            container.settings.settings,
        ) { (rt, clickerConnected), state, algorithms, recent, s ->
            Presentation(rt, clickerConnected, state, algorithms.filter { it.definition.enabled }, recent, s)
        }.collect { render(it) }
    }

    private fun render(p: Presentation) {
        val str = withAppLocale()
        val total = p.algorithms.size
        val index = if (total == 0) 0 else p.state.activeIndex.coerceIn(0, total - 1)
        val active = p.algorithms.getOrNull(index)?.definition
        val title = if (total == 0) {
            str.getString(R.string.no_algorithms_short)
        } else {
            str.getString(R.string.algorithm_position, index + 1, total)
        }
        val lastValue = p.state.lastAcceptedHundredths?.let { Coefficient(it).toString() } ?: "—"
        val statusText = Labels.status(str, p.runtime.status)
        val coefficientLine = str.getString(R.string.overlay_last_coefficient, lastValue)
        if (inForeground && capturer != null) {
            notifications.updateMonitoring(
                notifications.monitoring(
                    title = "$title · ${active?.name ?: "—"}",
                    text = "$statusText · $coefficientLine",
                    paused = p.runtime.status == MonitorStatus.PAUSED,
                    controls = mode == Mode.MONITOR,
                ),
            )
        }
        val firstStepDelay = active?.steps?.firstOrNull()?.let { DelayPolicy.effective(it, p.settings.globalDelayMs) }
            ?: p.settings.globalDelayMs
        val clickerOff = p.settings.autoClickEnabled && !p.clickerConnected && active?.steps?.any { it.point != null } == true
        val warning = when {
            p.runtime.calibrationProblem != null -> Labels.calibrationProblem(str, p.runtime.calibrationProblem)
            clickerOff -> str.getString(R.string.warning_auto_click_off)
            total > 0 && index == total - 1 -> str.getString(R.string.warning_last_algorithm)
            p.runtime.lastContinuity == Continuity.GAP_SUSPECTED -> str.getString(R.string.warning_gap)
            else -> null
        }
        overlay?.update(
            OverlayState(
                title = title,
                algorithmName = active?.name ?: "—",
                coefficientLine = coefficientLine,
                statusLine = "$statusText · ${Labels.ocrStatus(str, p.runtime.ocrStatus)}",
                delayLine = str.getString(R.string.overlay_delay, firstStepDelay),
                warning = warning,
                log = p.recent.map { Labels.eventLine(str, it) },
                paused = p.runtime.status == MonitorStatus.PAUSED,
                clickLine = p.runtime.clicks?.let { str.getString(R.string.overlay_clicks, it.position, it.total, it.delayMs) },
            ),
        )
    }

    private fun log(level: DiagnosticLevel, category: String, message: String) {
        lifecycleScope.launch { container.events.log(level, category, message) }
    }

    companion object {
        const val ACTION_START = "app.coefmonitor.action.START"
        const val ACTION_PAUSE = "app.coefmonitor.action.PAUSE"
        const val ACTION_RESUME = "app.coefmonitor.action.RESUME"
        const val ACTION_STOP = "app.coefmonitor.action.STOP"
        const val ACTION_SNAPSHOT = "app.coefmonitor.action.SNAPSHOT"

        private const val EXTRA_RESULT_CODE = "result_code"
        private const val EXTRA_RESULT_DATA = "result_data"
        private const val EXTRA_MODE = "mode"
        private const val EXTRA_DELAY_MS = "delay_ms"

        const val DEFAULT_SNAPSHOT_DELAY_MS = 5_000L
        private const val MIN_IDLE_MS = 30L
        private const val SLOW_OCR_MS = 2_000L
        private const val SLOW_OCR_REPORT_INTERVAL_MS = 60_000L
        private const val OVERLAY_LOG_LINES = 3

        /** Starts a capture session with the result of the system screen-capture consent dialog. */
        fun start(context: Context, resultCode: Int, data: Intent, mode: Mode, delayMs: Long = DEFAULT_SNAPSHOT_DELAY_MS) {
            val intent = Intent(context, MonitoringService::class.java)
                .setAction(ACTION_START)
                .putExtra(EXTRA_RESULT_CODE, resultCode)
                .putExtra(EXTRA_RESULT_DATA, data)
                .putExtra(EXTRA_MODE, mode.name)
                .putExtra(EXTRA_DELAY_MS, delayMs)
            ContextCompat.startForegroundService(context, intent)
        }

        /** Pause / resume / stop / snapshot for a running session. */
        fun command(context: Context, action: String, delayMs: Long = DEFAULT_SNAPSHOT_DELAY_MS) {
            context.startService(Intent(context, MonitoringService::class.java).setAction(action).putExtra(EXTRA_DELAY_MS, delayMs))
        }
    }
}
