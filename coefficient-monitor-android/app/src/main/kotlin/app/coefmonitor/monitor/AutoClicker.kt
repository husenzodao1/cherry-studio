package app.coefmonitor.monitor

import app.coefmonitor.AppContainer
import app.coefmonitor.core.AlgorithmDefinition
import app.coefmonitor.core.ClickPlan
import app.coefmonitor.data.AppSettings
import app.coefmonitor.data.DiagnosticLevel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Runs an algorithm's clicks. Shared by the monitoring service (after every round) and the floating
 * panel (Run clicks), so it works whether monitoring runs or not, over any app, and a new run always
 * replaces the one in progress.
 */
class AutoClicker(
    private val container: AppContainer,
    private val scope: CoroutineScope,
) {
    private val controller = AutoClickController(
        scope = scope,
        onProgress = { progress -> container.runtime.update { it.copy(clicks = progress) } },
        onFinished = ::report,
    )
    private var offReported = false

    /** The algorithm whose clicks last ran to the end, as it was then: its amount is still set in the game. */
    @Volatile
    private var lastCompleted: Pair<Int, AlgorithmDefinition>? = null

    /** The run in progress (it becomes [lastCompleted] when it ends without a missed click). */
    @Volatile
    private var running: Pair<Int, AlgorithmDefinition>? = null

    /** Runs all the clicks of the algorithm that is active right now (Run clicks on the panel). */
    suspend fun runActive() = run(container.monitor.sequenceState().activeIndex, allowStakeButtonOnly = false)

    /**
     * Runs the clicks of the algorithm at [activeIndex] (position in the enabled sequence), step by
     * step with the step times in between. Taps on the row being read right now are skipped.
     * When it is the algorithm whose clicks last ran to the end, unchanged, only its last click
     * (the stake button) is tapped, if [AppSettings.stakeButtonOnly] is on: its amount is still set.
     */
    suspend fun run(activeIndex: Int, allowStakeButtonOnly: Boolean = true) {
        val settings = container.settings.current()
        val definition = container.algorithms.allDefinitions().filter { it.enabled }.getOrNull(activeIndex) ?: return
        val band = container.runtime.state.value.rowBand
        val again = allowStakeButtonOnly && settings.stakeButtonOnly && lastCompleted == (activeIndex to definition)
        val clicks = if (again) {
            ClickPlan.stakeButtonOnly(definition.steps, settings.globalDelayMs, band)
        } else {
            ClickPlan.plan(definition.steps, settings.globalDelayMs, band)
        }
        if (clicks.isEmpty()) return
        if (!AutoClickService.connected.value) {
            if (!offReported) {
                log(DiagnosticLevel.WARNING, "The auto-clicker is off in Accessibility settings; Algorithm ${activeIndex + 1} was not clicked")
            }
            offReported = true
            return
        }
        offReported = false
        // A full run changes the amount; it only counts as set once the run ends.
        if (!again) lastCompleted = null
        running = activeIndex to definition
        if (again) log(DiagnosticLevel.INFO, "Algorithm ${activeIndex + 1} again: stake button only (its amount is still set)")
        withContext(Dispatchers.Main) { controller.play(activeIndex + 1, clicks) }
    }

    /** Must be called on the main thread. */
    fun cancel() = controller.cancel()

    private fun report(algorithmNumber: Int, tapped: Int, missed: List<Int>) {
        lastCompleted = running.takeIf { missed.isEmpty() }
        if (missed.isEmpty()) {
            log(DiagnosticLevel.INFO, "Algorithm $algorithmNumber: $tapped click(s) performed")
        } else {
            log(DiagnosticLevel.WARNING, "Algorithm $algorithmNumber: $tapped click(s) performed; step(s) ${missed.joinToString()} could not be clicked")
        }
    }

    private fun log(level: DiagnosticLevel, message: String) {
        scope.launch { container.events.log(level, "AUTO_CLICK", message) }
    }
}
