package tj.hamnavo.core

import kotlin.math.roundToInt

/**
 * Sender: the common playout delay D of all phones. Every phone asks for the delay its own network
 * needs; D is the largest request of the phones heard from in the last 5 s, so all phones play in
 * step and none plays a sample before it arrived. D rises at once and falls by at most 2 ms per
 * second (phones follow that without a sound).
 */
class DelayController(
    val minMs: Int = 40,
    val maxMs: Int = 1000,
    initialMs: Int = 120,
    private val clock: () -> Long = System::nanoTime,
) {
    private val requests = HashMap<String, Pair<Int, Long>>()
    private var current = initialMs.toDouble()
    private var lastNs = clock()

    @Synchronized fun request(from: String, ms: Int) {
        requests[from] = ms.coerceIn(minMs, maxMs) to clock()
    }

    @Synchronized fun currentMs(): Int {
        val now = clock()
        requests.entries.removeIf { now - it.value.second > 5_000_000_000L }
        val dt = (now - lastNs) / 1e9
        lastNs = now
        val want = requests.values.maxOfOrNull { it.first } ?: return current.roundToInt()
        current = if (want >= current) want.toDouble() else maxOf(want.toDouble(), current - 2.0 * dt)
        return current.roundToInt()
    }

    val phones: Int @Synchronized get() = requests.size
}

/**
 * Sender: capture time (sender clock) of the first sample of each frame, from the moments the
 * reads return. Scheduling jitter is smoothed away; the slow correction follows the real rate of
 * the capture clock. A jump of more than [resyncNs] (capture stalled) re-anchors the timeline.
 */
class CaptureClock(
    private val frameNs: Long = Protocol.FRAME_NS,
    private val gain: Double = 0.005,
    private val resyncNs: Long = 50_000_000,
) {
    private var t = 0L
    private var started = false

    fun next(readDoneNs: Long): Long {
        val raw = readDoneNs - frameNs
        if (!started || kotlin.math.abs(raw - (t + frameNs)) > resyncNs) {
            t = raw
            started = true
            return t
        }
        t += frameNs
        t += ((raw - t) * gain).toLong()
        return t
    }
}
