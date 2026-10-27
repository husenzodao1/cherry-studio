package app.coefmonitor.monitor

import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.Continuity
import app.coefmonitor.core.NormalizedRect
import app.coefmonitor.core.RejectionReason
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

enum class MonitorStatus { STOPPED, INITIALIZING, MONITORING, PAUSED, ERROR }

enum class OcrStatus { IDLE, WAITING_FOR_SCREEN, TRANSITIONING, READING, OK, REJECTED, PLACEHOLDER, FAILED, SEARCHING }

enum class MonitorError { CAPTURE_DENIED, CAPTURE_REVOKED, CAPTURE_FAILED, NO_ALGORITHMS, OCR_FAILED }

/** Which step of the active algorithm the auto-clicker is running right now. */
data class ClickProgress(
    val algorithmNumber: Int,
    val stepNumber: Int,
    val position: Int,
    val total: Int,
    val label: String,
    val delayMs: Long,
)

/** Live, non-persistent monitoring status shared by the service, dashboard and floating panel. */
data class RuntimeState(
    val status: MonitorStatus = MonitorStatus.STOPPED,
    val captureActive: Boolean = false,
    val ocrStatus: OcrStatus = OcrStatus.IDLE,
    val lastRawText: String? = null,
    val lastReadValue: Coefficient? = null,
    val lastConfidence: Float? = null,
    val lastRejection: RejectionReason? = null,
    /** Where the result row is on the screen (newest tile and its neighbour), while it is found. */
    val rowBand: NormalizedRect? = null,
    val error: MonitorError? = null,
    val lastContinuity: Continuity? = null,
    val clicks: ClickProgress? = null,
)

class MonitorRuntime {
    private val mutableState = MutableStateFlow(RuntimeState())
    val state: StateFlow<RuntimeState> = mutableState.asStateFlow()

    fun update(transform: (RuntimeState) -> RuntimeState) = mutableState.update(transform)
}
