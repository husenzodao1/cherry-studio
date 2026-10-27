package app.coefmonitor.monitor

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
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
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.Continuity
import app.coefmonitor.core.DetectorResult
import app.coefmonitor.core.FirstRoundPolicy
import app.coefmonitor.core.NewRoundDetector
import app.coefmonitor.core.OcrReading
import app.coefmonitor.core.ProcessResult
import app.coefmonitor.core.RejectionReason
import app.coefmonitor.core.RoundEvent
import app.coefmonitor.core.RowCells
import app.coefmonitor.core.TransitionReason
import app.coefmonitor.data.AppSettings
import app.coefmonitor.data.DiagnosticLevel
import app.coefmonitor.data.StoredAlgorithm
import app.coefmonitor.data.db.MonitorStateEntity
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
 * Pipeline per tick: capture → [RowTracker] (finds the result row on the screen by itself and
 * follows it; reads the newest tile and its neighbour) → [NewRoundDetector] →
 * [app.coefmonitor.data.MonitorRepository.applyRound] (one transaction). Pause keeps the capture
 * session; Stop releases it. The sequence position is never touched here except through applyRound.
 */
class MonitoringService : LifecycleService() {

    private val container by lazy { appContainer }
    private val runtime get() = container.runtime
    private lateinit var notifications: MonitorNotifications

    private var capturer: ScreenCapturer? = null
    private var ocr: CoefficientOcrEngine? = null
    private var loopJob: Job? = null
    private var tracker: RowTracker? = null
    private var inForeground = false
    private var detectorReady = false
    private var screenSaved = false
    private var lastLoggedRejection: Pair<RejectionReason?, String>? = null

    @Volatile
    private var settings = AppSettings()

    override fun onCreate() {
        super.onCreate()
        notifications = MonitorNotifications(this)
        notifications.ensureChannels()
        lifecycleScope.launch { container.settings.settings.collect { settings = it } }
        lifecycleScope.launch { observePresentation() }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        when (intent?.action) {
            ACTION_START -> handleStart(intent)
            ACTION_PAUSE -> pause()
            ACTION_RESUME -> resume()
            ACTION_STOP -> shutdown(error = null)
            ACTION_FIND_ROW -> if (capturer != null) tracker?.forget() else stopIfIdle()
            else -> stopIfIdle()
        }
        // Never restart automatically: a new capture session always needs fresh user consent.
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        loopJob?.cancel()
        releaseCapture()
        ocr?.close()
        ocr = null
        runtime.update {
            if (it.status == MonitorStatus.ERROR) {
                it.copy(captureActive = false, rowBand = null)
            } else {
                it.copy(status = MonitorStatus.STOPPED, captureActive = false, ocrStatus = OcrStatus.IDLE, rowBand = null)
            }
        }
        super.onDestroy()
    }

    private fun handleStart(intent: Intent) {
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
        startMonitoring()
    }

    private fun startMonitoring() {
        ocr?.close()
        ocr = CoefficientOcrEngine()
        screenSaved = false
        runtime.update { it.copy(status = MonitorStatus.INITIALIZING, ocrStatus = OcrStatus.SEARCHING, error = null, rowBand = null) }
        log(DiagnosticLevel.INFO, "MONITOR", "Monitoring started")
        launchLoop(forceInitializeOnly = false)
    }

    private fun pause() {
        if (capturer == null) return stopIfIdle()
        loopJob?.cancel()
        loopJob = null
        container.autoClicker.cancel()
        runtime.update { it.copy(status = MonitorStatus.PAUSED, ocrStatus = OcrStatus.IDLE) }
        log(DiagnosticLevel.INFO, "MONITOR", "Paused")
    }

    private fun resume() {
        if (capturer == null) return stopIfIdle()
        if (loopJob?.isActive == true) return
        if (ocr == null) ocr = CoefficientOcrEngine()
        runtime.update { it.copy(status = MonitorStatus.INITIALIZING, ocrStatus = OcrStatus.SEARCHING) }
        log(DiagnosticLevel.INFO, "MONITOR", "Resumed")
        launchLoop(forceInitializeOnly = false)
    }

    /** Stops everything. [error] non-null leaves the dashboard in the Error state with a reason. */
    private fun shutdown(error: MonitorError?) {
        container.autoClicker.cancel()
        loopJob?.cancel()
        loopJob = null
        tracker = null
        releaseCapture()
        ocr?.close()
        ocr = null
        runtime.update {
            it.copy(
                status = if (error != null) MonitorStatus.ERROR else MonitorStatus.STOPPED,
                captureActive = false,
                ocrStatus = OcrStatus.IDLE,
                rowBand = null,
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
            // Floating mode stays on by itself; this only brings the panel back if Android removed it.
            if (settings.overlayEnabled) FloatingPanelService.sync(this@MonitoringService, enabled = true)
            val engine = ocr ?: return@launch
            val eye = RowTracker(
                ocr = engine,
                onOcrStarted = { runtime.update { it.copy(ocrStatus = if (it.rowBand == null) OcrStatus.SEARCHING else OcrStatus.READING) } },
                onOcrFinished = ::reportOcrDuration,
                onRowFound = ::onRowFound,
            )
            tracker = eye
            var active = settings
            var detector = newDetector(active, forceInitializeOnly)
            var anchoredBefore = false
            withContext(Dispatchers.Default) {
                while (isActive) {
                    val tickStart = SystemClock.elapsedRealtime()
                    val latest = settings
                    if (latest.detector != active.detector) {
                        // Reconfigured mid-session (settings, preset): re-initialise from the
                        // stored baseline without processing the round on screen.
                        detector = newDetector(latest, forceInitializeOnly = true)
                        log(DiagnosticLevel.INFO, "MONITOR", "Detector re-initialised after a configuration change")
                    }
                    active = latest
                    val step = read(eye, active) ?: continue
                    if (step is PipelineStep.Sample && step.anchored) {
                        runtime.update { it.copy(rowBand = eye.rowBand()) }
                        if (anchoredBefore) {
                            // The row is somewhere else now: pictures from before are not comparable.
                            // If rounds were being read, catch up on those that ended meanwhile.
                            detector = newDetector(active, forceInitializeOnly = true, catchUp = detectorReady)
                        }
                        anchoredBefore = true
                    }
                    handleStep(step, detector, active)
                    val elapsed = SystemClock.elapsedRealtime() - tickStart
                    delay((active.captureIntervalMs - elapsed).coerceAtLeast(MIN_IDLE_MS))
                }
            }
        }
    }

    private suspend fun newDetector(s: AppSettings, forceInitializeOnly: Boolean, catchUp: Boolean = false): NewRoundDetector {
        detectorReady = false
        val config = if (forceInitializeOnly) s.detector.copy(firstRoundPolicy = FirstRoundPolicy.INITIALIZE_ONLY) else s.detector
        return NewRoundDetector(config, container.monitor.baseline(), catchUp)
    }

    /** One look at the screen; null (after a short pause) if no capture exists or OCR failed. */
    private suspend fun read(eye: RowTracker, s: AppSettings): PipelineStep? {
        val capture = capturer
        if (capture == null) {
            delay(s.captureIntervalMs)
            return null
        }
        return try {
            eye.next(capture, s.detector.frameStableSimilarity, System.currentTimeMillis())
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            // OCR is local: a failure here is never treated as a round or as a network problem.
            runtime.update { it.copy(ocrStatus = OcrStatus.FAILED) }
            log(DiagnosticLevel.ERROR, "OCR", "Frame processing failed: ${e.message}")
            delay(s.captureIntervalMs)
            null
        }
    }

    private suspend fun handleStep(step: PipelineStep, detector: NewRoundDetector, s: AppSettings) {
        when (step) {
            PipelineStep.NoFrame -> runtime.update { it.copy(ocrStatus = OcrStatus.WAITING_FOR_SCREEN) }
            PipelineStep.Searching -> runtime.update { it.copy(ocrStatus = OcrStatus.SEARCHING, rowBand = null) }
            is PipelineStep.Sample -> {
                val reading = step.sample.reading
                runtime.update {
                    it.copy(
                        status = if (detectorReady) MonitorStatus.MONITORING else MonitorStatus.INITIALIZING,
                        lastRawText = reading?.rawText?.takeIf { text -> text.isNotEmpty() } ?: it.lastRawText,
                        lastConfidence = (reading as? OcrReading.Valid)?.confidence ?: it.lastConfidence,
                    )
                }
                handle(detector.onFrame(step.sample), s, lost = step.lost)
            }
        }
    }

    private suspend fun handle(result: DetectorResult, s: AppSettings, lost: Boolean) {
        when (result) {
            DetectorResult.Transitioning -> runtime.update { it.copy(ocrStatus = OcrStatus.TRANSITIONING) }
            DetectorResult.AwaitingReading -> runtime.update { it.copy(ocrStatus = OcrStatus.READING) }
            is DetectorResult.Rejected -> if (lost) {
                // The row left its place and was not found elsewhere yet: the eye keeps looking.
                runtime.update { it.copy(ocrStatus = OcrStatus.SEARCHING) }
            } else {
                onRejected(result.reading, s)
            }
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
                // A missed round is over already: it moves the sequence, but its clicks would be too late.
                result.missed?.let { applyRound(it, s, runClicks = false) }
                applyRound(result.event, s)
            }
        }
    }

    /** The eye found the row by reading the whole screen. The first screen of a session is kept for the in-app point picker. */
    private suspend fun onRowFound(screen: Bitmap, cells: RowCells) {
        if (!screenSaved) {
            screenSaved = true
            container.screenImages.save(screen)
        }
        log(DiagnosticLevel.INFO, "ROW", "Row of coefficients found on the screen (newest tile at ${cells.newest.left},${cells.newest.top})")
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

    private suspend fun applyRound(event: RoundEvent, s: AppSettings, runClicks: Boolean = true) {
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
                if (s.autoClickEnabled && runClicks) container.autoClicker.run(result.transition.newIndex)
                if (s.roundNotifications) {
                    notifications.round(
                        str.getString(R.string.notif_round_title, event.value.toString()),
                        Labels.transitionSummary(str, result.record.previousAlgorithm, result.record.newAlgorithm, result.transition.type),
                    )
                }
            }
        }
    }

    // ---- Notification ---------------------------------------------------------------------

    private data class Presentation(
        val runtime: RuntimeState,
        val state: MonitorStateEntity,
        val algorithms: List<StoredAlgorithm>,
    )

    private suspend fun observePresentation() {
        combine(runtime.state, container.monitor.state, container.algorithms.algorithms) { rt, state, algorithms ->
            Presentation(rt, state, algorithms.filter { it.definition.enabled })
        }.collect { render(it) }
    }

    private fun render(p: Presentation) {
        if (!inForeground || capturer == null) return
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
        notifications.updateMonitoring(
            notifications.monitoring(
                title = "$title · ${active?.name ?: "—"}",
                text = "${Labels.status(str, p.runtime.status)} · ${str.getString(R.string.overlay_last_coefficient, lastValue)}",
                paused = p.runtime.status == MonitorStatus.PAUSED,
                controls = true,
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

        /** Reads the whole screen for the row now, instead of where it was last seen. */
        const val ACTION_FIND_ROW = "app.coefmonitor.action.FIND_ROW"

        private const val EXTRA_RESULT_CODE = "result_code"
        private const val EXTRA_RESULT_DATA = "result_data"

        private const val MIN_IDLE_MS = 30L
        private const val SLOW_OCR_MS = 2_000L
        private const val SLOW_OCR_REPORT_INTERVAL_MS = 60_000L

        /** Starts monitoring with the result of the system screen-capture consent dialog. */
        fun start(context: Context, resultCode: Int, data: Intent) {
            val intent = Intent(context, MonitoringService::class.java)
                .setAction(ACTION_START)
                .putExtra(EXTRA_RESULT_CODE, resultCode)
                .putExtra(EXTRA_RESULT_DATA, data)
            ContextCompat.startForegroundService(context, intent)
        }

        /** Pause / resume / stop / find the row for a running session. */
        fun command(context: Context, action: String) {
            context.startService(Intent(context, MonitoringService::class.java).setAction(action))
        }
    }
}
