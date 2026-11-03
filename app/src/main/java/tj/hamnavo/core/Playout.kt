package tj.hamnavo.core

import kotlin.math.floor
import kotlin.math.roundToInt

/**
 * Receiver: plays the stream so that every phone hears the same sample at the same moment, with
 * as little delay as the slowest phone's network allows.
 *
 * Each frame carries its capture time on the sender's clock and the common delay D. The sample
 * captured at sender time T is due at local time T - offset + D (offset = sender clock - local
 * clock, from [ClockSync]). [render] is asked for the block the speaker presents at local time
 * presentNs and works out which source samples belong there:
 * - small timing errors (clock drift, offset updates, D falling) are absorbed by playing up to
 *   0.5 % more or fewer source samples per block, linearly interpolated: inaudible;
 * - a large error is fixed at once: when late, skip ahead with a crossfade; when early (D rose),
 *   fade out and wait in silence until the audio is due, then fade in;
 * - a frame that is missing when due is concealed (time-reversed tail fading out): never a click.
 * It also measures how late frames arrive, which is the delay this phone asks the sender for.
 */
class Playout(
    private val channels: Int = Protocol.CHANNELS,
    private val sampleRate: Int = Protocol.SAMPLE_RATE,
    private val capacityFrames: Int = 512,
) {
    /** Samples per channel in one block; equal to one frame (10 ms). */
    val blockSamples = sampleRate * Protocol.FRAME_MS / 1000

    private val jumpSamples = sampleRate * 20 / 1000.0
    private val maxAdjust = blockSamples * 0.005
    private val gain = 0.05

    private val ring = arrayOfNulls<ShortArray>(capacityFrames)
    private val ringSeq = LongArray(capacityFrames) { -1L }
    private var firstSeq = -1L
    private var newestSeq = -1L
    private var newestNs = 0L
    private var delayNs = 0L

    private var cursor = Double.NaN
    private var audible = false
    private var waiting = false
    private var missing = false
    private val last = ShortArray(blockSamples * channels)

    /** Times audio was missing when due. */
    var gaps = 0L
        private set
    /** Large timing corrections (waiting for a grown delay, skipping ahead). */
    var jumps = 0L
        private set
    var lateFrames = 0L
        private set
    /** Source sample (per channel) of the first sample of the last block; NaN if it was not stream audio. */
    var lastSourcePos = Double.NaN
        private set

    private var transitNow = 0L
    private var transitBefore = 0L
    private var transitBucket = Long.MIN_VALUE
    private var leadNs = -1L
    private var boundNow = Long.MIN_VALUE
    private var boundBefore = Long.MIN_VALUE
    private var boundBucket = Long.MIN_VALUE

    @Synchronized fun push(frame: AudioFrame, arrivalNs: Long, offsetNs: Long?) {
        val pcm = ShortArray(frame.pcm.size / 2)
        for (i in pcm.indices) {
            pcm[i] = ((frame.pcm[2 * i].toInt() and 0xFF) or (frame.pcm[2 * i + 1].toInt() shl 8)).toShort()
        }
        val slot = (frame.seq % capacityFrames).toInt()
        ring[slot] = pcm
        ringSeq[slot] = frame.seq
        if (firstSeq < 0) firstSeq = frame.seq
        if (frame.seq > newestSeq) {
            newestSeq = frame.seq
            newestNs = frame.captureNs
        }
        delayNs = frame.delayMs * 1_000_000L

        // Without clock sync the sender's clock is at least (capture end - arrival) ahead of ours.
        if (boundBucket == Long.MIN_VALUE || arrivalNs - boundBucket > 10_000_000_000L) {
            boundBefore = boundNow
            boundNow = Long.MIN_VALUE
            boundBucket = arrivalNs
        }
        boundNow = maxOf(boundNow, frame.captureNs + Protocol.FRAME_NS - arrivalNs)

        val offset = offsetNs ?: return
        if (transitBucket == Long.MIN_VALUE || arrivalNs - transitBucket > 60_000_000_000L) {
            transitBefore = transitNow
            transitNow = 0
            transitBucket = arrivalNs
        }
        transitNow = maxOf(transitNow, arrivalNs - (frame.captureNs - offset))
        if (!cursor.isNaN() && (frame.seq + 1) * blockSamples <= cursor) lateFrames++
    }

    /** Offset estimate from arrival times alone, for when clock sync gets no answers. */
    val fallbackOffsetNs: Long? @Synchronized get() = maxOf(boundNow, boundBefore).takeIf { it != Long.MIN_VALUE }

    /**
     * Delay (ms) this phone needs: the longest trip of a frame in the last 1-2 minutes, plus how far
     * ahead the speaker is fed, plus one frame and a 10 ms margin.
     */
    val requestedDelayMs: Int @Synchronized get() {
        val ns = maxOf(transitNow, transitBefore) + maxOf(leadNs, 0) + Protocol.FRAME_NS + 10_000_000L
        return ((ns + 4_999_999) / 5_000_000 * 5).toInt().coerceIn(20, 1000)
    }

    val delayMs: Int @Synchronized get() = (delayNs / 1_000_000).toInt()

    /**
     * Fills [out] (one block, interleaved) with what must be heard from local time [presentNs];
     * [nowNs] is the local time now. Returns true if the block is stream audio.
     */
    @Synchronized fun render(presentNs: Long, nowNs: Long, offsetNs: Long?, out: ShortArray): Boolean {
        val lead = presentNs - nowNs
        leadNs = if (leadNs < 0) lead else (leadNs * 31 + lead) / 32
        lastSourcePos = Double.NaN
        if (offsetNs == null || newestSeq < 0) return silence(out)
        val senderNs = presentNs + offsetNs - delayNs
        val expected = newestSeq.toDouble() * blockSamples + (senderNs - newestNs) * (sampleRate / 1e9)
        if (expected < firstSeq.toDouble() * blockSamples) {
            cursor = Double.NaN // due audio was captured before this stream began
            return silence(out)
        }
        if (cursor.isNaN()) cursor = expected
        var err = cursor - expected
        if (err > jumpSamples) {
            // Early: the common delay grew. Wait in silence until this audio is due.
            if (!waiting) jumps++
            waiting = true
            return silence(out)
        }
        waiting = false
        var skipped = false
        if (err < -jumpSamples) {
            jumps++
            cursor = expected
            err = 0.0
            skipped = true
        }
        val step = blockSamples - (err * gain).coerceIn(-maxAdjust, maxAdjust)
        if (!interpolate(cursor, step, out)) {
            if (!missing) gaps++
            missing = true
            cursor += step
            return silence(out)
        }
        missing = false
        lastSourcePos = cursor
        cursor += step
        if (!audible) fadeIn(out) else if (skipped) crossfadeFromTail(out)
        audible = true
        out.copyInto(last)
        return true
    }

    private fun frame(seq: Long): ShortArray? {
        if (seq < 0) return null
        val slot = (seq % capacityFrames).toInt()
        return if (ringSeq[slot] == seq) ring[slot] else null
    }

    private fun interpolate(start: Double, step: Double, out: ShortArray): Boolean {
        val n = blockSamples.toLong()
        val from = Math.floorDiv(floor(start).toLong(), n)
        val to = Math.floorDiv(floor(start + step).toLong() + 1, n)
        for (f in from..to) if (frame(f) == null) return false
        val inc = step / blockSamples
        for (j in 0 until blockSamples) {
            val p = start + j * inc
            val i0 = floor(p).toLong()
            val frac = p - i0
            val f0 = frame(Math.floorDiv(i0, n))!!
            val o0 = Math.floorMod(i0, n).toInt()
            val f1 = frame(Math.floorDiv(i0 + 1, n))!!
            val o1 = Math.floorMod(i0 + 1, n).toInt()
            for (c in 0 until channels) {
                val a = f0[o0 * channels + c]
                val b = f1[o1 * channels + c]
                out[j * channels + c] = (a + (b - a) * frac).roundToInt().toShort()
            }
        }
        return true
    }

    /** Silence; right after audio, the time-reversed last block fading out (continues without a click). */
    private fun silence(out: ShortArray): Boolean {
        if (audible) {
            for (j in 0 until blockSamples) {
                val g = (blockSamples - 1 - j).toDouble() / blockSamples
                for (c in 0 until channels) {
                    out[j * channels + c] = (last[(blockSamples - 1 - j) * channels + c] * g).roundToInt().toShort()
                }
            }
            audible = false
        } else {
            out.fill(0)
        }
        return false
    }

    private fun fadeIn(out: ShortArray) {
        val n = minOf(blockSamples, sampleRate / 200) // 5 ms
        for (j in 0 until n) for (c in 0 until channels) {
            out[j * channels + c] = (out[j * channels + c] * j / n).toShort()
        }
    }

    /** After skipping ahead: blend from the continuation of the last block into the new audio. */
    private fun crossfadeFromTail(out: ShortArray) {
        val n = minOf(blockSamples, sampleRate / 400) // 2.5 ms
        for (j in 0 until n) for (c in 0 until channels) {
            val tail = last[(blockSamples - 1 - j) * channels + c]
            val k = j * channels + c
            out[k] = ((tail * (n - j) + out[k] * j) / n).toShort()
        }
    }
}
