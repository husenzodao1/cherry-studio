package tj.hamnavo.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import kotlin.concurrent.thread
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.sin

/**
 * Real TCP over localhost: sender -> relay that releases data in 250 ms bursts (like a phone
 * hotspot with Wi-Fi power saving) -> receiver -> jitter buffer -> a real-time 10 ms playback clock.
 */
class BurstyNetworkTest {
    private val loopback = InetAddress.getByName("127.0.0.1")

    /** Forwards one connection, holding the bytes back and releasing them every [periodMs]. */
    private class BurstyRelay(private val upstream: InetSocketAddress, private val periodMs: Long) : AutoCloseable {
        val server = ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))
        @Volatile private var open = true

        init {
            thread(isDaemon = true) {
                val down = runCatching { server.accept() }.getOrNull() ?: return@thread
                val up = Socket()
                up.connect(upstream)
                val pending = ByteArrayOutputStream()
                thread(isDaemon = true) {
                    val buf = ByteArray(8192)
                    val input = up.getInputStream()
                    while (open) {
                        val n = runCatching { input.read(buf) }.getOrDefault(-1)
                        if (n < 0) break
                        synchronized(pending) { pending.write(buf, 0, n) }
                    }
                }
                val out = down.getOutputStream()
                while (open) {
                    Thread.sleep(periodMs)
                    val chunk = synchronized(pending) { pending.toByteArray().also { pending.reset() } }
                    if (runCatching { out.write(chunk); out.flush() }.isFailure) break
                }
                down.close()
                up.close()
            }
        }

        override fun close() {
            open = false
            server.close()
        }
    }

    @Test fun burstyLink_playsWithoutGapsOrClicks() {
        val header = Protocol.DEFAULT_HEADER
        AudioServer(0, header, bindAddress = loopback).start().use { server ->
            BurstyRelay(InetSocketAddress(loopback, server.localPort), 250).use { relay ->
                val jb = JitterBuffer()
                val client = AudioClient()
                thread(isDaemon = true) {
                    runCatching {
                        client.run(InetSocketAddress(loopback, relay.server.localPort), onHeader = {}, onFrame = jb::push)
                    }
                }
                val start = System.nanoTime()
                fun at(ms: Long) = start + ms * 1_000_000

                // Sender: one 440 Hz frame every 10 ms, on a real clock.
                val sending = java.util.concurrent.atomic.AtomicBoolean(true)
                thread(isDaemon = true) {
                    var k = 0L
                    while (sending.get()) {
                        val f = ByteArray(header.frameBytes)
                        for (i in 0 until 480) {
                            val v = (sin(2 * PI * 440 * (k * 480 + i) / 48_000) * 0.5 * Short.MAX_VALUE).toInt().toShort()
                            Pcm.setSample(f, 2 * i, v)
                            Pcm.setSample(f, 2 * i + 1, v)
                        }
                        server.broadcast(f)
                        k++
                        val wait = at(k * 10) - System.nanoTime()
                        if (wait > 0) Thread.sleep(wait / 1_000_000, (wait % 1_000_000).toInt())
                    }
                }

                // Player: one frame every 10 ms for 10 s.
                var last = 0
                var maxJump = 0
                var played = 0
                var glitchesAfter3s = 0L
                for (j in 0 until 1000) {
                    val wait = at(j * 10L) - System.nanoTime()
                    if (wait > 0) Thread.sleep(wait / 1_000_000, (wait % 1_000_000).toInt())
                    if (j == 300) glitchesAfter3s = jb.underruns + jb.dropped
                    val out = jb.poll()
                    if (out != null) played++
                    for (i in 0 until 480) {
                        val s = if (out == null) 0 else Pcm.getSample(out, 2 * i).toInt()
                        maxJump = maxOf(maxJump, abs(s - last))
                        last = s
                    }
                }
                sending.set(false)
                client.close()
                val late = jb.underruns + jb.dropped - glitchesAfter3s
                println("bursty link: underruns ${jb.underruns}, dropped ${jb.dropped}, trimmed ${jb.trimmed}, " +
                    "played $played/1000, target ${jb.targetMs} ms, max jump $maxJump")
                assertEquals("frames dropped", 0L, jb.dropped)
                assertTrue("gaps after settling: $late", late <= 1)
                assertTrue("too much silence: $played", played > 850)
                assertTrue("click: $maxJump", maxJump < 1500)
            }
        }
    }
}
