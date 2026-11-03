package app.coefmonitor.ui

import android.content.Context
import androidx.annotation.StringRes
import app.coefmonitor.R
import app.coefmonitor.core.Continuity
import app.coefmonitor.core.DetectionReason
import app.coefmonitor.core.GuardedConfig
import app.coefmonitor.core.GuardedPhase
import app.coefmonitor.core.GuardedStart
import app.coefmonitor.core.GuardedState
import app.coefmonitor.core.Money
import app.coefmonitor.core.RejectionReason
import app.coefmonitor.core.TransitionReason
import app.coefmonitor.core.TransitionType
import app.coefmonitor.data.db.EventEntity
import app.coefmonitor.data.db.enumOrDefault
import app.coefmonitor.monitor.MonitorError
import app.coefmonitor.monitor.MonitorStatus
import app.coefmonitor.monitor.OcrStatus

/** Maps domain enums to localised string resources (shared by Compose UI, service and overlay). */
object Labels {

    @StringRes
    fun status(status: MonitorStatus): Int = when (status) {
        MonitorStatus.STOPPED -> R.string.status_stopped
        MonitorStatus.INITIALIZING -> R.string.status_initializing
        MonitorStatus.MONITORING -> R.string.status_monitoring
        MonitorStatus.PAUSED -> R.string.status_paused
        MonitorStatus.ERROR -> R.string.status_error
    }

    @StringRes
    fun ocrStatus(status: OcrStatus): Int = when (status) {
        OcrStatus.IDLE -> R.string.ocr_idle
        OcrStatus.WAITING_FOR_SCREEN -> R.string.ocr_waiting
        OcrStatus.TRANSITIONING -> R.string.ocr_transitioning
        OcrStatus.READING -> R.string.ocr_reading
        OcrStatus.OK -> R.string.ocr_ok
        OcrStatus.REJECTED -> R.string.ocr_rejected
        OcrStatus.PLACEHOLDER -> R.string.ocr_placeholder
        OcrStatus.FAILED -> R.string.ocr_failed
        OcrStatus.SEARCHING -> R.string.ocr_searching
    }

    @StringRes
    fun rejection(reason: RejectionReason): Int = when (reason) {
        RejectionReason.EMPTY -> R.string.reject_empty
        RejectionReason.PARTIAL_VALUE -> R.string.reject_partial
        RejectionReason.MISSING_MULTIPLIER_SIGN -> R.string.reject_missing_x
        RejectionReason.MALFORMED -> R.string.reject_malformed
        RejectionReason.MULTIPLE_VALUES -> R.string.reject_multiple
        RejectionReason.OUT_OF_RANGE -> R.string.reject_range
        RejectionReason.LOW_CONFIDENCE -> R.string.reject_low_confidence
    }

    @StringRes
    fun error(error: MonitorError): Int = when (error) {
        MonitorError.CAPTURE_DENIED -> R.string.error_capture_denied
        MonitorError.CAPTURE_REVOKED -> R.string.error_capture_revoked
        MonitorError.CAPTURE_FAILED -> R.string.error_capture_failed
        MonitorError.NO_ALGORITHMS -> R.string.error_no_algorithms
        MonitorError.OCR_FAILED -> R.string.error_ocr
        MonitorError.NETWORK_SLOW -> R.string.error_network_slow
    }

    @StringRes
    fun transitionType(type: TransitionType): Int = when (type) {
        TransitionType.ADVANCE -> R.string.transition_advance
        TransitionType.RESET_TO_FIRST -> R.string.transition_reset
        TransitionType.NO_POSITION_CHANGE -> R.string.transition_none
    }

    @StringRes
    fun transitionReason(reason: TransitionReason): Int = when (reason) {
        TransitionReason.LOW_COEFFICIENT -> R.string.reason_low
        TransitionReason.HIGH_COEFFICIENT -> R.string.reason_high
        TransitionReason.ALREADY_AT_FIRST -> R.string.reason_already_first
        TransitionReason.END_OF_SEQUENCE -> R.string.reason_end
        TransitionReason.NO_ALGORITHMS -> R.string.reason_no_algorithms
        TransitionReason.SESSION_START -> R.string.reason_session_start
        TransitionReason.GUARD_WAITING -> R.string.reason_guard_waiting
        TransitionReason.GUARD_STARTED -> R.string.reason_guard_started
        TransitionReason.GUARD_NO_STAKE -> R.string.reason_guard_no_stake
        TransitionReason.GUARD_PART_DONE -> R.string.reason_guard_part_done
        TransitionReason.GUARD_RUN_DONE -> R.string.reason_guard_run_done
        TransitionReason.GUARD_FINISHED -> R.string.reason_guard_finished
    }

    @StringRes
    fun detectionReason(reason: DetectionReason): Int = when (reason) {
        DetectionReason.FIRST_OBSERVATION -> R.string.detection_first
        DetectionReason.VALUE_CHANGED -> R.string.detection_value_changed
        DetectionReason.SAME_VALUE_ROW_SHIFT -> R.string.detection_row_shift
        DetectionReason.SAME_VALUE_MOTION -> R.string.detection_motion
        DetectionReason.MISSED_ROUND_NEIGHBOR -> R.string.detection_missed_neighbor
        DetectionReason.SEEN_LATE -> R.string.detection_seen_late
    }

    @StringRes
    fun continuity(continuity: Continuity): Int = when (continuity) {
        Continuity.CONFIRMED -> R.string.continuity_confirmed
        Continuity.GAP_SUSPECTED -> R.string.continuity_gap
        Continuity.UNKNOWN -> R.string.continuity_unknown
    }

    fun status(context: Context, status: MonitorStatus): String = context.getString(status(status))

    fun ocrStatus(context: Context, status: OcrStatus): String = context.getString(ocrStatus(status))

    /** "Algorithm 1 → Algorithm 2" or "Algorithm 1 remains active". */
    fun transitionSummary(context: Context, previous: Int, new: Int, type: TransitionType): String =
        if (type == TransitionType.NO_POSITION_CHANGE) {
            context.getString(R.string.summary_remains, new)
        } else {
            context.getString(R.string.summary_move, previous, new)
        }

    /** One line on the guarded start: "Waiting for lows 2/3 · part 1/4", "Part 1/4 · 26.00 / 50.00 · stake 4.00" or "Done: 200.00". */
    fun guardLine(context: Context, config: GuardedConfig, state: GuardedState?): String {
        val s = state ?: GuardedState()
        return when (s.phase) {
            GuardedPhase.WAITING -> context.getString(R.string.guard_line_waiting, s.lowStreak, config.lowsInRow, s.part, config.parts)
            GuardedPhase.ACTIVE -> context.getString(
                R.string.guard_line_active,
                s.part,
                config.parts,
                Money.format(s.partProfit),
                Money.format(GuardedStart.partTarget(config)),
                s.stake?.let(Money::format) ?: "—",
            ) + config.winsPerRun?.let { wins -> " · " + context.getString(R.string.guard_run_wins, s.runWins, wins) }.orEmpty()
            GuardedPhase.DONE -> context.getString(R.string.guard_line_done, Money.format(s.totalProfit))
        }
    }

    /** "1.70x — ADVANCE — Algorithm 1 → Algorithm 2", the format used in the event log. */
    fun eventLine(context: Context, event: EventEntity): String {
        val type = enumOrDefault(event.transitionType, TransitionType.NO_POSITION_CHANGE)
        return "${event.coefficientText} — ${type.name} — " +
            transitionSummary(context, event.previousAlgorithm, event.newAlgorithm, type)
    }
}
