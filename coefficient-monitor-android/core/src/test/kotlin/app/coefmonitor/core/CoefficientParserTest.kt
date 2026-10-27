package app.coefmonitor.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CoefficientParserTest {

    private fun valueOf(text: String): Long? = (CoefficientParser.parse(text) as? OcrReading.Valid)?.value?.hundredths

    private fun reasonOf(text: String): RejectionReason? = (CoefficientParser.parse(text) as? OcrReading.Rejected)?.reason

    @Test
    fun `reads the values from the reference screenshot`() {
        assertEquals(201L, valueOf("2.01x"))
        assertEquals(153L, valueOf("1.53x"))
        assertEquals(120L, valueOf("1.20x"))
        assertEquals(203L, valueOf("2.03x"))
    }

    @Test
    fun `normalises multiplier signs, separators and spacing`() {
        assertEquals(201L, valueOf("2.01X"))
        assertEquals(201L, valueOf("2.01×"))
        assertEquals(201L, valueOf("2.01х")) // Cyrillic kha
        assertEquals(201L, valueOf("2,01x"))
        assertEquals(201L, valueOf(" 2.01 x \n"))
        assertEquals(1_234_56L, valueOf("1,234.56x"))
        assertEquals(1_234_56L, valueOf("1.234,56x"))
        assertEquals(12_345_67L, valueOf("12 345.67x"))
    }

    @Test
    fun `distinguishes the question mark placeholder`() {
        assertTrue(CoefficientParser.parse("?") is OcrReading.Placeholder)
        assertTrue(CoefficientParser.parse(" ? ") is OcrReading.Placeholder)
    }

    @Test
    fun `rejects empty, partial and malformed readings`() {
        assertEquals(RejectionReason.EMPTY, reasonOf(""))
        assertEquals(RejectionReason.EMPTY, reasonOf("  \n"))
        assertEquals(RejectionReason.PARTIAL_VALUE, reasonOf("2.0"))
        assertEquals(RejectionReason.PARTIAL_VALUE, reasonOf("2.0x"))
        assertEquals(RejectionReason.PARTIAL_VALUE, reasonOf("2x"))
        assertEquals(RejectionReason.MISSING_MULTIPLIER_SIGN, reasonOf("2.01"))
        assertEquals(RejectionReason.MALFORMED, reasonOf("2.O1x"))
        assertEquals(RejectionReason.MALFORMED, reasonOf("abc"))
        assertEquals(RejectionReason.MALFORMED, reasonOf("2.011x"))
        assertEquals(RejectionReason.MALFORMED, reasonOf("1,234,56x"))
        assertEquals(RejectionReason.MULTIPLE_VALUES, reasonOf("2.01x 1.53x"))
    }

    @Test
    fun `rejects implausible values`() {
        assertEquals(RejectionReason.OUT_OF_RANGE, reasonOf("0.99x"))
        assertEquals(RejectionReason.OUT_OF_RANGE, reasonOf("0.00x"))
        assertNull(valueOf("999999.99x"))
    }

    @Test
    fun `keeps OCR confidence`() {
        val reading = CoefficientParser.parse("1.53x", 0.87f) as OcrReading.Valid
        assertEquals(0.87f, reading.confidence)
    }

    @Test
    fun `user input parsing for the threshold field`() {
        assertEquals(200L, Coefficient.parseUserInput("2")?.hundredths)
        assertEquals(200L, Coefficient.parseUserInput("2.0")?.hundredths)
        assertEquals(250L, Coefficient.parseUserInput("2,5")?.hundredths)
        assertEquals(200L, Coefficient.parseUserInput("2.00x")?.hundredths)
        assertNull(Coefficient.parseUserInput("2.005"))
        assertNull(Coefficient.parseUserInput("abc"))
        assertEquals("2.00x", Coefficient(200).toString())
        assertEquals("10.05x", Coefficient(1005).toString())
    }
}
