package app.coefmonitor.monitor

import android.os.SystemClock
import app.coefmonitor.core.PlannedClick
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Runs an algorithm's steps one after another: taps each step's point through [AutoClickService]
 * and waits the step's time (counted from the start of the tap) before the next step. A new run,
 * Pause and Stop cancel the run in progress.
 */
class AutoClickController(
    private val scope: CoroutineScope,
    private val onProgress: (ClickProgress?) -> Unit,
    private val onFinished: (algorithmNumber: Int, tapped: Int, missed: List<Int>) -> Unit,
) {
    private var job: Job? = null

    /** Must be called on the main thread. Replaces any run that is still in progress. */
    fun play(algorithmNumber: Int, clicks: List<PlannedClick>) {
        cancel()
        if (clicks.isEmpty()) return
        job = scope.launch {
            var tapped = 0
            val missed = mutableListOf<Int>()
            try {
                clicks.forEachIndexed { index, click ->
                    val started = SystemClock.uptimeMillis()
                    onProgress(ClickProgress(algorithmNumber, click.stepNumber, index + 1, clicks.size, click.label, click.delayMs))
                    val point = click.point
                    if (point != null) {
                        if (AutoClickService.tap(point)) {
                            tapped++
                        } else {
                            missed += click.stepNumber
                        }
                    }
                    delay((click.delayMs - (SystemClock.uptimeMillis() - started)).coerceAtLeast(0))
                }
                onFinished(algorithmNumber, tapped, missed)
            } finally {
                onProgress(null)
            }
        }
    }

    fun cancel() {
        job?.cancel()
        job = null
    }
}
