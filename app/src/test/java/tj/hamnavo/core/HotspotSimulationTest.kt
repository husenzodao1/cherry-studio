package tj.hamnavo.core

import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.sin
import kotlin.random.Random

/**
 * Plays 10 minutes of a 440 Hz tone through the jitter buffer under simulated network timing:
 * Wi-Fi power saving on a phone hotspot (packets released every 307 ms), a 400 ms stall every
 * 20 s, and sender/receiver clocks that differ by 200 ppm either way.
 */
class HotspotSimulationTest {
    private val rate = 48_000
    private val ch = 2
    private val samplesPerFrame = 480

    class Result(val glitches: Long, val glitchesAfterWarmup: Long, val trimmed: Long, val maxJump: Int, val avgBufferMs: Double)

    private fun frame(k: Int): ByteArray {
        val out = ByteArray(samplesPerFrame * ch * 2)
        for (i in 0 until samplesPerFrame) {
            val v = (sin(2 * PI * 440 * (k.toLong() * samplesPerFrame + i) / rate) * 0.5 * Short.MAX_VALUE).toInt().toShort()
            for (c in 0 until ch) Pcm.setSample(out, i * ch + c, v)
        }
        return out
    }

    private fun simulate(jb: JitterBuffer, seconds: Int, driftPpm: Double, arrival: (Int) -> Double): Result {
        val frames = seconds * 100
        val arrivals = DoubleArray(frames)
        for (k in 0 until frames) arrivals[k] = maxOf(if (k > 0) arrivals[k - 1] else 0.0, arrival(k))
        var next = 0
        var lastSample = 0
        var maxJump = 0
        var glitchesAtWarmup = -1L
        var bufferSum = 0.0
        var bufferCount = 0
        var j = 0
        while (true) {
            val t = j * 10.0 * (1 + driftPpm * 1e-6)
            if (t > seconds * 1000.0) break
            while (next < frames && arrivals[next] <= t) jb.push(frame(next++))
            val out = jb.poll()
            for (i in 0 until samplesPerFrame) {
                val s = if (out == null) 0 else Pcm.getSample(out, i * ch).toInt()
                maxJump = maxOf(maxJump, abs(s - lastSample))
                lastSample = s
            }
            if (t >= 60_000) {
                if (glitchesAtWarmup < 0) glitchesAtWarmup = jb.underruns + jb.dropped
                bufferSum += jb.bufferedMs
                bufferCount++
            }
            j++
        }
        val total = jb.underruns + jb.dropped
        return Result(total, total - glitchesAtWarmup, jb.trimmed, maxJump, bufferSum / bufferCount)
    }

    /** Phone hotspot with power saving: frames wait for the next delivery window. */
    private fun hotspot(seed: Int, periodMs: Double = 307.2, stalls: Boolean = true): (Int) -> Double {
        val rnd = Random(seed)
        return { k ->
            val sent = k * 10.0
            val stallEnd = (sent / 20_000).toInt() * 20_000 + 400.0
            val ready = if (stalls && sent % 20_000 < 400) stallEnd else sent + 3
            ceil(ready / periodMs) * periodMs + rnd.nextDouble(0.0, 25.0)
        }
    }

    @Test fun typicalHotspot_noGapsAndShortDelay() {
        val r = simulate(JitterBuffer(), 300, 50.0, hotspot(5, periodMs = 102.4, stalls = false))
        println("typical hotspot: glitches ${r.glitches}, trimmed ${r.trimmed}, avg buffer ${r.avgBufferMs.toInt()} ms")
        assertTrue("gaps: ${r.glitches}", r.glitches == 0L)
        assertTrue("delay: ${r.avgBufferMs}", r.avgBufferMs < 250)
        assertTrue(r.maxJump < 1500)
    }

    @Test fun hotspotBurstsAndDrift_noAudibleGlitchesAfterWarmup() {
        for ((seed, drift) in listOf(1 to 200.0, 2 to -200.0, 3 to 0.0)) {
            val r = simulate(JitterBuffer(), 600, drift, hotspot(seed))
            println("drift $drift ppm: glitches ${r.glitches} (after warm-up ${r.glitchesAfterWarmup}), " +
                "trimmed ${r.trimmed}, max jump ${r.maxJump}, avg buffer ${r.avgBufferMs.toInt()} ms")
            // The first stalls teach the buffer how deep the holes are; after the first minute
            // at most one fade-out per ~5 minutes is allowed under these harsh conditions.
            assertTrue("too many gaps/drops after the first minute: ${r.glitchesAfterWarmup}", r.glitchesAfterWarmup <= 2)
            assertTrue("gaps while settling: ${r.glitches}", r.glitches <= 5)
            // A 440 Hz tone at half scale moves at most ~950 per sample; a click is a much bigger jump.
            assertTrue("click in the output: jump ${r.maxJump}", r.maxJump < 1500)
            assertTrue("delay too large: ${r.avgBufferMs}", r.avgBufferMs < 1000)
        }
    }

    @Test fun calmNetwork_settlesToLowDelay() {
        val rnd = Random(7)
        val r = simulate(JitterBuffer(), 300, 100.0) { k -> k * 10.0 + 2 + rnd.nextDouble(0.0, 4.0) }
        println("calm: glitches ${r.glitches}, trimmed ${r.trimmed}, avg buffer ${r.avgBufferMs.toInt()} ms")
        assertTrue(r.glitches == 0L)
        assertTrue("delay did not come down: ${r.avgBufferMs}", r.avgBufferMs < 150)
        assertTrue(r.maxJump < 1500)
    }

    /** The first version's fixed 40..120 ms buffer: this is the crackling heard on phone B. */
    @Test fun oldFixedBuffer_glitchesConstantly() {
        val old = JitterBuffer(minTargetMs = 40, maxTargetMs = 40, initialTargetMs = 40, headroomMs = 80)
        val r = simulate(old, 120, 0.0, hotspot(4))
        println("old fixed buffer: ${r.glitches} glitches in 2 minutes")
        assertTrue(r.glitches > 300)
    }
}
