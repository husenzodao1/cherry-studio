package app.coefmonitor.core

import kotlinx.serialization.Serializable

/** Persistent position in the algorithm sequence plus what is needed to never replay a round. */
data class SequenceState(
    val activeIndex: Int = 0,
    /** Sequence number of the last round that changed (or was evaluated against) the position. */
    val lastSequence: Long = 0,
    val lastAcceptedValue: Coefficient? = null,
    /** Last value seen on the tile, including baselines that were not processed. */
    val lastObservedValue: Coefficient? = null,
    val lastEventAtMs: Long? = null,
) {
    fun toBaseline(): DetectorBaseline = DetectorBaseline(lastObservedValue, lastSequence, lastEventAtMs)
}

@Serializable
enum class ProcessingStatus { APPLIED, DUPLICATE_IGNORED }

/** One line of the event log; also the export format (JSON/CSV). */
@Serializable
data class EventRecord(
    val timestampMs: Long,
    val roundId: String,
    val sequence: Long,
    val coefficientHundredths: Long,
    val ocrConfidence: Float?,
    val ocrValidation: String,
    /** 1-based algorithm numbers, as shown to the user. */
    val previousAlgorithm: Int,
    val newAlgorithm: Int,
    val thresholdHundredths: Long,
    val transitionType: TransitionType,
    val transitionReason: TransitionReason,
    val detectionReason: DetectionReason,
    val continuity: Continuity,
    val processingStatus: ProcessingStatus,
    val error: String? = null,
) {
    val coefficient: Coefficient get() = Coefficient(coefficientHundredths)
    val threshold: Coefficient get() = Coefficient(thresholdHundredths)

    /** e.g. "1.70x — ADVANCE — Algorithm 1 → Algorithm 2" (English; the app localises its own UI text). */
    fun summary(): String = when (transitionType) {
        TransitionType.NO_POSITION_CHANGE ->
            "$coefficient — $transitionType — Algorithm $newAlgorithm remains active"
        else -> "$coefficient — $transitionType — Algorithm $previousAlgorithm → Algorithm $newAlgorithm"
    }
}

sealed interface ProcessResult {
    data class Applied(val state: SequenceState, val transition: Transition, val record: EventRecord) : ProcessResult

    /** The round was already processed (same or older sequence number); nothing changes. */
    data class Duplicate(val sequence: Long, val lastProcessed: Long) : ProcessResult
}

/**
 * Applies one detected round to the stored sequence state. Pure, so the app can run it inside a
 * single database transaction together with writing the event record.
 */
object RoundProcessor {

    fun process(
        state: SequenceState,
        event: RoundEvent,
        algorithmCount: Int,
        threshold: Coefficient,
    ): ProcessResult {
        if (event.sequence <= state.lastSequence) return ProcessResult.Duplicate(event.sequence, state.lastSequence)
        val transition = AlgorithmSequenceEngine.next(state.activeIndex, algorithmCount, event.value, threshold)
        val newState = state.copy(
            activeIndex = transition.newIndex,
            lastSequence = event.sequence,
            lastAcceptedValue = event.value,
            lastObservedValue = event.value,
            lastEventAtMs = event.detectedAtMs,
        )
        val record = EventRecord(
            timestampMs = event.detectedAtMs,
            roundId = event.roundId,
            sequence = event.sequence,
            coefficientHundredths = event.value.hundredths,
            ocrConfidence = event.confidence,
            ocrValidation = "VALID",
            previousAlgorithm = transition.previousIndex + 1,
            newAlgorithm = transition.newIndex + 1,
            thresholdHundredths = threshold.hundredths,
            transitionType = transition.type,
            transitionReason = transition.reason,
            detectionReason = event.reason,
            continuity = event.continuity,
            processingStatus = ProcessingStatus.APPLIED,
        )
        return ProcessResult.Applied(newState, transition, record)
    }

    /** Keeps the position valid after algorithms are deleted or disabled (never jumps to 1 silently). */
    fun clampIndex(activeIndex: Int, algorithmCount: Int): Int =
        if (algorithmCount <= 0) 0 else activeIndex.coerceIn(0, algorithmCount - 1)
}
