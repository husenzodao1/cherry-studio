package app.coefmonitor.core

import kotlinx.serialization.Serializable

@Serializable
data class AlgorithmStep(
    /** Optional label shown next to the step. */
    val text: String = "",
    /** Time until the next step in ms; null means the global delay applies. */
    val delayMs: Long? = null,
    /** Point on the screen (normalised to the full display) shown by the step guide; null for a note-only step. */
    val point: NormalizedPoint? = null,
)

/** A user-defined algorithm (profile entry). The sequence is the ordered list of enabled ones. */
@Serializable
data class AlgorithmDefinition(
    val name: String,
    val description: String = "",
    val enabled: Boolean = true,
    val steps: List<AlgorithmStep> = emptyList(),
)

object DelayPolicy {
    const val MIN_MS = 0L
    const val MAX_MS = 60_000L
    const val DEFAULT_GLOBAL_MS = 250L
    val QUICK_PICKS_MS = listOf(50L, 100L, 250L, 500L, 1_000L)

    fun isValid(delayMs: Long): Boolean = delayMs in MIN_MS..MAX_MS

    fun effective(step: AlgorithmStep, globalDelayMs: Long): Long = step.delayMs ?: globalDelayMs
}

object AlgorithmLimits {
    const val MAX_NAME_LENGTH = 80
    const val MAX_DESCRIPTION_LENGTH = 2_000
    const val MAX_STEP_TEXT_LENGTH = 500
    const val MAX_STEPS = 500

    /** Safety cap for a single import file only; the sequence itself has no length limit. */
    const val MAX_IMPORT_ALGORITHMS = 10_000

    /** Returns a description of the first problem, or null if the definition is valid. */
    fun problemOf(definition: AlgorithmDefinition): String? = when {
        definition.name.isBlank() -> "name is empty"
        definition.name.length > MAX_NAME_LENGTH -> "name longer than $MAX_NAME_LENGTH characters"
        definition.description.length > MAX_DESCRIPTION_LENGTH -> "description too long"
        definition.steps.size > MAX_STEPS -> "more than $MAX_STEPS steps"
        definition.steps.any { it.text.length > MAX_STEP_TEXT_LENGTH } -> "step text too long"
        definition.steps.any { step -> step.delayMs?.let { !DelayPolicy.isValid(it) } == true } ->
            "step delay outside ${DelayPolicy.MIN_MS}..${DelayPolicy.MAX_MS} ms"
        definition.steps.any { step -> step.point?.let { it.x !in 0f..1f || it.y !in 0f..1f } == true } ->
            "step point outside the screen"
        else -> null
    }
}
