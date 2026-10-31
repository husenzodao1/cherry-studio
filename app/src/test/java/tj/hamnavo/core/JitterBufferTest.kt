package tj.hamnavo.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class JitterBufferTest {
    private fun frame(i: Int) = ByteArray(1920).also { Pcm.setSample(it, 100, (i * 10).toShort()) }
    private fun id(f: ByteArray) = Pcm.getSample(f, 100) / 10

    @Test fun startsAtTargetAndPlaysInOrder() {
        val jb = JitterBuffer()
        assertEquals(200, jb.targetMs)
        repeat(19) { jb.push(frame(it)) }
        assertNull(jb.poll())
        jb.push(frame(19))
        for (i in 0 until 20) assertEquals(i, id(jb.poll()!!))
    }

    @Test fun underrunRaisesTargetAndFadesOut() {
        val jb = JitterBuffer(initialTargetMs = 60, minTargetMs = 60)
        repeat(6) { jb.push(frame(it)) }
        repeat(6) { jb.poll() }
        val conceal = jb.poll()!! // time-reversed last frame, fading to zero
        assertEquals(1L, jb.underruns)
        assertEquals(0, Pcm.getSample(conceal, conceal.size / 2 - 1).toInt())
        assertNull(jb.poll())
        // 30 polls (300 ms) without audio, then it comes back: the target covers that hole.
        repeat(29) { assertNull(jb.poll()) }
        jb.push(frame(99))
        jb.poll()
        assertTrue("target ${jb.targetMs}", jb.targetMs in 360..430)
    }

    @Test fun neverHoldsMoreThanTargetPlusHeadroom() {
        val jb = JitterBuffer(initialTargetMs = 100, headroomMs = 200)
        repeat(1000) { jb.push(frame(it)) }
        assertEquals(30, jb.size)
        assertEquals(970L, jb.dropped)
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

    @Test fun fadesAndCrossfadeAreSmooth() {
        val a = ByteArray(1920).also { Pcm.mixInto(it, ShortArray(960) { 20_000 }, 0) }
        val b = ByteArray(1920).also { Pcm.mixInto(it, ShortArray(960) { -20_000 }, 0) }
        val x = Pcm.crossfade(a, b, 2, 120)
        assertEquals(20_000, Pcm.getSample(x, 0).toInt())
        assertEquals(-20_000, Pcm.getSample(x, 959).toInt())
        for (i in 2 until 960) assertTrue(Math.abs(Pcm.getSample(x, i) - Pcm.getSample(x, i - 2)) <= 400)
        val r = Pcm.reversed(ByteArray(8).also { for (i in 0 until 4) Pcm.setSample(it, i, i.toShort()) }, 2)
        assertEquals(listOf(2, 3, 0, 1), (0 until 4).map { Pcm.getSample(r, it).toInt() })
    }
}
