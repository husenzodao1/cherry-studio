package app.coefmonitor.core

import kotlinx.serialization.Serializable

/** What to do with the round that is already visible when monitoring starts. */
@Serializable
enum class FirstRoundPolicy {
    /** Use it only as the starting point; the next new round is the first one processed (safe default). */
    INITIALIZE_ONLY,

    /** Process it as a round, unless it is the same value that was last observed before a restart. */
    PROCESS_FIRST,
}

@Serializable
data class DetectorConfig(
    /** Consecutive still frames that must read the same valid value before it is trusted. */
    val requiredStableFrames: Int = 3,
    /** Readings whose OCR confidence is reported and below this value are ignored. */
    val minConfidence: Float = 0.5f,
    /** Frame-to-frame similarity at or above which the tile counts as still (not animating). */
    val frameStableSimilarity: Float = 0.985f,
    /** Similarity at or above which two tile images are considered the same picture. */
    val sameTileSimilarity: Float = 0.97f,
    /** Motion lasting longer than this is treated as a disturbance (app switch, scrolling), not a row shift. */
    val maxTransitionMs: Long = 2_500,
    /** Two different rounds can never finish closer together than this. */
    val minRoundIntervalMs: Long = 3_000,
    val firstRoundPolicy: FirstRoundPolicy = FirstRoundPolicy.INITIALIZE_ONLY,
) {
    /** Clamps values loaded from storage or imports into safe ranges. */
    fun sanitized(): DetectorConfig = copy(
        requiredStableFrames = requiredStableFrames.coerceIn(MIN_STABLE_FRAMES, MAX_STABLE_FRAMES),
        minConfidence = minConfidence.coerceIn(0f, 1f),
        frameStableSimilarity = frameStableSimilarity.coerceIn(0.5f, 0.9999f),
        sameTileSimilarity = sameTileSimilarity.coerceIn(0.5f, 0.9999f),
        maxTransitionMs = maxTransitionMs.coerceIn(200L, 30_000L),
        minRoundIntervalMs = minRoundIntervalMs.coerceIn(0L, 60_000L),
    )

    companion object {
        const val MIN_STABLE_FRAMES = 1
        const val MAX_STABLE_FRAMES = 20
    }
}

/** Persisted facts that let a new detector continue safely after a restart, pause or crash. */
data class DetectorBaseline(
    val lastObservedValue: Coefficient? = null,
    val lastSequence: Long = 0,
    val lastEventAtMs: Long? = null,
)

data class FrameSample(
    val timestampMs: Long,
    val primary: ImageSignature,
    /** Signature of the next-older tile, when the calibration allows one. */
    val neighbor: ImageSignature?,
    /** OCR result for [primary]; null when OCR was skipped for this frame. */
    val reading: OcrReading?,
    /** OCR result for [neighbor]; used to tell whether the row really shifted by one tile. */
    val neighborReading: OcrReading? = null,
)

@Serializable
enum class DetectionReason { FIRST_OBSERVATION, VALUE_CHANGED, SAME_VALUE_ROW_SHIFT, SAME_VALUE_MOTION }

/** Whether the detector could confirm that no round was missed before this one. */
@Serializable
enum class Continuity { CONFIRMED, GAP_SUSPECTED, UNKNOWN }

data class RoundEvent(
    /** Monotonic round number; also the de-duplication key. */
    val sequence: Long,
    val value: Coefficient,
    val confidence: Float?,
    val detectedAtMs: Long,
    val reason: DetectionReason,
    val continuity: Continuity,
) {
    val roundId: String get() = roundIdOf(sequence)

    companion object {
        fun roundIdOf(sequence: Long): String = "R-${sequence.toString().padStart(6, '0')}"
    }
}

sealed interface DetectorResult {
    /** The tile is animating or otherwise changing; nothing is read. */
    data object Transitioning : DetectorResult

    data object AwaitingReading : DetectorResult

    /** Placeholder, malformed, partial or low-confidence reading. Never changes state. */
    data class Rejected(val reading: OcrReading) : DetectorResult

    data class Stabilizing(val value: Coefficient, val frames: Int, val required: Int) : DetectorResult

    /** Baseline established without a transition (start/resume/restart). */
    data class Initialized(val value: Coefficient, val confidence: Float?) : DetectorResult

    /** The same round is still on screen. */
    data class SameRound(val value: Coefficient) : DetectorResult

    /** A change too soon after the previous round; treated as a correction, not a new round. */
    data class SuppressedByCooldown(val value: Coefficient) : DetectorResult

    data class NewRound(val event: RoundEvent) : DetectorResult
}

/**
 * Turns a stream of frames of the "first tile right of ?" into exactly one [RoundEvent] per round.
 *
 * Rules, in order:
 *  1. A frame that differs from the previous one is motion; motion resets the candidate value.
 *  2. A value is trusted only after [DetectorConfig.requiredStableFrames] still frames read it
 *     with acceptable confidence. Invalid readings never advance anything.
 *  3. The first trusted value after (re)start only initialises the baseline unless the user chose
 *     [FirstRoundPolicy.PROCESS_FIRST]. The value last observed before a restart is never re-processed.
 *  4. A trusted value different from the committed one is a new round.
 *  5. An equal value is a new round only if the row visibly shifted: the neighbour tile changed
 *     (when it showed a different value, so a shift must change it) or, otherwise, a short
 *     motion burst happened without the screen being replaced by something else in between.
 *     Re-reading an unchanged screen never counts.
 *
 * Image signatures are only compared at the same screen position (frame-to-frame, or the
 * neighbour against itself). Comparisons across positions use OCR text instead, because a
 * one-pixel misalignment between tiles makes pixel similarity unreliable.
 *
 * Pure Kotlin and single-threaded: feed frames from one coroutine.
 */
class NewRoundDetector(
    config: DetectorConfig,
    baseline: DetectorBaseline = DetectorBaseline(),
) {
    private val config = config.sanitized()
    private val restoredValue = baseline.lastObservedValue
    private var lastSequence = baseline.lastSequence
    private var lastEventAtMs = baseline.lastEventAtMs

    private var previousFrame: ImageSignature? = null
    private var candidateValue: Coefficient? = null
    private var candidateFrames = 0
    private var candidateConfidence: Float? = null
    private var committed: CommittedRound? = null

    private var transitionStartMs: Long? = null
    private var transitionLastMs = 0L
    private var shortTransitionSeen = false
    private var longTransitionSeen = false
    private var interruptedSinceCommit = false

    private data class CommittedRound(
        val value: Coefficient,
        val primary: ImageSignature,
        val neighbor: ImageSignature?,
        val neighborValue: Coefficient?,
    )

    val lastProcessedSequence: Long get() = lastSequence

    fun onFrame(frame: FrameSample): DetectorResult {
        val previous = previousFrame
        previousFrame = frame.primary
        if (previous != null && previous.similarity(frame.primary) < config.frameStableSimilarity) {
            if (transitionStartMs == null) transitionStartMs = frame.timestampMs
            transitionLastMs = frame.timestampMs
            resetCandidate()
            return DetectorResult.Transitioning
        }
        closeTransition()

        val reading = frame.reading ?: return DetectorResult.AwaitingReading
        val valid = acceptedOrNull(reading)
        if (valid == null) {
            resetCandidate()
            // A still picture without a readable coefficient means something else covered the tile
            // (another app, a dialog). One such frame is enough: with slow OCR there may be only one.
            interruptedSinceCommit = true
            return DetectorResult.Rejected(lowConfidenceAsRejection(reading))
        }

        if (valid.value == candidateValue) {
            candidateFrames++
        } else {
            candidateValue = valid.value
            candidateFrames = 1
            candidateConfidence = null
        }
        candidateConfidence = lowerConfidence(candidateConfidence, valid.confidence)
        if (candidateFrames < config.requiredStableFrames) {
            return DetectorResult.Stabilizing(valid.value, candidateFrames, config.requiredStableFrames)
        }
        return decide(frame, valid.value, candidateConfidence)
    }

    private fun decide(frame: FrameSample, value: Coefficient, confidence: Float?): DetectorResult {
        val current = committed
        if (current == null) {
            val alreadySeenBeforeRestart = restoredValue == value
            if (alreadySeenBeforeRestart || config.firstRoundPolicy == FirstRoundPolicy.INITIALIZE_ONLY) {
                commit(frame, value)
                return DetectorResult.Initialized(value, confidence)
            }
            return emit(frame, value, confidence, DetectionReason.FIRST_OBSERVATION, Continuity.UNKNOWN)
        }

        val reason = when {
            value != current.value -> DetectionReason.VALUE_CHANGED
            isNeighborInformative(current, frame) -> {
                val neighborChanged = frame.neighbor!!.similarity(current.neighbor!!) < config.sameTileSimilarity
                val moved = shortTransitionSeen || longTransitionSeen
                if (neighborChanged && moved) DetectionReason.SAME_VALUE_ROW_SHIFT else null
            }
            shortTransitionSeen && !longTransitionSeen && !interruptedSinceCommit -> DetectionReason.SAME_VALUE_MOTION
            else -> null
        }
        if (reason == null) {
            commit(frame, value)
            return DetectorResult.SameRound(value)
        }

        val lastEvent = lastEventAtMs
        if (lastEvent != null && frame.timestampMs - lastEvent < config.minRoundIntervalMs) {
            commit(frame, value)
            return DetectorResult.SuppressedByCooldown(value)
        }
        return emit(frame, value, confidence, reason, continuityOf(current, frame))
    }

    private fun emit(
        frame: FrameSample,
        value: Coefficient,
        confidence: Float?,
        reason: DetectionReason,
        continuity: Continuity,
    ): DetectorResult.NewRound {
        lastSequence += 1
        lastEventAtMs = frame.timestampMs
        commit(frame, value)
        return DetectorResult.NewRound(
            RoundEvent(lastSequence, value, confidence, frame.timestampMs, reason, continuity),
        )
    }

    /** The neighbour can only prove a shift if it showed a different value than the newest tile. */
    private fun isNeighborInformative(current: CommittedRound, frame: FrameSample): Boolean {
        if (current.neighbor == null || frame.neighbor == null) return false
        val neighborValue = current.neighborValue ?: return false
        return neighborValue != current.value
    }

    /** After a one-tile shift the neighbour must show the value that was newest before. */
    private fun continuityOf(current: CommittedRound, frame: FrameSample): Continuity {
        if (longTransitionSeen || interruptedSinceCommit) return Continuity.GAP_SUSPECTED
        val neighborValue = (frame.neighborReading as? OcrReading.Valid)?.value ?: return Continuity.UNKNOWN
        return if (neighborValue == current.value) Continuity.CONFIRMED else Continuity.GAP_SUSPECTED
    }

    private fun commit(frame: FrameSample, value: Coefficient) {
        val neighborValue = (frame.neighborReading as? OcrReading.Valid)?.value
        committed = CommittedRound(value, frame.primary, frame.neighbor, neighborValue)
        shortTransitionSeen = false
        longTransitionSeen = false
        interruptedSinceCommit = false
    }

    private fun closeTransition() {
        val start = transitionStartMs ?: return
        if (transitionLastMs - start <= config.maxTransitionMs) shortTransitionSeen = true else longTransitionSeen = true
        transitionStartMs = null
    }

    private fun resetCandidate() {
        candidateValue = null
        candidateFrames = 0
        candidateConfidence = null
    }

    private fun acceptedOrNull(reading: OcrReading): OcrReading.Valid? {
        if (reading !is OcrReading.Valid) return null
        val confidence = reading.confidence
        if (confidence != null && confidence < config.minConfidence) return null
        return reading
    }

    private fun lowConfidenceAsRejection(reading: OcrReading): OcrReading =
        if (reading is OcrReading.Valid) OcrReading.Rejected(reading.rawText, RejectionReason.LOW_CONFIDENCE) else reading

    private fun lowerConfidence(a: Float?, b: Float?): Float? = when {
        a == null -> b
        b == null -> a
        else -> minOf(a, b)
    }
}
