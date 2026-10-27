package app.coefmonitor.core

/** One point the step guide shows on screen. */
data class GuideMarker(
    /** 1-based number of the step inside its algorithm. */
    val stepNumber: Int,
    val label: String,
    val point: NormalizedPoint,
    /** Configured time until the next step. */
    val delayMs: Long,
    /** How long the marker stays visible (never shorter than a person can notice). */
    val visibleMs: Long,
)

/**
 * Plans the on-screen guide for an algorithm: its point steps in order, each shown for the step's
 * delay. The guide only shows where to tap; the app itself never taps anything.
 */
object StepGuide {
    /** Very short delays (e.g. 50 ms) are stretched so a person can actually see the marker. */
    const val MIN_VISIBLE_MS = 700L

    fun plan(steps: List<AlgorithmStep>, globalDelayMs: Long, readingBand: NormalizedRect?): List<GuideMarker> =
        steps.mapIndexedNotNull { index, step ->
            val point = step.point ?: return@mapIndexedNotNull null
            if (!isAllowed(point, readingBand)) return@mapIndexedNotNull null
            val delay = DelayPolicy.effective(step, globalDelayMs)
            GuideMarker(index + 1, step.text, point, delay, maxOf(delay, MIN_VISIBLE_MS))
        }

    /** Points on the row being read are not allowed: a marker there would look like a new round. */
    fun isAllowed(point: NormalizedPoint, readingBand: NormalizedRect?): Boolean =
        readingBand == null ||
            point.x !in readingBand.left..readingBand.right ||
            point.y !in readingBand.top..readingBand.bottom
}
