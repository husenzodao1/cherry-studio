package tj.hamnavo.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.IOException

class ProtocolTest {
    @Test fun headerRoundTrip() {
        val h = StreamHeader(Protocol.VERSION, 2, 48_000)
        val bytes = Protocol.encodeHeader(h)
        assertEquals(12, bytes.size)
        assertEquals("HMNV", String(bytes, 0, 4))
        assertEquals(h, Protocol.decodeHeader(bytes))
        assertEquals(1920, h.frameBytes)
    }

    @Test fun badMagicRejected() {
        val bytes = Protocol.encodeHeader(Protocol.DEFAULT_HEADER)
        bytes[0] = 'X'.code.toByte()
        assertThrows(IOException::class.java) { Protocol.decodeHeader(bytes) }
    }
}
