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
    /** Progress of the guarded start; null while it is off. */
    val guarded: GuardedState? = null,
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
    data class Applied(
        val state: SequenceState,
        val transition: Transition,
        val record: EventRecord,
        /** Whether the active algorithm's clicks should run now (false while the guarded start does not stake). */
        val runClicks: Boolean = true,
        /** What the round did to the guarded start; null while it is off. */
        val guard: GuardedStep? = null,
    ) : ProcessResult

    /** The round was already processed (same or older sequence number); nothing changes. */
    data class Duplicate(val sequence: Long, val lastProcessed: Long) : ProcessResult
}

/**
 * Applies one detected round to the stored sequence state. Pure, so the app can run it inside a
 * single database transaction together with writing the event record.
 */
object RoundProcessor {

    /**
     * [startOfSession]: the first round that ended after Start. No stake was placed on it, so the
     * threshold rule is not applied: the session simply begins at Algorithm 1.
     *
     * [guarded]: the guarded start's settings, null while it is off. It then decides whether the
     * algorithms work at all (see [GuardedStart]). [live]: the round was seen when it ended, so
     * clicks run in time for the next round.
     */
    fun process(
        state: SequenceState,
        event: RoundEvent,
        algorithmCount: Int,
        threshold: Coefficient,
        startOfSession: Boolean = false,
        guarded: GuardedConfig? = null,
        live: Boolean = true,
    ): ProcessResult {
        if (event.sequence <= state.lastSequence) return ProcessResult.Duplicate(event.sequence, state.lastSequence)
        // The stake rule needs a threshold above 1.00x.
        val config = guarded?.takeIf { it.problem() == null && threshold > Coefficient.MIN_THRESHOLD }
        val step = config?.let {
            val before = if (startOfSession) GuardedStart.begin(state.guarded) else state.guarded ?: GuardedState()
            GuardedStart.onRound(it, before, event.value, threshold, live)
        }
        val transition = when {
            step != null -> guardedTransition(step.event, state.activeIndex, algorithmCount, event.value, threshold, startOfSession)
            startOfSession -> sessionStart(state.activeIndex, algorithmCount)
            else -> AlgorithmSequenceEngine.next(state.activeIndex, algorithmCount, event.value, threshold)
        }
        val newState = state.copy(
            activeIndex = transition.newIndex,
            lastSequence = event.sequence,
            lastAcceptedValue = event.value,
            lastObservedValue = event.value,
            lastEventAtMs = event.detectedAtMs,
            guarded = step?.state,
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
        return ProcessResult.Applied(newState, transition, record, runClicks = step?.stakesNext ?: true, guard = step)
    }

    private fun guardedTransition(
        event: GuardedEvent,
        currentIndex: Int,
        algorithmCount: Int,
        coefficient: Coefficient,
        threshold: Coefficient,
        startOfSession: Boolean,
    ): Transition {
        if (algorithmCount <= 0) return Transition(0, 0, TransitionType.NO_POSITION_CHANGE, TransitionReason.NO_ALGORITHMS)
        val current = clampIndex(currentIndex, algorithmCount)
        fun toFirst(reason: TransitionReason) =
            Transition(current, 0, if (current == 0) TransitionType.NO_POSITION_CHANGE else TransitionType.RESET_TO_FIRST, reason)
        return when (event) {
            GuardedEvent.LOST, GuardedEvent.WON -> AlgorithmSequenceEngine.next(current, algorithmCount, coefficient, threshold)
            GuardedEvent.NO_STAKE -> Transition(current, current, TransitionType.NO_POSITION_CHANGE, TransitionReason.GUARD_NO_STAKE)
            GuardedEvent.LOW_COUNTED, GuardedEvent.RUN_BROKEN ->
                toFirst(if (startOfSession) TransitionReason.SESSION_START else TransitionReason.GUARD_WAITING)
            GuardedEvent.STARTED -> toFirst(TransitionReason.GUARD_STARTED)
            GuardedEvent.PART_DONE -> toFirst(TransitionReason.GUARD_PART_DONE)
            GuardedEvent.FINISHED -> toFirst(TransitionReason.GUARD_FINISHED)
        }
    }

    private fun sessionStart(currentIndex: Int, algorithmCount: Int): Transition {
        if (algorithmCount <= 0) {
            return Transition(0, 0, TransitionType.NO_POSITION_CHANGE, TransitionReason.NO_ALGORITHMS)
        }
        val current = clampIndex(currentIndex, algorithmCount)
        val type = if (current == 0) TransitionType.NO_POSITION_CHANGE else TransitionType.RESET_TO_FIRST
        return Transition(current, 0, type, TransitionReason.SESSION_START)
    }

    /** Keeps the position valid after algorithms are deleted or disabled (never jumps to 1 silently). */
    fun clampIndex(activeIndex: Int, algorithmCount: Int): Int =
        if (algorithmCount <= 0) 0 else activeIndex.coerceIn(0, algorithmCount - 1)
}
