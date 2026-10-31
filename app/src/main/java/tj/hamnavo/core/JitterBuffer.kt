package tj.hamnavo.core

/**
 * Adaptive jitter buffer for fixed-size PCM16 frames. The playback rate is never changed.
 *
 * Wi-Fi from a phone hotspot delivers audio in bursts (power saving holds packets for 100-300 ms),
 * so a small fixed buffer alternates between overflow (audio jumps forward) and underrun (gaps).
 * Instead:
 * - playback starts when [targetFrames] are queued. The buffer remembers the longest time without
 *   any arriving audio over the last 5 minutes (holes). After an underrun the target grows by how
 *   long the gap lasted (at least [underrunStepMs]) and to at least the longest recent hole + 50 ms,
 *   so one gap teaches the buffer how deep the network's holes are. That target is kept for
 *   5 minutes and it never goes below the longest recent hole + 50 ms; above that, every 30 s in
 *   which the queue kept more than 50 ms to spare lowers it (in proportion to the spare), so the
 *   delay settles just above what the network needs;
 * - when the queue stays fuller than the target for a while (after a burst, or clock drift between
 *   the phones), one frame is skipped at a time with a short crossfade;
 * - frames above target + [headroomMs] are dropped (oldest first), also with a crossfade;
 * - a gap fades out (time-reversed last frame) and playback fades back in: no clicks.
 */
class JitterBuffer(
    private val channels: Int = Protocol.CHANNELS,
    val frameMs: Int = Protocol.FRAME_MS,
    val minTargetMs: Int = 60,
    val maxTargetMs: Int = 1000,
    initialTargetMs: Int = 200,
    val headroomMs: Int = 600,
    val underrunStepMs: Int = 50,
    private val sampleRate: Int = Protocol.SAMPLE_RATE,
) {
    private val frames = ArrayDeque<ByteArray>()
    private var playing = false
    private var last: ByteArray? = null
    private var concealed = false
    private var fadeInNext = false
    private var skipFrom: ByteArray? = null

    private val fadeFrames = sampleRate * 5 / 1000 // 5 ms
    private val headroomFrames = headroomMs / frameMs
    private val slackFrames = 2

    private var windowMin = Int.MAX_VALUE
    private var windowPolls = 0
    private var periodMin = Int.MAX_VALUE
    private var periodPolls = 0
    private var pollsSinceTrim = 0
    private var pollsSinceUnderrun = Long.MAX_VALUE / 2
    private var floorFrames = 0
    private var starving = false
    private var starvedPolls = 0
    private var holePolls = 0
    private var holeMaxNow = 0
    private var holeMaxBefore = 0
    private var holeAgePolls = 0
    private var trimPending = false

    var targetFrames = (initialTargetMs / frameMs).coerceIn(minTargetMs / frameMs, maxTargetMs / frameMs)
        private set
    var underruns = 0L
        private set
    var dropped = 0L
        private set
    var trimmed = 0L
        private set

    @Synchronized fun push(frame: ByteArray) {
        holeMaxNow = maxOf(holeMaxNow, holePolls)
        holePolls = 0
        frames.addLast(frame)
        while (frames.size > targetFrames + headroomFrames) {
            val d = frames.removeFirst()
            if (playing && skipFrom == null) skipFrom = d
            dropped++
        }
    }

    /** Next frame to play, or null for silence. */
    /** Longest time without arriving audio in the last 2.5..5 minutes, in frames. */
    private val longestHole: Int get() = maxOf(holeMaxNow, holeMaxBefore)

    @Synchronized fun poll(): ByteArray? {
        holePolls++
        if (++holeAgePolls >= 15_000) { // 2.5 min buckets
            holeMaxBefore = holeMaxNow
            holeMaxNow = 0
            holeAgePolls = 0
        }
        if (starving) {
            if (frames.isEmpty()) {
                starvedPolls++
            } else {
                // Audio is back: make the target cover this gap and every recent hole.
                starving = false
                val grown = targetFrames + maxOf(starvedPolls, underrunStepMs / frameMs)
                val needed = longestHole + 50 / frameMs
                targetFrames = minOf(maxTargetMs / frameMs, maxOf(grown, needed))
                floorFrames = targetFrames
            }
        }
        if (!playing) {
            if (frames.size < targetFrames) return conceal()
            playing = true
            fadeInNext = true
            windowMin = Int.MAX_VALUE
            windowPolls = 0
        }
        if (frames.isEmpty()) {
            playing = false
            underruns++
            starving = true
            starvedPolls = 0
            pollsSinceUnderrun = 0
            periodMin = Int.MAX_VALUE
            periodPolls = 0
            skipFrom = null
            return conceal()
        }
        var f = frames.removeFirst()
        skipFrom?.let {
            f = Pcm.crossfade(it, f, channels, fadeFrames / 2)
            skipFrom = null
        }
        if (fadeInNext) {
            f = f.copyOf()
            Pcm.fadeIn(f, channels, fadeFrames)
            fadeInNext = false
            concealed = false
        }
        last = f
        adapt()
        return f
    }

    private fun adapt() {
        windowMin = minOf(windowMin, frames.size)
        periodMin = minOf(periodMin, frames.size)
        windowPolls++
        periodPolls++
        pollsSinceTrim++
        pollsSinceUnderrun++
        if (windowPolls >= 200) { // 2 s: was the queue fuller than needed the whole time?
            trimPending = windowMin > targetFrames + slackFrames
            windowMin = Int.MAX_VALUE
            windowPolls = 0
        }
        if (periodPolls >= 3000) { // 30 s: never close to empty, so less delay is enough
            // Never below a hole the network had recently, nor below a target that just worked.
            val floor = maxOf(longestHole + 50 / frameMs, if (pollsSinceUnderrun < 30_000) floorFrames else 0)
            if (periodMin >= 5) {
                val lower = maxOf(1, (periodMin - 5) / 3)
                targetFrames = maxOf(floor, minTargetMs / frameMs, targetFrames - lower)
            }
            periodMin = Int.MAX_VALUE
            periodPolls = 0
        }
        // At most one skipped frame every 0.5 s, so nobody hears it.
        if (trimPending && pollsSinceTrim >= 50 && frames.size > targetFrames + slackFrames && skipFrom == null) {
            skipFrom = frames.removeFirst()
            trimmed++
            pollsSinceTrim = 0
        }
    }

    private fun conceal(): ByteArray? {
        val l = last ?: return null
        if (concealed) return null
        concealed = true
        return Pcm.reversed(l, channels).also { Pcm.fadeOut(it, channels) }
    }

    @Synchronized fun clear() {
        frames.clear()
        playing = false
        last = null
        skipFrom = null
        concealed = false
        fadeInNext = false
        trimPending = false
    }

    val size: Int @Synchronized get() = frames.size
    val isPlaying: Boolean @Synchronized get() = playing
    val bufferedMs: Int @Synchronized get() = frames.size * frameMs
    val targetMs: Int @Synchronized get() = targetFrames * frameMs
}
