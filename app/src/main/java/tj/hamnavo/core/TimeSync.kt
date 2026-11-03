package tj.hamnavo.core

import java.io.Closeable
import java.io.IOException
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetSocketAddress
import java.net.SocketTimeoutException
import java.nio.ByteBuffer
import kotlin.concurrent.thread

/**
 * Clock sync over UDP (discovery port). A receiver sends "HMNT" + its time t1 + the delay it needs;
 * the sender answers "HMNT" + t1 + its own time t2.
 */
object TimeSync {
    private val MAGIC = "HMNT".toByteArray()
    const val REQUEST_SIZE = 14
    const val REPLY_SIZE = 20

    fun request(t1: Long, requestedDelayMs: Int): ByteArray =
        ByteBuffer.allocate(REQUEST_SIZE).put(MAGIC).putLong(t1).putShort(requestedDelayMs.coerceIn(0, 65_535).toShort()).array()

    /** (t1, requested delay in ms) of a request, or null. */
    fun parseRequest(b: ByteArray, len: Int): Pair<Long, Int>? {
        if (len != REQUEST_SIZE || !hasMagic(b)) return null
        val buf = ByteBuffer.wrap(b, 4, 10)
        return buf.long to (buf.short.toInt() and 0xFFFF)
    }

    fun reply(t1: Long, t2: Long): ByteArray = ByteBuffer.allocate(REPLY_SIZE).put(MAGIC).putLong(t1).putLong(t2).array()

    /** (t1, t2) of a reply, or null. */
    fun parseReply(b: ByteArray, len: Int): Pair<Long, Long>? {
        if (len != REPLY_SIZE || !hasMagic(b)) return null
        val buf = ByteBuffer.wrap(b, 4, 16)
        return buf.long to buf.long
    }

    private fun hasMagic(b: ByteArray) = (0 until 4).all { b[it] == MAGIC[it] }
}

/**
 * Estimates offset = sender clock - local clock from round trips (t1 local send, t2 sender, t3 local
 * receive). Round trips are weighted by how close they are to the quickest of the last [window]
 * (slow ones waited in a queue, often in one direction only, which skews the result). A weighted
 * straight line through them also measures how fast the two clocks drift apart, so the offset is
 * projected to the moment it is needed instead of going stale.
 */
class ClockSync(private val window: Int = 200) {
    private class Sample(val at: Long, val offset: Long, val rtt: Long)

    private val samples = ArrayDeque<Sample>()

    @Synchronized fun add(t1: Long, t2: Long, t3: Long) {
        if (t3 < t1) return
        samples.addLast(Sample(t3, t2 - (t1 + t3) / 2, t3 - t1))
        while (samples.size > window) samples.removeFirst()
    }

    /** Offset at local time [localNs]; null until three round trips were seen. */
    @Synchronized fun offsetAt(localNs: Long): Long? {
        if (samples.size < 3) return null
        val minRtt = samples.minOf { it.rtt }
        val best = samples.minBy { it.rtt }
        // Weighted line fit: a round trip 1 ms slower than the quickest counts 1/4, 3 ms slower 1/70.
        var sw = 0.0
        var st = 0.0
        var so = 0.0
        for (x in samples) {
            val w = weight(x.rtt - minRtt)
            sw += w
            st += w * (x.at - best.at)
            so += w * (x.offset - best.offset)
        }
        val tMean = st / sw
        val oMean = so / sw
        var sxx = 0.0
        var sxy = 0.0
        for (x in samples) {
            val w = weight(x.rtt - minRtt)
            val dx = (x.at - best.at) - tMean
            sxx += w * dx * dx
            sxy += w * dx * ((x.offset - best.offset) - oMean)
        }
        val spread = samples.last().at - samples.first().at
        // Drift is only trusted over a few seconds of samples, and never beyond 500 ppm.
        val slope = if (spread > 3_000_000_000L && sxx > 0) (sxy / sxx).coerceIn(-500e-6, 500e-6) else 0.0
        return best.offset + (oMean + slope * ((localNs - best.at) - tMean)).toLong()
    }

    private fun weight(extraRttNs: Long) = kotlin.math.exp(-extraRttNs / 700_000.0)

    val bestRttNs: Long? @Synchronized get() = samples.minOfOrNull { it.rtt }
}

/** Receiver: asks the sender for its clock every [intervalMs] and reports the delay this phone needs. */
class TimeSyncClient(
    private val sender: InetSocketAddress,
    private val sync: ClockSync,
    private val requestedDelayMs: () -> Int,
    private val clock: () -> Long = System::nanoTime,
    private val intervalMs: Long = 100,
    configure: (DatagramSocket) -> Unit = {},
) : Closeable {
    private val socket = DatagramSocket().also(configure)
    @Volatile private var open = true

    fun start(): TimeSyncClient {
        thread(name = "hmnv-timesync", isDaemon = true) {
            val buf = ByteArray(64)
            while (open) {
                val req = TimeSync.request(clock(), requestedDelayMs())
                try {
                    socket.send(DatagramPacket(req, req.size, sender))
                } catch (_: IOException) {
                    if (!open) break
                }
                val next = System.nanoTime() + intervalMs * 1_000_000
                while (open) {
                    val left = (next - System.nanoTime()) / 1_000_000
                    if (left <= 0) break
                    try {
                        socket.soTimeout = left.toInt().coerceAtLeast(1)
                        val p = DatagramPacket(buf, buf.size)
                        socket.receive(p)
                        val t3 = clock()
                        val (t1, t2) = TimeSync.parseReply(p.data, p.length) ?: continue
                        sync.add(t1, t2, t3)
                    } catch (_: SocketTimeoutException) {
                        break
                    } catch (_: IOException) {
                        if (!open) break
                    }
                }
            }
        }
        return this
    }

    override fun close() {
        open = false
        socket.close()
    }
}
