package tj.hamnavo.core

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.sin

/**
 * Real TCP + UDP over localhost: one sender, three phones. Every phone has its own clock (a big
 * offset) and its own speaker speed; one phone gets its audio through a relay that holds data
 * back and releases it every 100 ms, like Wi-Fi power saving. All three must play each sample
 * at the same moment.
 */
class MultiPhoneNetworkTest {
    private val loopback = InetAddress.getByName("127.0.0.1")
    private val ms = 1_000_000L

    private class BurstyRelay(upstream: InetSocketAddress, periodMs: Long) : AutoCloseable {
        val server = ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))
        private val open = AtomicBoolean(true)

        init {
            thread(isDaemon = true) {
                val down = runCatching { server.accept() }.getOrNull() ?: return@thread
                val up = Socket().apply { connect(upstream) }
                val pending = ByteArrayOutputStream()
                thread(isDaemon = true) {
                    val buf = ByteArray(8192)
                    val input = up.getInputStream()
                    while (open.get()) {
                        val n = runCatching { input.read(buf) }.getOrDefault(-1)
                        if (n < 0) break
                        synchronized(pending) { pending.write(buf, 0, n) }
                    }
                }
                val out = down.getOutputStream()
                while (open.get()) {
                    Thread.sleep(periodMs)
                    val chunk = synchronized(pending) { pending.toByteArray().also { pending.reset() } }
                    if (runCatching { out.write(chunk); out.flush() }.isFailure) break
                }
                down.close()
                up.close()
            }
        }

        override fun close() {
            open.set(false)
            server.close()
        }
    }

    private class Phone(val name: String, val clockOffset: Long, val speakerPpm: Double) {
        val sync = ClockSync()
        val playout = Playout()
        val client = AudioClient()
        val played = ArrayList<Pair<Long, Double>>()
        var maxJump = 0
        fun local() = System.nanoTime() + clockOffset
    }

    @Test fun threePhonesOverRealSockets_playInStep() {
        val header = Protocol.DEFAULT_HEADER
        val running = AtomicBoolean(true)
        val delay = DelayController()
        val senderClock = { System.nanoTime() + 42_000_000_000L }
        AudioServer(0, header, bindAddress = loopback).start().use { server ->
            DiscoveryResponder(0, server.localPort, "sender", clock = senderClock, onDelayRequest = delay::request).start().use { responder ->
                BurstyRelay(InetSocketAddress(loopback, server.localPort), 100).use { relay ->
                    val phones = listOf(
                        Phone("near", 5_000_000_000L, 0.0),
                        Phone("far", -9_000_000_000L, 200.0),
                        Phone("sleepy", 123_000_000L, -150.0),
                    )
                    val syncs = ArrayList<TimeSyncClient>()
                    for (p in phones) {
                        val port = if (p.name == "sleepy") relay.server.localPort else server.localPort
                        syncs += TimeSyncClient(InetSocketAddress(loopback, responder.localPort), p.sync,
                            { p.playout.requestedDelayMs }, clock = p::local).start()
                        thread(isDaemon = true) {
                            runCatching {
                                p.client.run(InetSocketAddress(loopback, port), onHeader = {}) { f ->
                                    p.playout.push(f, p.local(), p.sync.offsetAt(p.local()))
                                }
                            }
                        }
                        // Speaker: block b is heard at start + b * 10 ms on its own clock; fed 30 ms ahead.
                        thread(isDaemon = true) {
                            val out = ShortArray(p.playout.blockSamples * 2)
                            val start = System.nanoTime() + 300 * ms
                            var b = 0L
                            var last = 0
                            while (running.get()) {
                                val heard = start + (b * 10 * ms / (1 + p.speakerPpm * 1e-6)).toLong()
                                val wait = heard - 30 * ms - System.nanoTime()
                                if (wait > 0) Thread.sleep(wait / 1_000_000, (wait % 1_000_000).toInt())
                                val audio = p.playout.render(heard + p.clockOffset, p.local(), p.sync.offsetAt(p.local()), out)
                                if (audio) synchronized(p.played) { p.played += heard to p.playout.lastSourcePos }
                                for (j in 0 until p.playout.blockSamples) {
                                    p.maxJump = maxOf(p.maxJump, abs(out[2 * j] - last))
                                    last = out[2 * j].toInt()
                                }
                                b++
                            }
                        }
                    }

                    // Sender: a 440 Hz tone, one frame every 10 ms.
                    val t0 = System.nanoTime()
                    val capture = CaptureClock()
                    var k = 0L
                    while (System.nanoTime() - t0 < 9_000 * ms) {
                        val wait = t0 + (k + 1) * 10 * ms - System.nanoTime()
                        if (wait > 0) Thread.sleep(wait / 1_000_000, (wait % 1_000_000).toInt())
                        val pcm = ByteArray(header.frameBytes)
                        for (i in 0 until 480) {
                            val v = (sin(2 * PI * 440 * (k * 480 + i) / 48_000) * 0.5 * Short.MAX_VALUE).toInt().toShort()
                            Pcm.setSample(pcm, 2 * i, v)
                            Pcm.setSample(pcm, 2 * i + 1, v)
                        }
                        server.broadcast(AudioFrame(k, capture.next(senderClock()), delay.currentMs(), pcm))
                        k++
                    }
                    running.set(false)
                    syncs.forEach { it.close() }
                    phones.forEach { it.client.close() }

                    val warm = t0 + 5_000 * ms
                    val ref = synchronized(phones[0].played) { phones[0].played.filter { it.first >= warm } }
                    val skews = ArrayList<Double>()
                    for (o in phones.drop(1)) {
                        val other = synchronized(o.played) { o.played.filter { it.first >= warm } }
                        var j = 0
                        for ((t, pos) in ref) {
                            while (j + 1 < other.size && other[j + 1].second <= pos) j++
                            if (j + 1 >= other.size) break
                            val (ta, pa) = other[j]
                            val (tb, pb) = other[j + 1]
                            if (pos < pa || pb <= pa || pb - pa > 960) continue
                            skews += abs(ta + (tb - ta) * (pos - pa) / (pb - pa) - t) / ms.toDouble()
                        }
                    }
                    skews.sort()
                    val p95 = skews.getOrElse((skews.size * 0.95).toInt()) { 99.0 }
                    println("real sockets: delay ${delay.currentMs()} ms, skew p95 ${"%.2f".format(p95)} ms, " +
                        "max ${"%.2f".format(skews.maxOrNull() ?: 99.0)} ms over ${skews.size} points; " +
                        phones.joinToString { "${it.name}: blocks ${it.played.size}, gaps ${it.playout.gaps}, jumps ${it.playout.jumps}, click ${it.maxJump}" })
                    for (p in phones) {
                        assertTrue("${p.name} played too little: ${p.played.size}", p.played.size > 600)
                        assertTrue("${p.name} click: ${p.maxJump}", p.maxJump < 1500)
                    }
                    assertTrue("too few comparison points: ${skews.size}", skews.size > 500)
                    assertTrue("phones out of step: p95 $p95 ms", p95 < 2.0)
                    assertTrue("delay did not cover the 100 ms bursts: ${delay.currentMs()}", delay.currentMs() >= 100)
                }
            }
        }
    }
}
