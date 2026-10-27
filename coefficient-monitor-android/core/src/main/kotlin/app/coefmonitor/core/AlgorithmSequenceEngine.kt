package app.coefmonitor.core

import kotlinx.serialization.Serializable

@Serializable
enum class TransitionType { ADVANCE, RESET_TO_FIRST, NO_POSITION_CHANGE }

@Serializable
enum class TransitionReason {
    /** coefficient <= threshold and a next algorithm exists. */
    LOW_COEFFICIENT,

    /** coefficient > threshold while not on Algorithm 1. */
    HIGH_COEFFICIENT,

    /** coefficient > threshold while already on Algorithm 1. */
    ALREADY_AT_FIRST,

    /** coefficient <= threshold on the last configured algorithm: state is kept, user is told to add more. */
    END_OF_SEQUENCE,

    /** No enabled algorithms are configured. */
    NO_ALGORITHMS,
}

/** Positions are zero-based; the UI shows them as "Algorithm N" with N = index + 1. */
data class Transition(
    val previousIndex: Int,
    val newIndex: Int,
    val type: TransitionType,
    val reason: TransitionReason,
)

/**
 * The threshold rule, and nothing else:
 *  - coefficient <= threshold → advance exactly one position;
 *  - coefficient >  threshold → back to the first algorithm (stay there if already on it).
 *
 * There is no length limit and no wrap-around. Reaching the last configured algorithm only
 * blocks further advancing until the user adds more algorithms.
 */
object AlgorithmSequenceEngine {

    fun next(
        currentIndex: Int,
        algorithmCount: Int,
        coefficient: Coefficient,
        threshold: Coefficient,
    ): Transition {
        if (algorithmCount <= 0) {
            return Transition(0, 0, TransitionType.NO_POSITION_CHANGE, TransitionReason.NO_ALGORITHMS)
        }
        val current = currentIndex.coerceIn(0, algorithmCount - 1)
        return if (coefficient <= threshold) {
            if (current + 1 < algorithmCount) {
                Transition(current, current + 1, TransitionType.ADVANCE, TransitionReason.LOW_COEFFICIENT)
            } else {
                Transition(current, current, TransitionType.NO_POSITION_CHANGE, TransitionReason.END_OF_SEQUENCE)
            }
        } else {
            if (current == 0) {
                Transition(0, 0, TransitionType.NO_POSITION_CHANGE, TransitionReason.ALREADY_AT_FIRST)
            } else {
                Transition(current, 0, TransitionType.RESET_TO_FIRST, TransitionReason.HIGH_COEFFICIENT)
            }
        }
    }
}
