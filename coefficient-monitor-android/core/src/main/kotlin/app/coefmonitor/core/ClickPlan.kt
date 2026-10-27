package app.coefmonitor.core

/** One step of an algorithm's auto-click run. */
data class PlannedClick(
    /** 1-based number of the step inside its algorithm. */
    val stepNumber: Int,
    val label: String,
    /** Where to tap; null when the step only waits. */
    val point: NormalizedPoint?,
    /** Time from this step to the next one. */
    val delayMs: Long,
)

/**
 * Plans the auto-clicker run for an algorithm: every step in order, tapping its point (if it has
 * one) and then waiting the step's delay before the next step. Steps without a point are pauses.
 */
object ClickPlan {

    fun plan(steps: List<AlgorithmStep>, globalDelayMs: Long, readingBand: NormalizedRect?): List<PlannedClick> {
        val planned = steps.mapIndexed { index, step ->
            PlannedClick(
                stepNumber = index + 1,
                label = step.text,
                point = step.point?.takeIf { isAllowed(it, readingBand) },
                delayMs = DelayPolicy.effective(step, globalDelayMs),
            )
        }
        // Only pauses (or nothing) means there is nothing to run.
        return if (planned.any { it.point != null }) planned else emptyList()
    }

    /** Taps on the row being read are not allowed: a popup opened there would hide the coefficient. */
    fun isAllowed(point: NormalizedPoint, readingBand: NormalizedRect?): Boolean =
        readingBand == null ||
            point.x !in readingBand.left..readingBand.right ||
            point.y !in readingBand.top..readingBand.bottom
}
