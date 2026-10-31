package tj.hamnavo.core

import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** Shared constants of the Hamnavo stream. */
object Protocol {
    const val TCP_PORT = 47800
    const val DISCOVERY_PORT = 47801
    const val VERSION = 1
    const val HEADER_SIZE = 12
    const val SAMPLE_RATE = 48_000
    const val CHANNELS = 2
    const val FRAME_MS = 10
    private val MAGIC = byteArrayOf('H'.code.toByte(), 'M'.code.toByte(), 'N'.code.toByte(), 'V'.code.toByte())

    val DEFAULT_HEADER = StreamHeader(VERSION, CHANNELS, SAMPLE_RATE)

    /**
     * Header layout (big endian, 12 bytes):
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
}

data class StreamHeader(val version: Int, val channels: Int, val sampleRate: Int) {
    val samplesPerFrame: Int get() = sampleRate * Protocol.FRAME_MS / 1000 * channels
    val frameBytes: Int get() = samplesPerFrame * 2
}
