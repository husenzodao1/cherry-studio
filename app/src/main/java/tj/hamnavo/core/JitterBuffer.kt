package tj.hamnavo.core

/**
 * Frame jitter buffer. Playback starts once [startFrames] are queued; the queue never holds more
 * than [maxFrames] (oldest frames are dropped). On underrun it goes back to buffering.
 * The playback rate is never changed.
 */
class JitterBuffer(val startFrames: Int, val maxFrames: Int) {
    private val frames = ArrayDeque<ByteArray>()
    private var playing = false

    var dropped = 0L
        private set
    var underruns = 0L
        private set

    init { require(startFrames in 1..maxFrames) }

    @Synchronized fun push(frame: ByteArray) {
        frames.addLast(frame)
        while (frames.size > maxFrames) { frames.removeFirst(); dropped++ }
        if (!playing && frames.size >= startFrames) playing = true
    }

    /** Next frame to play, or null while buffering. */
    @Synchronized fun poll(): ByteArray? {
        if (!playing) return null
        val f = frames.removeFirstOrNull()
        if (f == null) { playing = false; underruns++ }
        return f
    }

    @Synchronized fun clear() { frames.clear(); playing = false }

    val size: Int @Synchronized get() = frames.size
    val isPlaying: Boolean @Synchronized get() = playing

    companion object {
        fun forMillis(frameMs: Int = Protocol.FRAME_MS, startMs: Int = 40, maxMs: Int = 120) =
            JitterBuffer(startMs / frameMs, maxMs / frameMs)
    }
}
