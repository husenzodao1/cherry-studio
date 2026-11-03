package tj.hamnavo.core

import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** Shared constants of the Hamnavo stream. */
object Protocol {
    const val TCP_PORT = 47800
    const val DISCOVERY_PORT = 47801
    const val VERSION = 2
    const val HEADER_SIZE = 12
    const val FRAME_HEADER_SIZE = 16
    const val SAMPLE_RATE = 48_000
    const val CHANNELS = 2
    const val FRAME_MS = 10
    const val FRAME_NS = FRAME_MS * 1_000_000L
    private val MAGIC = byteArrayOf('H'.code.toByte(), 'M'.code.toByte(), 'N'.code.toByte(), 'V'.code.toByte())

    val DEFAULT_HEADER = StreamHeader(VERSION, CHANNELS, SAMPLE_RATE)

    /**
     * Stream header (big endian, 12 bytes):
     * 0..3 "HMNV", 4 version, 5 channels, 6..7 bits per sample (16), 8..11 sample rate.
     */
    fun encodeHeader(h: StreamHeader): ByteArray =
        ByteBuffer.allocate(HEADER_SIZE).order(ByteOrder.BIG_ENDIAN)
            .put(MAGIC)
            .put(h.version.toByte())
            .put(h.channels.toByte())
            .putShort(16)
            .putInt(h.sampleRate)
            .array()

    fun decodeHeader(bytes: ByteArray): StreamHeader {
        if (bytes.size < HEADER_SIZE) throw IOException("header too short")
        val buf = ByteBuffer.wrap(bytes, 0, HEADER_SIZE).order(ByteOrder.BIG_ENDIAN)
        val magic = ByteArray(4).also { buf.get(it) }
        if (!magic.contentEquals(MAGIC)) throw IOException("bad magic")
        val version = buf.get().toInt() and 0xFF
        val channels = buf.get().toInt() and 0xFF
        val bits = buf.short.toInt()
        val rate = buf.int
        if (version != VERSION) throw IOException("unsupported version $version")
        if (bits != 16 || channels !in 1..2 || rate !in 8_000..192_000) throw IOException("unsupported format")
        return StreamHeader(version, channels, rate)
    }

    /**
     * Each frame (big endian header, 16 bytes, then little-endian PCM16):
     * 0..3 sequence number, 4..11 capture time of its first sample on the sender's clock (ns),
     * 12..13 common playout delay (ms), 14..15 reserved.
     */
    fun encodeFrame(f: AudioFrame): ByteArray {
        val out = ByteArray(FRAME_HEADER_SIZE + f.pcm.size)
        ByteBuffer.wrap(out).order(ByteOrder.BIG_ENDIAN)
            .putInt(f.seq.toInt())
            .putLong(f.captureNs)
            .putShort(f.delayMs.coerceIn(0, 65_535).toShort())
            .putShort(0)
        f.pcm.copyInto(out, FRAME_HEADER_SIZE)
        return out
    }

    fun decodeFrame(header: ByteArray, pcm: ByteArray): AudioFrame {
        val buf = ByteBuffer.wrap(header, 0, FRAME_HEADER_SIZE).order(ByteOrder.BIG_ENDIAN)
        val seq = buf.int.toLong() and 0xFFFF_FFFFL
        val captureNs = buf.long
        val delayMs = buf.short.toInt() and 0xFFFF
        return AudioFrame(seq, captureNs, delayMs, pcm)
    }
}

data class StreamHeader(val version: Int, val channels: Int, val sampleRate: Int) {
    val samplesPerFrame: Int get() = sampleRate * Protocol.FRAME_MS / 1000 * channels
    val frameBytes: Int get() = samplesPerFrame * 2
}

/** One 10 ms frame: [seq], capture time of its first sample on the sender's clock, common delay, PCM. */
class AudioFrame(val seq: Long, val captureNs: Long, val delayMs: Int, val pcm: ByteArray)
