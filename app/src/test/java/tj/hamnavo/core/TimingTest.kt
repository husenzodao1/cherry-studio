package tj.hamnavo.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.InetAddress
import java.net.InetSocketAddress
import kotlin.random.Random

class TimingTest {
    @Test fun frameRoundTrip() {
        val pcm = ByteArray(1920) { it.toByte() }
        val bytes = Protocol.encodeFrame(AudioFrame(4_000_000_000L, -123_456_789_012L, 345, pcm))
        val f = Protocol.decodeFrame(bytes.copyOf(Protocol.FRAME_HEADER_SIZE), bytes.copyOfRange(Protocol.FRAME_HEADER_SIZE, bytes.size))
        assertEquals(4_000_000_000L, f.seq)
        assertEquals(-123_456_789_012L, f.captureNs)
        assertEquals(345, f.delayMs)
        assertTrue(pcm.contentEquals(f.pcm))
    }

    @Test fun timeSyncPackets() {
        val req = TimeSync.request(42L, 130)
        assertEquals(42L to 130, TimeSync.parseRequest(req, req.size))
        val rep = TimeSync.reply(42L, -7L)
        assertEquals(42L to -7L, TimeSync.parseReply(rep, rep.size))
        assertNull(TimeSync.parseReply(req, req.size))
        assertNull(TimeSync.parseRequest("HMNV?".toByteArray(), 5))
    }

    @Test fun clockSyncTrustsTheQuickestRoundTrip() {
        val sync = ClockSync()
        val offset = 5_000_000_000L
        val rnd = Random(1)
        assertNull(sync.offsetAt(0))
        repeat(40) {
            val t1 = it * 250_000_000L
            val up = 1_000_000L + rnd.nextLong(30_000_000) // queueing makes most trips slow and lopsided
            val down = 1_000_000L + rnd.nextLong(80_000_000)
            sync.add(t1, t1 + up + offset, t1 + up + down)
        }
        val err = kotlin.math.abs(sync.offsetAt(10_000_000_000L)!! - offset)
        assertTrue("offset error ${err / 1e6} ms", err < 5_000_000)
    }

    @Test fun clockSyncFollowsDrift() {
        val sync = ClockSync()
        val rnd = Random(2)
        val ppm = 200e-6 // the sender's clock runs 200 ppm fast
        for (i in 0 until 200) {
            val t1 = i * 100_000_000L
            val up = 1_000_000L + rnd.nextLong(4_000_000)
            val down = 1_000_000L + rnd.nextLong(4_000_000)
            val t2 = ((t1 + up) * (1 + ppm)).toLong() + 3_000_000_000L
            sync.add(t1, t2, t1 + up + down)
        }
        val now = 20_000_000_000L
        val truth = (now * (1 + ppm)).toLong() + 3_000_000_000L - now
        val err = kotlin.math.abs(sync.offsetAt(now)!! - truth)
        assertTrue("offset error ${err / 1e6} ms", err < 600_000)
    }

    @Test fun clockSyncOverUdp() {
        val senderOffset = 777_000_000_000L
        val sync = ClockSync()
        val requests = ArrayList<Int>()
        DiscoveryResponder(0, 47800, "a", clock = { System.nanoTime() + senderOffset }, onDelayRequest = { _, ms -> synchronized(requests) { requests += ms } }).start().use { r ->
            TimeSyncClient(InetSocketAddress(InetAddress.getByName("127.0.0.1"), r.localPort), sync, { 90 }, intervalMs = 20).start().use {
                val end = System.currentTimeMillis() + 3000
                while ((sync.offsetAt(System.nanoTime()) == null || synchronized(requests) { requests.size } < 5) && System.currentTimeMillis() < end) Thread.sleep(10)
            }
        }
        val err = kotlin.math.abs(sync.offsetAt(System.nanoTime())!! - senderOffset)
        assertTrue("offset error ${err / 1e6} ms", err < 2_000_000)
        assertTrue(synchronized(requests) { requests.all { it == 90 } })
    }

    @Test fun delayRisesAtOnceFallsSlowly() {
        var now = 0L
        val d = DelayController(clock = { now })
        assertEquals(120, d.currentMs())
        d.request("a", 60)
        d.request("b", 200)
        assertEquals(200, d.currentMs())
        now += 1_000_000_000
        d.request("a", 60)
        d.request("b", 80)
        assertEquals(198, d.currentMs()) // 2 ms per second
        repeat(10) {
            now += 1_000_000_000
            d.request("a", 60)
        }
        // "b" was not heard for 10 s: only "a" counts, still falling slowly.
        assertEquals(178, d.currentMs())
        d.request("c", 2000)
        assertEquals(1000, d.currentMs())
    }

    @Test fun captureClockSmoothsJitterAndFollowsDrift() {
        val clock = CaptureClock()
        val rnd = Random(3)
        val rate = 1 + 300e-6 // capture clock 300 ppm slower than ours
        var maxErr = 0L
        for (k in 0 until 6000) {
            val frameStart = (k * 10_000_000L * rate).toLong()
            val readDone = frameStart + 10_000_000L + rnd.nextLong(3_000_000)
            val t = clock.next(readDone)
            if (k > 1000) maxErr = maxOf(maxErr, kotlin.math.abs(t - frameStart - 1_500_000))
        }
        assertTrue("timestamp error ${maxErr / 1e6} ms", maxErr < 1_000_000)
    }

    @Test fun dropOldestQueueNeverBlocks() {
        val q = DropOldestQueue<Int>(3)
        repeat(10) { q.offer(it) }
        assertEquals(3, q.size)
        assertEquals(7L, q.dropped)
        assertEquals(7, q.poll(0))
        assertEquals(8, q.poll(0))
        assertEquals(9, q.poll(0))
        assertNull(q.poll(10))
    }
}
