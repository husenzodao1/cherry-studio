package app.coefmonitor.monitor

import app.coefmonitor.core.CalibrationProblem
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.Continuity
import app.coefmonitor.core.RejectionReason
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

enum class MonitorStatus { STOPPED, INITIALIZING, MONITORING, PAUSED, ERROR }

enum class OcrStatus { IDLE, WAITING_FOR_SCREEN, TRANSITIONING, READING, OK, REJECTED, PLACEHOLDER, NO_REGION, FAILED }

enum class MonitorError { CAPTURE_DENIED, CAPTURE_REVOKED, CAPTURE_FAILED, CALIBRATION_INVALID, NO_ALGORITHMS, OCR_FAILED }

sealed interface SnapshotState {
    data object Idle : SnapshotState
    data class Pending(val captureAtMs: Long) : SnapshotState
    data class Captured(val atMs: Long) : SnapshotState
    data object Failed : SnapshotState
}

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
    val calibrationProblem: CalibrationProblem? = null,
    val error: MonitorError? = null,
    val lastContinuity: Continuity? = null,
    val snapshot: SnapshotState = SnapshotState.Idle,
    val clicks: ClickProgress? = null,
)

class MonitorRuntime {
    private val mutableState = MutableStateFlow(RuntimeState())
    val state: StateFlow<RuntimeState> = mutableState.asStateFlow()

    fun update(transform: (RuntimeState) -> RuntimeState) = mutableState.update(transform)
}
