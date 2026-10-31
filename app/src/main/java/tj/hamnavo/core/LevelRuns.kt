package tj.hamnavo.core

/** Finds loud runs in a level timeline (one level per 10 ms frame), used by tests and the UI. */
object LevelRuns {
    data class Run(val startMs: Long, val endMs: Long) {
        val durationMs: Long get() = endMs - startMs
    }

    /**
     * Runs of frames with level >= [threshold]; gaps shorter than [mergeGapMs] are bridged so a
     * single dropped frame does not split a sound in two.
     */
    fun runs(times: LongArray, levels: FloatArray, threshold: Float, frameMs: Long = 10, mergeGapMs: Long = 40): List<Run> {
        val out = ArrayList<Run>()
        var start = -1L
        var last = -1L
        for (i in times.indices) {
            if (levels[i] < threshold) continue
            val t = times[i]
            if (start >= 0 && t - last <= mergeGapMs + frameMs) {
                last = t
            } else {
                if (start >= 0) out += Run(start, last + frameMs)
                start = t
                last = t
            }
        }
        if (start >= 0) out += Run(start, last + frameMs)
        return out
    }
}
