package app.coefmonitor.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BalanceControlTest {

    /** Feeds (time in ms, kbit/s or null for a failed measurement) and returns the verdicts. */
    private fun NetworkWatch.feed(vararg samples: Pair<Long, Int?>) = samples.map { (at, kbps) -> onSample(kbps, at) }

    @Test
    fun `automatic mode stops for good after 5 s below 128 kbit-s`() {
        val policy = BalanceControl(network = NetworkMode.AUTO).networkPolicy()!!
        assertEquals(NetworkPolicy(128, 5_000, resumes = false), policy)
        val watch = NetworkWatch(policy)
        assertEquals(
            listOf(NetworkVerdict.OK, NetworkVerdict.SLOW, NetworkVerdict.SLOW, NetworkVerdict.SLOW, NetworkVerdict.STOP),
            watch.feed(0L to 900, 2_000L to 90, 4_000L to null, 6_000L to 40, 7_000L to 20),
        )
    }

    @Test
    fun `a short slow spell does not stop anything`() {
        val watch = NetworkWatch(BalanceControl().networkPolicy()!!)
        val verdicts = watch.feed(0L to 50, 2_000L to 60, 4_000L to 400, 6_000L to 50, 8_000L to 70, 10_000L to 300)
        assertFalse(verdicts.contains(NetworkVerdict.STOP))
        assertEquals(NetworkVerdict.OK, verdicts.last())
    }

    @Test
    fun `manual mode pauses after its seconds and resumes after 1 s fast again`() {
        val policy = BalanceControl(network = NetworkMode.MANUAL, minKbps = 300, slowSeconds = 4).networkPolicy()!!
        val watch = NetworkWatch(policy)
        val verdicts = watch.feed(
            0L to 200, 2_000L to 250, 4_000L to null, // 4 s below 300: pause
            6_000L to 900, 7_000L to 100, // fast once, then slow again: still paused
            8_000L to 800, 9_000L to 700, // fast in two looks a second apart: resume
            10_000L to 900,
        )
        assertEquals(
            listOf(
                NetworkVerdict.SLOW, NetworkVerdict.SLOW, NetworkVerdict.PAUSE,
                NetworkVerdict.SLOW, NetworkVerdict.SLOW,
                NetworkVerdict.SLOW, NetworkVerdict.RESUME,
                NetworkVerdict.OK,
            ),
            verdicts,
        )
        assertFalse(watch.paused)
    }

    @Test
    fun `off measures nothing and settings are validated`() {
        assertNull(BalanceControl(network = NetworkMode.OFF).networkPolicy())
        assertNull(BalanceControl().problem())
        assertTrue(BalanceControl(minKbps = 0).problem() != null)
        assertTrue(BalanceControl(slowSeconds = 1).problem() != null)
        assertTrue(BalanceControl(balance = 0).problem() != null)
    }

    @Test
    fun `speed in kbit per second`() {
        // 13 504 bytes in 250 ms = 432 kbit/s.
        assertEquals(432, kbpsOf(13_504, 250))
        assertEquals(108_032, kbpsOf(13_504, 0))
    }
}
