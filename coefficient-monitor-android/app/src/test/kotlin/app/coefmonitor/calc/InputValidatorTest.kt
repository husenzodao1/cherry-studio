package app.coefmonitor.calc

import app.coefmonitor.calc.validation.FieldError
import app.coefmonitor.calc.validation.InputValidator
import app.coefmonitor.calc.validation.ValidationOutcome
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

class InputValidatorTest {

    /** Null when the target is accepted. */
    private fun targetError(text: String): FieldError? = when (val outcome = InputValidator.validate(text, "5000", "1")) {
        is ValidationOutcome.Invalid -> outcome.errors.target
        is ValidationOutcome.Valid -> null
    }

    @Test
    fun `valid inputs produce a calculation input`() {
        val outcome = InputValidator.validate("3.50", "5000", "1.00")
        assertTrue(outcome is ValidationOutcome.Valid)
        val input = (outcome as ValidationOutcome.Valid).input
        assertEquals(0, BigDecimal("3.50").compareTo(input.targetMultiplier))
        assertEquals(0, BigDecimal("5000").compareTo(input.startingBalance))
    }

    @Test
    fun `comma decimal separator is accepted`() {
        val outcome = InputValidator.validate("1,5", "100", "1") as ValidationOutcome.Valid
        assertEquals(0, BigDecimal("1.5").compareTo(outcome.input.targetMultiplier))
    }

    @Test
    fun `a thousands-style comma is refused instead of silently reading 5,000 as 5`() {
        val errors = (InputValidator.validate("3", "5,000", "1") as ValidationOutcome.Invalid).errors
        assertEquals(FieldError.AMBIGUOUS_SEPARATOR, errors.balance)
    }

    @Test
    fun `target must be strictly greater than one`() {
        assertEquals(FieldError.TARGET_NOT_ABOVE_ONE, targetError("1"))
        assertEquals(FieldError.TARGET_NOT_ABOVE_ONE, targetError("1.00"))
        assertEquals(FieldError.TARGET_NOT_ABOVE_ONE, targetError("0.5"))
        assertEquals(null, targetError("1.01"))
    }

    @Test
    fun `target above the limit is refused`() {
        assertEquals(FieldError.TARGET_TOO_LARGE, targetError("1001"))
    }

    @Test
    fun `empty, malformed and negative values are refused with specific errors`() {
        val errors = (InputValidator.validate("", "-5", "1e3") as ValidationOutcome.Invalid).errors
        assertEquals(FieldError.EMPTY, errors.target)
        assertEquals(FieldError.NOT_A_NUMBER, errors.balance)
        assertEquals(FieldError.NOT_A_NUMBER, InputValidator.validate("3", "1", "1e3").let { (it as ValidationOutcome.Invalid).errors.bet })
    }

    @Test
    fun `zero and negative balances and bets are refused`() {
        val errors = (InputValidator.validate("3", "0", "0") as ValidationOutcome.Invalid).errors
        assertEquals(FieldError.NOT_POSITIVE, errors.balance)
        assertEquals(FieldError.NOT_POSITIVE, errors.bet)
    }

    @Test
    fun `more than two decimal places is refused`() {
        val errors = (InputValidator.validate("3.505", "5000", "1") as ValidationOutcome.Invalid).errors
        assertEquals(FieldError.TOO_MANY_DECIMALS, errors.target)
    }

    @Test
    fun `absurdly large balances are refused`() {
        val errors = (InputValidator.validate("3", "2000000000", "1") as ValidationOutcome.Invalid).errors
        assertEquals(FieldError.TOO_LARGE, errors.balance)
    }

    /**
     * TEST 9: invalid input must never crash. Every combination of awkward characters
     * over a fixed alphabet is run through all three fields; the outcome must always be a
     * well-formed value. The enumeration is deterministic.
     */
    @Test
    fun `invalid input never throws`() {
        val alphabet = listOf("", "0", "1", ".", ",", "-", "+", " ", "e", "9", "99999999999999999", "∞", "\u0000")
        val samples = ArrayList<String>()
        for (a in alphabet) for (b in alphabet) for (c in alphabet) samples += a + b + c
        val tricky = listOf("..", ",,", ".,", "1..2", "NaN", "Infinity", "0x1F", "1_000", "١٢٣")
        for (text in samples + tricky) {
            for (other in listOf("5000", "x", "")) {
                val outcome = InputValidator.validate(text, other, text)
                assertTrue("outcome for '$text'", outcome is ValidationOutcome.Valid || outcome is ValidationOutcome.Invalid)
            }
        }
    }
}
