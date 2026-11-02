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

enum class MonitorError { CAPTURE_DENIED, CAPTURE_REVOKED, CAPTURE_FAILED, NO_ALGORITHMS, OCR_FAILED, BALANCE_MISMATCH, BALANCE_UNREADABLE, NETWORK_SLOW }

/** At the start the balance on the screen was not the expected one; the user decides whether to go on with it. */
data class BalancePrompt(val screen: Long, val expected: Long)

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
    /** The last round ended while the row was out of view: counted, but its clicks were not run. */
    val lastSeenLate: Boolean = false,
    /** Started, but no round has ended since: the session begins with the next one. */
    val awaitingStart: Boolean = false,
    /** The balance last read on the screen (guarded start with a balance check). */
    val screenBalance: Long? = null,
    /** Waiting for the user to accept the balance seen at the start; monitoring is paused meanwhile. */
    val balancePrompt: BalancePrompt? = null,
    /** Last internet speed measured by the balance management, kbit/s (0: the measurement failed). */
    val networkKbps: Int? = null,
    /** Paused by the balance management because the internet is too slow; resumes by itself. */
    val networkPaused: Boolean = false,
    val clicks: ClickProgress? = null,
)

class MonitorRuntime {
    private val mutableState = MutableStateFlow(RuntimeState())
    val state: StateFlow<RuntimeState> = mutableState.asStateFlow()

    fun update(transform: (RuntimeState) -> RuntimeState) = mutableState.update(transform)
}
