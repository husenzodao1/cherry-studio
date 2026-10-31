package tj.hamnavo.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class JitterBufferTest {
    private fun frame(i: Int) = byteArrayOf(i.toByte())

    @Test fun startsAfter40msAndStaysBelow120ms() {
        val jb = JitterBuffer.forMillis()
        assertEquals(4, jb.startFrames)
        assertEquals(12, jb.maxFrames)
        repeat(3) { jb.push(frame(it)) }
        assertNull(jb.poll())
        jb.push(frame(3))
        assertEquals(0.toByte(), jb.poll()!![0])

        for (i in 4 until 100) {
            jb.push(frame(i))
            assertTrue(jb.size <= 12)
        }
        // Oldest frames were dropped: the next frame is one of the newest 12.
        assertEquals((100 - 12).toByte(), jb.poll()!![0])
        assertEquals(100L - 1 - 12, jb.dropped)
    }

    @Test fun underrunRebuffers() {
        val jb = JitterBuffer(2, 6)
        jb.push(frame(1)); jb.push(frame(2))
        jb.poll(); jb.poll()
        assertNull(jb.poll())
        assertEquals(1L, jb.underruns)
        jb.push(frame(3))
        assertNull(jb.poll())
        jb.push(frame(4))
        assertEquals(3.toByte(), jb.poll()!![0])
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
