package app.coefmonitor.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RowLocatorTest {
    private val width = 1080
    private val height = 2400

    /** A word centred at ([cx], [cy]), 30 px tall, about 18 px per character. */
    private fun word(text: String, cx: Int, cy: Int, confidence: Float = 0.9f): TextBox {
        val halfWidth = text.length * 9
        return TextBox(text, cx - halfWidth, cy - 15, cx + halfWidth, cy + 15, confidence)
    }

    /** The game's row: "?" at x = 120, then tiles every 180 px. */
    private fun row(vararg values: String, y: Int = 100, withMark: Boolean = true): List<TextBox> =
        (if (withMark) listOf(word("?", 120, y)) else emptyList()) +
            values.mapIndexed { i, v -> word(v, 300 + i * 180, y) }

    @Test
    fun `newest tile is the first coefficient right of the question mark`() {
        val boxes = row("2.03x", "1.00x", "1.51x", "1.16x")
        val cells = RowLocator.locate(boxes, width, height)!!
        assertEquals(203L, (cells.readNewest(boxes) as OcrReading.Valid).value.hundredths)
        assertEquals(100L, (cells.readNeighbor(boxes) as OcrReading.Valid).value.hundredths)
        assertEquals(180, cells.pitch)
    }

    @Test
    fun `a row without a recognised question mark needs three evenly spaced tiles`() {
        val boxes = row("2.03x", "1.00x", "1.51x", withMark = false)
        val cells = RowLocator.locate(boxes, width, height)!!
        assertEquals(203L, (cells.readNewest(boxes) as OcrReading.Valid).value.hundredths)
        assertNull(RowLocator.locate(row("2.03x", "1.00x", withMark = false), width, height))
    }

    @Test
    fun `unevenly spaced coefficients are not a row`() {
        val boxes = listOf(word("2.03x", 300, 100), word("1.00x", 480, 100), word("1.51x", 900, 100))
        assertNull(RowLocator.locate(boxes, width, height))
    }

    @Test
    fun `single coefficients elsewhere on the screen are ignored`() {
        val boxes = row("2.03x", "1.00x", "1.51x", y = 1200) +
            listOf(word("4.61x", 540, 700), word("Last:", 150, 400), word("17.35x", 300, 400), word("2.00", 900, 2000))
        val cells = RowLocator.locate(boxes, width, height)!!
        assertEquals(203L, (cells.readNewest(boxes) as OcrReading.Valid).value.hundredths)
        assertTrue(cells.newest.top in 1150..1200)
    }

    @Test
    fun `nothing to find without coefficients`() {
        assertNull(RowLocator.locate(listOf(word("?", 120, 100), word("Waiting", 540, 600)), width, height))
    }

    @Test
    fun `a value split into number and sign is still read`() {
        val boxes = row("2.03x", "1.00x", "1.51x")
        val cells = RowLocator.locate(boxes, width, height)!!
        val split = listOf(word("2.03", 290, 100), word("x", 335, 100))
        assertEquals(203L, (cells.readNewest(split) as OcrReading.Valid).value.hundredths)
    }

    @Test
    fun `an empty newest cell is rejected, not read from the neighbour`() {
        val boxes = row("2.03x", "1.00x", "1.51x")
        val cells = RowLocator.locate(boxes, width, height)!!
        val shifted = listOf(word("?", 120, 100), word("2.03x", 480, 100))
        assertEquals(RejectionReason.EMPTY, (cells.readNewest(shifted) as OcrReading.Rejected).reason)
    }

    @Test
    fun `the closest row wins when it was seen before`() {
        val upper = row("2.03x", "1.00x", "1.51x", y = 100)
        val lower = row("3.10x", "1.20x", "1.80x", y = 1500)
        val before = RowLocator.locate(lower, width, height)!!
        val cells = RowLocator.locate(upper + lower, width, height, near = before)!!
        assertEquals(310L, (cells.readNewest(upper + lower) as OcrReading.Valid).value.hundredths)
    }

    @Test
    fun `small jitter is not a move, a scrolled row is`() {
        val cells = RowLocator.locate(row("2.03x", "1.00x", "1.51x"), width, height)!!
        val jitter = RowLocator.locate(row("2.03x", "1.00x", "1.51x", y = 103), width, height)!!
        val scrolled = RowLocator.locate(row("2.03x", "1.00x", "1.51x", y = 160), width, height)!!
        assertFalse(jitter.movedFrom(cells))
        assertTrue(scrolled.movedFrom(cells))
    }

    @Test
    fun `the newest slot right of the question mark counts even when it was not read`() {
        val boxes = listOf(word("?", 120, 100), word("1.00x", 480, 100), word("1.51x", 660, 100), word("1.16x", 840, 100))
        val cells = RowLocator.locate(boxes, width, height)!!
        assertEquals(RejectionReason.EMPTY, (cells.readNewest(boxes) as OcrReading.Rejected).reason)
        assertEquals(100L, (cells.readNeighbor(boxes) as OcrReading.Valid).value.hundredths)
    }

    @Test
    fun `another value on the same line does not break a row without a mark`() {
        val boxes = row("2.03x", "1.00x", "1.51x", withMark = false) + word("17.35x", 1000, 100)
        val cells = RowLocator.locate(boxes, width, height)!!
        assertEquals(203L, (cells.readNewest(boxes) as OcrReading.Valid).value.hundredths)
    }

    @Test
    fun `values whose sign was not read still show where the row is`() {
        val boxes = row("2.03", "1.00", "1.51")
        val cells = RowLocator.locate(boxes, width, height)!!
        assertEquals(RejectionReason.MISSING_MULTIPLIER_SIGN, (cells.readNewest(boxes) as OcrReading.Rejected).reason)
        assertEquals(203L, (cells.readNewest(row("2.03x", "1.00x", "1.51x")) as OcrReading.Valid).value.hundredths)
    }

    @Test
    fun `a followed row stays put when its newest tile is not read or the row is partly covered`() {
        val cells = RowLocator.locate(row("2.03x", "1.00x", "1.51x", "1.16x", withMark = false), width, height)!!
        val newestMissed = row("2.03x", "1.00x", "1.51x", "1.16x", withMark = false).drop(1)
        assertEquals(cells, RowLocator.locate(newestMissed, width, height, near = cells))
        val covered = listOf(word("1.51x", 660, 101), word("1.16x", 840, 99))
        assertEquals(cells, RowLocator.locate(covered, width, height, near = cells))
        // A single value at that height can be anything (e.g. a panel line): not enough to keep the row.
        assertNull(RowLocator.locate(listOf(word("1.51x", 660, 101)), width, height, near = cells))
        assertNull(RowLocator.locate(listOf(word("1.51x", 390, 101), word("1.16x", 570, 99)), width, height, near = cells))
    }

    @Test
    fun `a followed row that was anchored too far right moves to the real newest tile`() {
        val wrong = RowLocator.locate(row("1.00x", "1.51x", "1.16x", withMark = false).map { it.copy(left = it.left + 180, right = it.right + 180) }, width, height)!!
        val cells = RowLocator.locate(row("2.03x", "1.00x", "1.51x", "1.16x", withMark = false), width, height, near = wrong)!!
        assertTrue(cells.movedFrom(wrong))
        assertEquals(203L, (cells.readNewest(row("2.03x", "1.00x", "1.51x", "1.16x", withMark = false)) as OcrReading.Valid).value.hundredths)
    }

    @Test
    fun `the tracking strip covers the row with room to move and stays inside the frame`() {
        val cells = RowLocator.locate(row("2.03x", "1.00x", "1.51x", y = 40), width, height)!!
        val strip = cells.strip(width, height)
        assertEquals(0, strip.left)
        assertEquals(width, strip.width)
        assertEquals(0, strip.top)
        assertTrue(strip.bottom >= cells.newest.bottom + cells.newest.height)
        assertNotNull(cells.neighbor)
    }
}
