package app.coefmonitor.calc.calculator

import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode

/** Validated input for the calculator. Build it through the validation layer. */
data class CalculationInput(
    /** Target multiplier, strictly greater than 1.00 (for example 3.50). */
    val targetMultiplier: BigDecimal,
    /** Starting balance in TJS, strictly positive. */
    val startingBalance: BigDecimal,
    /** Round 1 bet in TJS, strictly positive. Each later bet is the previous one times the step. */
    val initialBet: BigDecimal,
    /** Number of rows shown in the progression table. */
    val rounds: Int = MartingaleCalculator.DEFAULT_ROUNDS,
)

enum class RoundStatus {
    /** Affordable, and not the last affordable round. */
    AFFORDABLE,

    /** The highest round the bankroll can cover if every bet loses. */
    MAX_AFFORDABLE,

    /** The first round the bankroll can no longer cover: the progression must stop before it. */
    STOP_LOSS,

    /** Beyond the stop point. Shown for reference only. */
    UNAFFORDABLE,
}

data class RoundRow(
    val round: Int,
    /** Bet for this round, rounded to two decimals. */
    val bet: BigDecimal,
    /** Sum of all bets from round 1 through this round, rounded to two decimals. */
    val cumulativeBet: BigDecimal,
    /** Bet × target multiplier. A hypothetical payout if this round wins, not a profit. */
    val grossPayout: BigDecimal,
    /** Gross payout − cumulative bet. Profit if this round wins. */
    val netProfit: BigDecimal,
    /** Starting balance − cumulative bet. Negative means the bankroll cannot cover this row. */
    val remainingBalance: BigDecimal,
    val status: RoundStatus,
)

data class MartingaleReport(
    val input: CalculationInput,
    /** 1 + 1 / (target − 1), kept at full precision. */
    val stepMultiplier: BigDecimal,
    /** Table rows, length == input.rounds. */
    val rows: List<RoundRow>,
    /** Highest round index whose cumulative bet fits in the balance. 0 means even round 1 does not fit. */
    val maxAffordableRound: Int,
    /** Largest bet that the bankroll covers. 0.00 when no round is affordable. */
    val peakBet: BigDecimal,
    /** Cumulative bet through the maximum affordable round. */
    val maxExposure: BigDecimal,
    /** Starting balance − max exposure. */
    val remainingBalance: BigDecimal,
    /** Max exposure as a percentage of the starting balance, two decimals. */
    val riskPercent: BigDecimal,
    /** Balance-protection level: the cumulative loss at which the progression must stop. Equals max exposure. */
    val stopLossLevel: BigDecimal,
    /** Total loss if every affordable round loses. Equals max exposure. */
    val totalPossibleLoss: BigDecimal,
    /** True when the very first bet is larger than the balance. */
    val initialBetUnaffordable: Boolean,
    /** True when the scan limit was reached, so maxAffordableRound is a lower bound. */
    val scanLimitReached: Boolean,
) {
    /** Round number that must not be played, or null if it is beyond the scan limit. */
    val stopRound: Int? get() = if (scanLimitReached) null else maxAffordableRound + 1
}

/**
 * Pure, deterministic Martingale progression engine.
 *
 * Progression rule (from the reference table):
 *  - round 1 = initial bet
 *  - round n ≥ 2 = previous bet × step multiplier, where step = 1 + 1 / (target − 1)
 *
 * For example, with step 3.0 and initial bet 2.00 the bets are 2.00, 6.00, 18.00, 54.00.
 *
 * The progression is carried at full precision. Each displayed bet is that exact value
 * rounded HALF_UP to two decimals, and all cumulative sums use the displayed two-decimal bets,
 * so every column in the table adds up exactly as it is shown.
 */
object MartingaleCalculator {
    const val DEFAULT_ROUNDS = 15

    /** Hard cap on how far the affordability scan looks ahead. */
    const val SCAN_LIMIT = 10_000

    private val MC = MathContext.DECIMAL128
    private val ONE = BigDecimal.ONE

    fun stepMultiplier(target: BigDecimal): BigDecimal {
        require(target > ONE) { "Target multiplier must be greater than 1" }
        return ONE.add(ONE.divide(target.subtract(ONE), MC))
    }

    fun calculate(input: CalculationInput): MartingaleReport {
        require(input.targetMultiplier > ONE) { "Target multiplier must be greater than 1" }
        require(input.startingBalance.signum() > 0) { "Balance must be positive" }
        require(input.initialBet.signum() > 0) { "Initial bet must be positive" }
        require(input.rounds >= 1) { "At least one round is required" }

        val target = input.targetMultiplier
        val balance = Money.round(input.startingBalance)
        val step = stepMultiplier(target)

        // Scan the affordability frontier beyond the table, so the reported maximum
        // is the true limit even when it is larger than the number of table rows.
        var exactBet = input.initialBet
        var cumulative = BigDecimal.ZERO
        var maxAffordable = 0
        var peakBet = BigDecimal.ZERO
        var maxExposure = BigDecimal.ZERO
        var scanLimitReached = false

        var round = 1
        while (true) {
            if (round > SCAN_LIMIT) {
                scanLimitReached = true
                break
            }
            if (round >= 2) exactBet = exactBet.multiply(step, MC)
            val bet = Money.round(exactBet)
            cumulative = cumulative.add(bet)
            if (cumulative > balance) break
            maxAffordable = round
            peakBet = bet
            maxExposure = cumulative
            round++
        }
        // Rows for the table are computed separately from the same bet sequence.
        val rows = buildRows(input, step, balance, maxAffordable)

        val riskPercent = if (maxExposure.signum() == 0) {
            Money.round(BigDecimal.ZERO)
        } else {
            maxExposure.multiply(BigDecimal("100")).divide(balance, 2, RoundingMode.HALF_UP)
        }

        return MartingaleReport(
            input = input.copy(startingBalance = balance),
            stepMultiplier = step,
            rows = rows,
            maxAffordableRound = maxAffordable,
            peakBet = Money.round(peakBet),
            maxExposure = Money.round(maxExposure),
            remainingBalance = Money.round(balance.subtract(maxExposure)),
            riskPercent = riskPercent,
            stopLossLevel = Money.round(maxExposure),
            totalPossibleLoss = Money.round(maxExposure),
            initialBetUnaffordable = maxAffordable == 0,
            scanLimitReached = scanLimitReached,
        )
    }

    private fun buildRows(
        input: CalculationInput,
        step: BigDecimal,
        balance: BigDecimal,
        maxAffordable: Int,
    ): List<RoundRow> {
        val target = input.targetMultiplier
        val rows = ArrayList<RoundRow>(input.rounds)
        var exactBet = input.initialBet
        var cumulative = BigDecimal.ZERO
        for (round in 1..input.rounds) {
            if (round >= 2) exactBet = exactBet.multiply(step, MC)
            val bet = Money.round(exactBet)
            cumulative = cumulative.add(bet)
            val gross = Money.round(bet.multiply(target, MC))
            val status = when {
                round == maxAffordable -> RoundStatus.MAX_AFFORDABLE
                round <= maxAffordable -> RoundStatus.AFFORDABLE
                round == maxAffordable + 1 -> RoundStatus.STOP_LOSS
                else -> RoundStatus.UNAFFORDABLE
            }
            rows += RoundRow(
                round = round,
                bet = bet,
                cumulativeBet = cumulative,
                grossPayout = gross,
                netProfit = Money.round(gross.subtract(cumulative)),
                remainingBalance = Money.round(balance.subtract(cumulative)),
                status = status,
            )
        }
        return rows
    }
}
