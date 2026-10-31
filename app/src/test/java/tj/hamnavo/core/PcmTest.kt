package tj.hamnavo.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PcmTest {
    @Test fun mixSaturates() {
        assertEquals(Short.MAX_VALUE, Pcm.mix(30_000, 30_000))
        assertEquals(Short.MIN_VALUE, Pcm.mix(-30_000, -30_000))
        assertEquals(100.toShort(), Pcm.mix(300, -200))
    }

    @Test fun mixIntoBytesSaturates() {
        val frame = ByteArray(8)
        Pcm.setSample(frame, 0, 32_000)
        Pcm.setSample(frame, 1, -32_000)
        Pcm.setSample(frame, 2, 1000)
        val n = Pcm.mixInto(frame, shortArrayOf(5_000, -5_000, -3000, 7), 0)
        assertEquals(4, n)
        assertEquals(Short.MAX_VALUE, Pcm.getSample(frame, 0))
        assertEquals(Short.MIN_VALUE, Pcm.getSample(frame, 1))
        assertEquals((-2000).toShort(), Pcm.getSample(frame, 2))
        assertEquals(7.toShort(), Pcm.getSample(frame, 3))
    }

    @Test fun toneAndPeak() {
        val tone = Pcm.tone(48_000, 2, 1000.0, 100, amplitude = 0.5)
        assertEquals(48_00 * 2, tone.size)
        val bytes = ByteArray(tone.size * 2)
        Pcm.mixInto(bytes, tone, 0)
        val peak = Pcm.peak(bytes)
        assertTrue("peak=$peak", peak in 16_000..16_400)
        assertEquals(0, Pcm.peak(ByteArray(100)))
    }

    @Test fun toneMixerPlaysOnceAcrossFrames() {
        val beeps = Pcm.beeps(48_000, 2)
        val mixer = ToneMixer(beeps)
        val frame = ByteArray(1920)
        mixer.mixInto(frame)
        assertEquals(0, Pcm.peak(frame))
        mixer.trigger()
        var frames = 0
        while (mixer.isActive) { mixer.mixInto(ByteArray(1920)); frames++ }
        assertEquals(beeps.size / 960 + if (beeps.size % 960 == 0) 0 else 1, frames)
        assertFalse(mixer.isActive)
    }

    @Test fun toneMixerToggleStopsBeep() {
        val mixer = ToneMixer(Pcm.beeps(48_000, 2))
        assertTrue(mixer.toggle())
        mixer.mixInto(ByteArray(1920))
        assertTrue(mixer.isActive)
        assertFalse(mixer.toggle())
        val frame = ByteArray(1920)
        mixer.mixInto(frame)
        assertEquals(0, Pcm.peak(frame))
    }

    @Test fun levelRuns() {
        // 10 ms frames: loud 0..290 ms, one dropped frame at 100 ms, quiet, loud 500..640 ms.
        val times = LongArray(100) { it * 10L }
        val levels = FloatArray(100) { i ->
            when {
                i == 10 -> 0f
                i < 30 -> 0.5f
                i in 50..63 -> 0.3f
                else -> 0f
            }
        }
        val runs = LevelRuns.runs(times, levels, 0.1f)
        assertEquals(listOf(LevelRuns.Run(0, 300), LevelRuns.Run(500, 640)), runs)
        assertEquals(140L, runs[1].durationMs)
    }
}
