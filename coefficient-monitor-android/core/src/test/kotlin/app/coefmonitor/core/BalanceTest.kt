package app.coefmonitor.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BalanceTest {

    private fun money(text: String) = Money.parse(text)!!
    private fun x(text: String) = Coefficient.parseUserInput(text)!!

    @Test
    fun `reads the balance the way OCR returns it`() {
        val tenThousand = money("10000")
        for (text in listOf(
            "10 000.00 $", "10 000.00$", "10000.00 $", "10 000.00 $", "10 000.00 $", "10 000 .00 $",
            "10,000.00 $", "10.000,00 ₽", "$ 10 000.00", "10 000.00 S", "10 000.00 USD",
        )) {
            assertEquals(text, tenThousand, BalanceParser.parse(text))
        }
        assertEquals(money("9998.47"), BalanceParser.parse("9 998.47 $"))
        assertEquals(money("2.50"), BalanceParser.parse("2,50 $"))
        assertEquals(money("1234567.89"), BalanceParser.parse("1 234 567.89 $"))
    }

    @Test
    fun `anything doubtful is unreadable instead of guessed`() {
        // No decimals, one decimal, the "$" read as a digit, a coefficient, two different amounts, nothing.
        for (text in listOf("10 000 $", "10 000.0 $", "10 000.005", "3.82x", "3.82 x", "1.00х", "4.00 / 50.00", "", "DEMO")) {
            assertNull(text, BalanceParser.parse(text))
        }
    }

    /** The user's screenshot (1080 px wide): header with the balance, then the result row. */
    private val header = listOf(
        TextBox("LUCKYJET", 45, 62, 355, 100),
        TextBox("DEMO", 290, 70, 350, 100),
        TextBox("10", 604, 62, 662, 102),
        TextBox("000.00", 672, 62, 778, 102),
        TextBox("$", 782, 62, 800, 102),
    )
    private val row = listOf(
        TextBox("?", 112, 215, 134, 250),
        TextBox("3.82x", 262, 214, 346, 250),
        TextBox("4.87x", 442, 214, 526, 250),
        TextBox("1.13x", 622, 214, 706, 250),
        TextBox("1.00x", 802, 214, 886, 250),
    )

    /** Amounts below the row: the bet panel and other players' bets. */
    private val below = listOf(
        TextBox("1.00", 300, 900, 380, 940), TextBox("$", 385, 900, 400, 940),
        TextBox("12.50", 600, 1300, 700, 1340), TextBox("$", 705, 1300, 720, 1340),
    )

    private fun cells(words: List<TextBox>) = RowLocator.locate(words, 1080, 2400)!!

    @Test
    fun `finds the balance above the row and nothing below it`() {
        val words = header + row + below
        val spot = BalanceLocator.locate(words, cells(words), 1080, 2400)
        assertNotNull(spot)
        assertEquals(money("10000"), spot!!.value)
        // The region holds the amount with room around it, within the screen.
        assertTrue(spot.region.left < 604 && spot.region.right > 800)
        assertTrue(spot.region.top < 62 && spot.region.bottom > 102 && spot.region.bottom < 214)
        // Without the header there is no balance, whatever is below the row.
        assertNull(BalanceLocator.locate(row + below, cells(row + below), 1080, 2400))
    }

    @Test
    fun `a line of the floating panel between the balance and the row is not taken`() {
        val panel = listOf(TextBox("Part", 100, 140, 160, 170), TextBox("1/4", 170, 140, 210, 170), TextBox("4.00", 230, 140, 290, 170),
            TextBox("/", 295, 140, 300, 170), TextBox("50.00", 305, 140, 380, 170), TextBox("stake", 390, 140, 450, 170), TextBox("2.00", 460, 140, 520, 170))
        val words = header + panel + row
        assertEquals(money("10000"), BalanceLocator.locate(words, cells(words), 1080, 2400)!!.value)
    }

    @Test
    fun `the last cent digit is not compared`() {
        assertTrue(BalanceCheck.matches(money("10000.47"), money("10000.40")))
        assertTrue(BalanceCheck.matches(money("9999.95"), money("10000")))
        assertFalse(BalanceCheck.matches(money("10000.50"), money("10000.40")))
        assertFalse(BalanceCheck.matches(money("10020"), money("10002")))
    }

    @Test
    fun `at 2_00x the balance only moves by the martingale stakes 2, 4, 8 and so on`() {
        val config = GuardedConfig(lowsInRow = 3, amount = money("200"), parts = 4, startStake = money("2"), balance = money("10000"))
        var state = GuardedStart.begin(null, startBalance = money("10000"))
        val balances = listOf("1.2", "2.6", "1.1", "1.3", "1.4", "2.5", "1.3", "1.1", "1.5", "3.1", "2.2").map { value ->
            state = GuardedStart.onRound(config, state, x(value), x("2.00")).state
            Money.format(state.balance!!)
        }
        // Waiting (no stakes), then +2, -2, -4, -8, +16 (losses 2+4+8 won back plus 2), +2.
        assertEquals(
            listOf("10000.00", "10000.00", "10000.00", "10000.00", "10000.00", "10002.00", "10000.00", "9996.00", "9988.00", "10004.00", "10006.00"),
            balances,
        )
        // A stake of 20 instead of 2 on the next round shows up as a balance the martingale does not allow.
        val next = GuardedStart.onRound(config, state, x("1.2"), x("2.00")).state
        assertEquals("10004.00", Money.format(next.balance!!))
        assertFalse(BalanceCheck.matches(money("9986"), next.balance!!))
    }

    @Test
    fun `a new session expects the balance where the run left it, a new run the configured one`() {
        val config = GuardedConfig(balance = money("10000"))
        assertEquals(money("10000"), GuardedStart.expectedStartBalance(config, null))
        assertEquals(money("10046"), GuardedStart.expectedStartBalance(config, GuardedState(part = 2, balance = money("10046"))))
        assertEquals(money("10000"), GuardedStart.expectedStartBalance(config, GuardedState(phase = GuardedPhase.DONE, balance = money("10200"))))
        assertNull(GuardedStart.expectedStartBalance(config.copy(balance = null), GuardedState(balance = money("1"))))
        assertEquals(money("9990"), GuardedStart.begin(GuardedState(part = 2, balance = money("10046")), money("9990")).balance)
    }
}
