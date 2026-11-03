package tj.hamnavo.core

import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.PriorityQueue
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.sin
import kotlin.random.Random

/**
 * Simulates one sender and several phones on one true timeline: every phone has its own clock
 * (offset + drift), its own speaker clock (drift), its own Wi-Fi timing. It runs the real
 * CaptureClock, DelayController, ClockSync and Playout and checks when each phone really plays
 * each source sample.
 */
class SyncSimulationTest {
    private val ms = 1_000_000L

    /** Network model: true delivery time for something sent at true time [t]. */
    fun interface Net {
        fun deliver(t: Long): Long
    }

    private fun calm(seed: Int) = Random(seed).let { r -> Net { t -> t + 2 * ms + r.nextLong(4 * ms) } }

    /** Phone in Wi-Fi power saving: downlink waits for the next beacon ([periodMs]). */
    private fun powerSave(seed: Int, periodMs: Double) = Random(seed).let { r ->
        Net { t ->
            val p = (periodMs * ms).toLong()
            ceil((t + 2 * ms).toDouble() / p).toLong() * p + r.nextLong(3 * ms)
        }
    }

    class Phone(
        val name: String,
        val down: Net,
        val up: Net,
        val clockOffset: Long,
        val clockPpm: Double,
        val speakerPpm: Double,
        val leadNs: Long,
    ) {
        val sync = ClockSync()
        val playout = Playout()
        val out = ShortArray(playout.blockSamples * 2)
        val played = ArrayList<Pair<Long, Double>>() // true time of block, source position
        var lastArrival = 0L
        var lastSample = 0
        var maxJump = 0
        var gapsAtWarmup = -1L
        var jumpsAtWarmup = -1L
        fun local(t: Long) = clockOffset + (t * (1 + clockPpm * 1e-6)).toLong()
    }

    class Result(val maxSkewMs: Double, val p95SkewMs: Double, val finalDelayMs: Int, val phones: List<Phone>)

    private fun run(phones: List<Phone>, seconds: Int, warmupS: Int, seed: Int = 1): Result {
        val rnd = Random(seed)
        val end = seconds * 1000 * ms
        val events = PriorityQueue<Pair<Long, () -> Unit>>(compareBy { it.first })
        var now = 0L
        fun at(t: Long, f: () -> Unit) = events.add(t to f)

        val senderClock = { t: Long -> 7_000_000_000L + (t * (1 + 30e-6)).toLong() }
        val delay = DelayController(clock = { senderClock(now) })
        val capture = CaptureClock()
        val audioPpm = -40.0

        // Sender: frame k is complete at true time (k + 1) * 10 ms (its audio clock), read a bit later.
        var k = 0L
        fun nextFrame() {
            val complete = ((k + 1) * 10 * ms / (1 + audioPpm * 1e-6)).toLong()
            val readDone = complete + rnd.nextLong(2 * ms)
            val seq = k
            at(readDone) {
                val captureNs = capture.next(senderClock(now))
                val pcm = ByteArray(1920)
                for (i in 0 until 480) {
                    val v = (sin(2 * PI * 440 * (seq * 480 + i) / 48_000) * 0.5 * Short.MAX_VALUE).toInt().toShort()
                    Pcm.setSample(pcm, 2 * i, v)
                    Pcm.setSample(pcm, 2 * i + 1, v)
                }
                val frame = AudioFrame(seq, captureNs, delay.currentMs(), pcm)
                for (p in phones) {
                    val arrival = maxOf(p.lastArrival, p.down.deliver(now))
                    p.lastArrival = arrival
                    at(arrival) { p.playout.push(frame, p.local(now), p.sync.offsetAt(p.local(now))) }
                }
            }
            k++
            if (complete < end) at(complete) { nextFrame() }
        }
        nextFrame()

        for ((i, p) in phones.withIndex()) {
            // Clock sync every 100 ms (as TimeSyncClient).
            fun ping(t: Long) {
                at(t) {
                    val t1 = p.local(now)
                    val atSender = p.up.deliver(now)
                    at(atSender) {
                        val t2 = senderClock(now)
                        delay.request(p.name, p.playout.requestedDelayMs)
                        at(p.down.deliver(now)) { p.sync.add(t1, t2, p.local(now)) }
                    }
                    if (now + 100 * ms < end) ping(now + 100 * ms)
                }
            }
            ping(i * 37 * ms)
            // Speaker: block b is heard at true time start + b * 10 ms (speaker clock); rendered lead earlier.
            val start = 500 * ms + i * 3 * ms
            fun block(b: Long) {
                val heard = start + (b * 10 * ms / (1 + p.speakerPpm * 1e-6)).toLong()
                at(heard - p.leadNs) {
                    val presentLocal = p.local(heard) + rnd.nextLong(-200_000, 200_000)
                    val audio = p.playout.render(presentLocal, p.local(now), p.sync.offsetAt(p.local(now)), p.out)
                    if (audio) p.played += heard to p.playout.lastSourcePos
                    for (j in 0 until 480) {
                        val s = p.out[2 * j].toInt()
                        p.maxJump = maxOf(p.maxJump, abs(s - p.lastSample))
                        p.lastSample = s
                    }
                    if (now >= warmupS * 1000 * ms && p.gapsAtWarmup < 0) {
                        p.gapsAtWarmup = p.playout.gaps
                        p.jumpsAtWarmup = p.playout.jumps
                    }
                    if (heard < end) block(b + 1)
                }
            }
            block(0)
        }

        while (events.isNotEmpty()) {
            val (t, f) = events.poll()
            if (t > end) break
            now = t
            f()
        }

        // Skew: for the same source sample, how far apart in true time do the phones play it?
        val skews = ArrayList<Double>()
        val warm = warmupS * 1000 * ms
        val ref = phones[0].played.filter { it.first >= warm }
        for (other in phones.drop(1)) {
            val o = other.played.filter { it.first >= warm }
            var j = 0
            for ((t, pos) in ref) {
                while (j + 1 < o.size && o[j + 1].second <= pos) j++
                if (j + 1 >= o.size) break
                val (ta, pa) = o[j]
                val (tb, pb) = o[j + 1]
                if (pos < pa || pb - pa > 960 || pb <= pa) continue
                val tOther = ta + (tb - ta) * (pos - pa) / (pb - pa)
                skews += abs(tOther - t) / ms.toDouble()
            }
        }
        skews.sort()
        return Result(
            skews.maxOrNull() ?: 99.0,
            skews.getOrElse((skews.size * 0.95).toInt()) { 99.0 },
            delay.currentMs(),
            phones,
        )
    }

    private fun report(name: String, r: Result) {
        println("$name: skew max ${"%.2f".format(r.maxSkewMs)} ms, p95 ${"%.2f".format(r.p95SkewMs)} ms, delay ${r.finalDelayMs} ms")
        for (p in r.phones) {
            println("  ${p.name}: gaps ${p.playout.gaps} (after warm-up ${p.playout.gaps - p.gapsAtWarmup}), " +
                "jumps ${p.playout.jumps} (after ${p.playout.jumps - p.jumpsAtWarmup}), late ${p.playout.lateFrames}, " +
                "asks ${p.playout.requestedDelayMs} ms, max jump ${p.maxJump}, blocks ${p.played.size}")
        }
    }

    private fun assertClean(r: Result) {
        for (p in r.phones) {
            assertTrue("${p.name}: gaps after warm-up", p.playout.gaps - p.gapsAtWarmup == 0L)
            assertTrue("${p.name}: jumps after warm-up", p.playout.jumps - p.jumpsAtWarmup == 0L)
            // A 440 Hz tone at half scale moves at most ~950 per sample; a click is far bigger.
            assertTrue("${p.name}: click ${p.maxJump}", p.maxJump < 1500)
        }
    }

    @Test fun threeCalmPhones_playInStepWithLowDelay() {
        val phones = listOf(
            Phone("a", calm(1), calm(2), 123_000_000_000L, 0.0, 0.0, 30 * ms),
            Phone("b", calm(3), calm(4), -55_000_000_000L, 150.0, -120.0, 40 * ms),
            Phone("c", calm(5), calm(6), 9_000_000L, -100.0, 90.0, 25 * ms),
        )
        val r = run(phones, 120, 15)
        report("calm", r)
        assertClean(r)
        assertTrue("phones out of step: ${r.p95SkewMs} ms", r.p95SkewMs < 1.0 && r.maxSkewMs < 2.0)
        assertTrue("delay ${r.finalDelayMs} ms", r.finalDelayMs <= 90)
    }

    @Test fun onePhoneInPowerSave_allStillInStep() {
        val phones = listOf(
            Phone("calm", calm(1), calm(2), 1_000_000_000L, 50.0, 0.0, 30 * ms),
            Phone("sleepy", powerSave(3, 102.4), calm(4), -3_000_000_000L, -80.0, 60.0, 30 * ms),
            Phone("calm2", calm(5), calm(6), 0L, 0.0, -50.0, 35 * ms),
        )
        val r = run(phones, 120, 20)
        report("power save", r)
        assertClean(r)
        // The sleepy phone itself holds incoming packets until it wakes, so its clock estimate is
        // a little off; 3 ms is the time sound needs for one metre - not heard as an echo.
        assertTrue("phones out of step: ${r.p95SkewMs} ms", r.p95SkewMs < 3.5 && r.maxSkewMs < 6.0)
        assertTrue("delay ${r.finalDelayMs} ms", r.finalDelayMs in 120..220)
    }
}
