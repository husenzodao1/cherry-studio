package app.coefmonitor.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RowHistoryTest {
    private fun xs(vararg values: String?) = values.map { it?.let { v -> Coefficient.parseUserInput(v)!! } }
    private fun known(vararg values: String) = xs(*values).map { it!! }

    @Test
    fun `finds how many tiles are new`() {
        val before = known("3.82", "4.87", "1.13")
        assertEquals(0, RowHistory.newTiles(before, xs("3.82", "4.87", "1.13", "1.00", "2.50")))
        assertEquals(1, RowHistory.newTiles(before, xs("1.20", "3.82", "4.87", "1.13", "1.00")))
        assertEquals(3, RowHistory.newTiles(before, xs("2.10", "1.05", "1.20", "3.82", "4.87", "1.13")))
        // Near the end of the row two known rounds are enough.
        assertEquals(4, RowHistory.newTiles(before, xs("2.10", "1.05", "1.20", "7.00", "3.82", "4.87")))
    }

    @Test
    fun `unknown when the known rounds left the row or a new tile is unreadable`() {
        val before = known("3.82", "4.87", "1.13")
        // More rounds ended than the row shows.
        assertNull(RowHistory.newTiles(before, xs("2.10", "1.05", "1.20", "7.00", "1.90", "3.82")))
        // A new tile could not be read: its value would be a guess.
        assertNull(RowHistory.newTiles(before, xs("2.10", null, "3.82", "4.87", "1.13", "1.00")))
        // Nothing known.
        assertNull(RowHistory.newTiles(emptyList(), xs("2.10", "1.05")))
    }

    @Test
    fun `a single equal value never decides when more is known`() {
        // 4.87 1.13 only half matches: the third tile must also be 3.82 ... 1.13 in order.
        assertNull(RowHistory.newTiles(known("3.82", "4.87"), xs("1.50", "2.20", "1.30", "1.90", "3.82", "9.99")))
        // With a single known round one match is all there is.
        assertEquals(2, RowHistory.newTiles(known("3.82"), xs("1.50", "2.20", "3.82", "4.87")))
    }
}
