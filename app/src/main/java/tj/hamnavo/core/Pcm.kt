package tj.hamnavo.core

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.sin

/** Helpers for interleaved little-endian PCM16. */
object Pcm {
    fun clamp(v: Int): Short = v.coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()

    fun mix(a: Short, b: Short): Short = clamp(a + b)

    fun getSample(pcm: ByteArray, index: Int): Short =
        ((pcm[2 * index].toInt() and 0xFF) or (pcm[2 * index + 1].toInt() shl 8)).toShort()

    fun setSample(pcm: ByteArray, index: Int, value: Short) {
        pcm[2 * index] = value.toInt().toByte()
        pcm[2 * index + 1] = (value.toInt() shr 8).toByte()
    }

    /** Saturating mix of [src] (from [srcOffset]) into [dst]. Returns number of samples mixed. */
    fun mixInto(dst: ByteArray, src: ShortArray, srcOffset: Int): Int {
        val n = min(dst.size / 2, src.size - srcOffset).coerceAtLeast(0)
        for (i in 0 until n) setSample(dst, i, mix(getSample(dst, i), src[srcOffset + i]))
        return n
    }

    /** Peak absolute sample value, 0..32768. */
    fun peak(pcm: ByteArray, length: Int = pcm.size): Int {
        var p = 0
        for (i in 0 until length / 2) {
            val s = abs(getSample(pcm, i).toInt())
            if (s > p) p = s
        }
        return p
    }

    /** Linear fade-in (gain 0 -> 1) over the first [frames] sample frames, in place. */
    fun fadeIn(pcm: ByteArray, channels: Int, frames: Int) {
        val n = min(frames, pcm.size / 2 / channels)
        for (i in 0 until n) for (c in 0 until channels) {
            val k = i * channels + c
            setSample(pcm, k, (getSample(pcm, k) * i / n).toShort())
        }
    }

    /** Linear fade-out (gain 1 -> 0) over the whole buffer, in place. */
    fun fadeOut(pcm: ByteArray, channels: Int) {
        val n = pcm.size / 2 / channels
        for (i in 0 until n) for (c in 0 until channels) {
            val k = i * channels + c
            setSample(pcm, k, (getSample(pcm, k) * (n - 1 - i) / n).toShort())
        }
    }

    /** Time-reversed copy; it starts exactly where [pcm] ends, so it continues without a click. */
    fun reversed(pcm: ByteArray, channels: Int): ByteArray {
        val n = pcm.size / 2 / channels
        val out = ByteArray(pcm.size)
        for (i in 0 until n) for (c in 0 until channels) {
            setSample(out, i * channels + c, getSample(pcm, (n - 1 - i) * channels + c))
        }
        return out
    }

    /** Copy of [to] whose first [frames] sample frames blend smoothly from [from] into [to]. */
    fun crossfade(from: ByteArray, to: ByteArray, channels: Int, frames: Int): ByteArray {
        val out = to.copyOf()
        val n = min(frames, min(from.size, to.size) / 2 / channels)
        for (i in 0 until n) for (c in 0 until channels) {
            val k = i * channels + c
            setSample(out, k, clamp((getSample(from, k) * (n - i) + getSample(to, k) * i) / n))
        }
        return out
    }

    /** Sine tone with short fades, interleaved for [channels]. */
    fun tone(sampleRate: Int, channels: Int, freqHz: Double, durationMs: Int, amplitude: Double = 0.3): ShortArray {
        val frames = sampleRate * durationMs / 1000
        val fade = sampleRate / 200 // 5 ms
        val out = ShortArray(frames * channels)
        for (i in 0 until frames) {
            val env = min(1.0, min(i, frames - 1 - i).toDouble() / fade)
            val v = (sin(2 * PI * freqHz * i / sampleRate) * amplitude * env * Short.MAX_VALUE).toInt()
            for (c in 0 until channels) out[i * channels + c] = clamp(v)
        }
        return out
    }

    fun silence(sampleRate: Int, channels: Int, durationMs: Int) = ShortArray(sampleRate * durationMs / 1000 * channels)

    /** Three short beeps separated by silence. */
    fun beeps(sampleRate: Int, channels: Int, count: Int = 3, beepMs: Int = 150, gapMs: Int = 150): ShortArray {
        val parts = ArrayList<ShortArray>()
        repeat(count) { i ->
            if (i > 0) parts += silence(sampleRate, channels, gapMs)
            parts += tone(sampleRate, channels, 880.0, beepMs)
        }
        val out = ShortArray(parts.sumOf { it.size })
        var pos = 0
        for (p in parts) { p.copyInto(out, pos); pos += p.size }
        return out
    }
}

/** Mixes a one-shot sound into consecutive frames after [trigger] is called. Thread-safe. */
class ToneMixer(private val sound: ShortArray) {
    private var position = -1

    @Synchronized fun trigger() { position = 0 }

    @Synchronized fun stop() { position = -1 }

    /** Starts the sound, or stops it if it is still playing. Returns true if it started. */
    @Synchronized fun toggle(): Boolean {
        position = if (position >= 0) -1 else 0
        return position == 0
    }

    @Synchronized fun mixInto(frame: ByteArray) {
        if (position < 0) return
        position += Pcm.mixInto(frame, sound, position)
        if (position >= sound.size) position = -1
    }

    @get:Synchronized val isActive: Boolean get() = position >= 0
}
