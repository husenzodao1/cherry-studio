package app.coefmonitor.calc

import app.coefmonitor.calc.calculator.CalculationInput
import app.coefmonitor.calc.calculator.Money
import app.coefmonitor.calc.calculator.MartingaleCalculator
import app.coefmonitor.calc.calculator.RoundStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

/**
 * Deterministic mathematical acceptance tests. No randomness is used anywhere in this file.
 *
 * Progression rule: round 1 = initial bet; every later round = previous bet × step multiplier,
 * so the bet grows immediately after each loss, starting at round 2.
 */
class MartingaleCalculatorTest {

    private fun bd(value: String) = BigDecimal(value)

    private fun calc(target: String, balance: String, bet: String, rounds: Int = 15) =
        MartingaleCalculator.calculate(CalculationInput(bd(target), bd(balance), bd(bet), rounds))

    private fun assertMoney(expected: String, actual: BigDecimal) {
        assertEquals("expected $expected, got $actual", 0, bd(expected).compareTo(actual))
    }

    @Test
    fun `TEST 1 progression multiplier for target 3_50 is 1_40`() {
        val report = calc("3.50", "5000", "1.00")
        assertMoney("1.40", report.stepMultiplier)
    }

    @Test
    fun `bet grows immediately from round 2 - 2_00 then 6_00 then 18_00`() {
        // Target 1.50 gives step 1 + 1 / 0.50 = 3.00.
        val report = calc("1.50", "1000", "2.00")
        assertMoney("3.00", report.stepMultiplier)
        listOf("2.00", "6.00", "18.00", "54.00", "162.00").forEachIndexed { index, value ->
            assertMoney(value, report.rows[index].bet)
        }
    }

    @Test
    fun `the first bet is never repeated in round 2`() {
        val report = calc("3.50", "5000", "1.00")
        assertMoney("1.00", report.rows[0].bet)
        assertMoney("1.40", report.rows[1].bet)
        assertTrue(report.rows[1].bet > report.rows[0].bet)
    }

    @Test
    fun `TEST 2 first ten bets follow previous bet times step`() {
        val expected = listOf("1.00", "1.40", "1.96", "2.74", "3.84", "5.38", "7.53", "10.54", "14.76", "20.66")
        val report = calc("3.50", "5000", "1.00")
        expected.forEachIndexed { index, value ->
            assertMoney(value, report.rows[index].bet)
        }
    }

    @Test
    fun `TEST 3 round 1 gross payout, cumulative bet and net profit`() {
        val row = calc("3.50", "5000", "1.00").rows[0]
        assertMoney("3.50", row.grossPayout)
        assertMoney("1.00", row.cumulativeBet)
        assertMoney("2.50", row.netProfit)
    }

    @Test
    fun `TEST 4 round 2 gross payout, cumulative bet and net profit`() {
        val row = calc("3.50", "5000", "1.00").rows[1]
        assertMoney("4.90", row.grossPayout)
        assertMoney("2.40", row.cumulativeBet)
        assertMoney("2.50", row.netProfit)
    }

    @Test
    fun `TEST 5 round 3 gross payout, cumulative bet and net profit`() {
        val row = calc("3.50", "5000", "1.00").rows[2]
        assertMoney("6.86", row.grossPayout)
        assertMoney("4.36", row.cumulativeBet)
        assertMoney("2.50", row.netProfit)
    }

    /** Sum of 1.4^k for k = 0..14 is 386.42024; the sum of the 15 displayed two-decimal bets is 386.42. */
    @Test
    fun `TEST 6 cumulative loss after 15 losing rounds is 386_42`() {
        val report = calc("3.50", "5000", "1.00")
        assertMoney("111.12", report.rows.last().bet)
        assertMoney("386.42", report.rows.last().cumulativeBet)
    }

    @Test
    fun `a win in any round nets about initial bet times target minus one`() {
        // With step = T / (T - 1), a win always recovers earlier losses plus B × (T - 1) = 2.50,
        // up to two-decimal rounding of the individual bets.
        val report = calc("3.50", "5000", "1.00")
        report.rows.forEach { row ->
            val deviation = row.netProfit.subtract(bd("2.50")).abs()
            assertTrue("round ${row.round}: net ${row.netProfit}", deviation <= bd("0.10"))
        }
    }

    @Test
    fun `TEST 7 values are rounded to two decimals with HALF_UP`() {
        assertEquals("2.75", Money.round(bd("2.745")).toPlainString())
        assertEquals("1.01", Money.round(bd("1.005")).toPlainString())
        assertEquals("2.74", Money.round(bd("2.744")).toPlainString())
        assertEquals("2.74", Money.round(bd("2.7449999")).toPlainString())
        assertEquals("-2.75", Money.round(bd("-2.745")).toPlainString())
        assertEquals("1,234,567.89", Money.format(bd("1234567.888")))
        assertEquals("3.50x", Money.formatMultiplier(bd("3.5")))
    }

    @Test
    fun `every table row satisfies the defined formulas`() {
        val report = calc("3.50", "5000", "1.00")
        var running = BigDecimal.ZERO
        for (row in report.rows) {
            running = running.add(row.bet)
            assertEquals(0, running.compareTo(row.cumulativeBet))
            assertEquals(0, row.grossPayout.compareTo(Money.round(row.bet.multiply(bd("3.50")))))
            assertEquals(0, row.netProfit.compareTo(row.grossPayout.subtract(row.cumulativeBet)))
            assertEquals(0, row.remainingBalance.compareTo(bd("5000").subtract(row.cumulativeBet)))
        }
    }

    @Test
    fun `balance 100 stops at round 11 with exposure 98_74 and peak bet 28_93`() {
        val report = calc("3.50", "100", "1.00")
        assertEquals(11, report.maxAffordableRound)
        assertMoney("28.93", report.peakBet)
        assertMoney("98.74", report.maxExposure)
        assertMoney("1.26", report.remainingBalance)
        assertMoney("98.74", report.riskPercent)
        assertEquals(12, report.stopRound)
        assertEquals(RoundStatus.MAX_AFFORDABLE, report.rows[10].status)
        assertEquals(RoundStatus.STOP_LOSS, report.rows[11].status)
        assertEquals(RoundStatus.UNAFFORDABLE, report.rows[12].status)
        assertFalse(report.initialBetUnaffordable)
    }

    @Test
    fun `TEST 8 insufficient balance triggers the affordability warning`() {
        val report = calc("3.50", "0.50", "1.00")
        assertTrue(report.initialBetUnaffordable)
        assertEquals(0, report.maxAffordableRound)
        assertEquals(RoundStatus.STOP_LOSS, report.rows[0].status)
        assertTrue(report.rows.drop(1).all { it.status == RoundStatus.UNAFFORDABLE })
        assertMoney("0.00", report.peakBet)
        assertMoney("0.00", report.maxExposure)
        assertMoney("0.50", report.remainingBalance)
    }

    @Test
    fun `an unaffordable next bet is flagged rather than suggested`() {
        // Balance 2.00: round 1 costs 1.00; round 2 (1.40) would bring the total to 2.40.
        val report = calc("3.50", "2.00", "1.00")
        assertEquals(1, report.maxAffordableRound)
        assertEquals(RoundStatus.MAX_AFFORDABLE, report.rows[0].status)
        assertEquals(RoundStatus.STOP_LOSS, report.rows[1].status)
        assertMoney("1.00", report.remainingBalance)
    }

    @Test
    fun `scan beyond the table finds the true affordability limit`() {
        val report = calc("3.50", "5000", "1.00")
        assertTrue(report.maxAffordableRound > 15)
        assertTrue(report.maxExposure <= bd("5000"))
        assertFalse(report.scanLimitReached)
        // Every table row fits inside the balance, so none is flagged as the stop point.
        assertTrue(report.rows.all { it.status == RoundStatus.AFFORDABLE })
    }

    @Test
    fun `risk percentage is exposure divided by balance`() {
        val report = calc("3.50", "1000", "1.00")
        val expected = report.maxExposure.multiply(bd("100")).divide(bd("1000"), 2, java.math.RoundingMode.HALF_UP)
        assertEquals(0, expected.compareTo(report.riskPercent))
    }
}
