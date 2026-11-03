package app.coefmonitor.core

import kotlinx.serialization.Serializable

/**
 * Amounts of money as whole ten-thousandths of the currency unit (1.00 == 10_000).
 *
 * Stakes are whole cents and coefficients whole hundredths, so a stake times a coefficient is
 * always a whole number of ten-thousandths: every amount here is exact, nothing is rounded except
 * a stake, which is rounded UP to the next cent.
 */
object Money {
    const val ONE = 10_000L
    private const val PER_CENT = 100L
    private val USER_INPUT = Regex("""^(\d{1,9})(?:[.,](\d{1,2}))?$""")

    /** "200", "2.5" or "2,50" → amount; null for anything else, zero or negative. */
    fun parse(text: String): Long? {
        val match = USER_INPUT.matchEntire(text.trim()) ?: return null
        val cents = match.groupValues[1].toLong() * 100 + match.groupValues[2].padEnd(2, '0').toLong()
        return (cents * PER_CENT).takeIf { it > 0 }
    }

    /** "2.00", "-4.00", "10.13"; amounts below a cent are rounded half up. */
    fun format(amount: Long): String {
        val sign = if (amount < 0) "-" else ""
        val cents = (Math.abs(amount) + PER_CENT / 2) / PER_CENT
        return "$sign${cents / 100}.${(cents % 100).toString().padStart(2, '0')}"
    }

    fun roundUpToCent(amount: Long): Long = Math.floorDiv(amount + PER_CENT - 1, PER_CENT) * PER_CENT
}

/** The settings of the guarded start ("Оғози монеадор"). Amounts are [Money]. */
@Serializable
data class GuardedConfig(
    /** Algorithms start only after this many coefficients at or below the threshold in a row. */
    val lowsInRow: Int = 3,
    /** Total profit to make; the work stops when it is reached. */
    val amount: Long = 200 * Money.ONE,
    /** The amount is made in this many equal parts, each started by its own run of lows. */
    val parts: Int = 4,
    /** Stake of Algorithm 1. */
    val startStake: Long = 2 * Money.ONE,
    /** Balance expected on the screen at the start; null: the balance is not checked. */
    val balance: Long? = null,
    /**
     * After this many wins the algorithms stop staking and wait for a new run of lows (the part
     * goes on). Null: they stake until the part is made.
     */
    val winsPerRun: Int? = null,
) {
    /** Returns a description of the first problem, or null if the configuration is valid. */
    fun problem(): String? = when {
        lowsInRow !in 1..MAX_LOWS_IN_ROW -> "lows in a row outside 1..$MAX_LOWS_IN_ROW"
        amount <= 0 -> "amount must be above zero"
        parts !in 1..MAX_PARTS -> "parts outside 1..$MAX_PARTS"
        startStake <= 0 || startStake % 100 != 0L -> "start stake must be whole cents above zero"
        balance != null && balance <= 0 -> "balance must be above zero"
        winsPerRun != null && winsPerRun !in 1..MAX_WINS_PER_RUN -> "wins per run outside 1..$MAX_WINS_PER_RUN"
        else -> null
    }

    companion object {
        const val MAX_WINS_PER_RUN = 1_000
        const val MAX_LOWS_IN_ROW = 50
        const val MAX_PARTS = 100
    }
}

@Serializable
enum class GuardedPhase {
    /** Counting lows in a row; no stakes. */
    WAITING,

    /** The algorithms stake until the current part is made. */
    ACTIVE,

    /** The whole amount is made; nothing runs any more. */
    DONE,
}

/** Progress of the guarded start; stored together with the sequence position. */
@Serializable
data class GuardedState(
    val phase: GuardedPhase = GuardedPhase.WAITING,
    /** Lows in a row counted while [GuardedPhase.WAITING]. */
    val lowStreak: Int = 0,
    /** 1-based number of the part being made. */
    val part: Int = 1,
    /** Profit of the current part so far (negative while losses are not won back yet). */
    val partProfit: Long = 0,
    /** Profit of all parts together. */
    val totalProfit: Long = 0,
    /** Stakes lost since the last win; the next win must bring them back. */
    val cycleLoss: Long = 0,
    /** Stake on the round being played now; null when nothing was staked on it. */
    val stake: Long? = null,
    /** Wins since the current run of lows started the algorithms (see [GuardedConfig.winsPerRun]). */
    val runWins: Int = 0,
    /**
     * Balance the screen must show when a round has ended (before the next stake is placed): the
     * start balance plus every win and minus every lost stake. Null while the balance is not checked.
     */
    val balance: Long? = null,
)

/** What one round did to the guarded start. */
enum class GuardedEvent {
    /** Waiting: a low round, the run of lows grows. */
    LOW_COUNTED,

    /** Waiting: a high round, the run of lows starts again from zero. */
    RUN_BROKEN,

    /** The run of lows is complete: Algorithm 1 stakes on the next round. */
    STARTED,

    /** Nothing was staked on this round (its clicks did not run): the same stake goes on the next one. */
    NO_STAKE,

    /** The stake was lost: the next algorithm stakes enough to win it back. */
    LOST,

    /** The stake won: back to Algorithm 1. */
    WON,

    /** The win was the last one of this run ([GuardedConfig.winsPerRun]): wait for a new run of lows. */
    RUN_DONE,

    /**
     * The balance on the screen was not the martingale's: it is taken as it is and the part's
     * profit follows it, so the run goes on from the real balance to the target.
     */
    BALANCE_CORRECTED,

    /** The win completed the current part: wait for a new run of lows. */
    PART_DONE,

    /** The win completed the last part: the whole amount is made, everything stops. */
    FINISHED,
}

/** One round applied to the guarded start. */
data class GuardedStep(
    val state: GuardedState,
    val event: GuardedEvent,
    /** Money won (positive) or lost (negative) on this round. */
    val change: Long,
) {
    /** Whether a stake goes on the next round, i.e. the active algorithm's clicks should run. */
    val stakesNext: Boolean get() = state.stake != null
}

/**
 * The guarded start: wait for [GuardedConfig.lowsInRow] low coefficients in a row, then let the
 * algorithms stake until one part of the amount is made, then wait again, until all parts are made.
 *
 * Every stake follows from the threshold T (the cash-out coefficient) so that a win brings back
 * everything lost since the last win plus one cycle's profit, start stake × (T − 1):
 *
 *     stake = (lost since the last win + start stake × (T − 1)) / (T − 1), rounded up to a cent
 *
 * At 2.00x the stakes double (2, 4, 8, …) and a win makes +2; at 3.00x they grow by half
 * (2, 3, 4.50, …) and a win makes +4; at 1.50x they triple (2, 6, 18, …) and a win makes +1.
 * A changed threshold is used from the next stake on. A round at or below T loses, above T wins.
 */
object GuardedStart {

    /** Profit of one won cycle: start stake × (T − 1). */
    fun cycleProfit(config: GuardedConfig, threshold: Coefficient): Long =
        config.startStake / 100 * (threshold.hundredths - 100)

    /** Stake that wins back [lostSinceWin] plus one cycle's profit. */
    fun stake(config: GuardedConfig, lostSinceWin: Long, threshold: Coefficient): Long {
        val gain = threshold.hundredths - 100
        require(gain > 0) { "threshold must be above 1.00x" }
        val needed = lostSinceWin + cycleProfit(config, threshold)
        // stake × gain / 100 >= needed, with the stake rounded up to a cent.
        val exact = Math.floorDiv(needed * 100 + gain - 1, gain)
        return Money.roundUpToCent(exact)
    }

    /** Money a won stake makes: stake × (T − 1). */
    fun winOf(stake: Long, threshold: Coefficient): Long = stake / 100 * (threshold.hundredths - 100)

    /** Stakes of Algorithms 1..[count] when every round before them is lost. */
    fun stakeTable(config: GuardedConfig, threshold: Coefficient, count: Int): List<Long> {
        var lost = 0L
        return List(count) {
            stake(config, lost, threshold).also { lost += it }
        }
    }

    /** The profit one part has to make: amount / parts (exact; compare with [isPartMade]). */
    fun partTarget(config: GuardedConfig): Long = config.amount / config.parts

    fun isPartMade(partProfit: Long, config: GuardedConfig): Boolean = partProfit * config.parts >= config.amount

    /** Wins needed for one part when no cycle is broken off. */
    fun winsPerPart(config: GuardedConfig, threshold: Coefficient): Long {
        val profit = cycleProfit(config, threshold)
        return Math.floorDiv(config.amount + profit * config.parts - 1, profit * config.parts)
    }

    /**
     * The state when monitoring (re)starts. A new run begins from part 1 (also after a finished
     * one); otherwise the part and its profit so far are kept, and the session waits for a new
     * run of lows: a cycle that was broken off keeps its losses in the part's profit.
     */
    fun begin(state: GuardedState?, startBalance: Long? = null): GuardedState =
        if (state == null || state.phase == GuardedPhase.DONE) {
            GuardedState(balance = startBalance)
        } else {
            state.copy(phase = GuardedPhase.WAITING, lowStreak = 0, cycleLoss = 0, stake = null, balance = startBalance)
        }

    /** The balance a new session expects on the screen: where the run left it, or the configured one for a new run. */
    fun expectedStartBalance(config: GuardedConfig, state: GuardedState?): Long? =
        if (config.balance == null) null else state?.takeIf { it.phase != GuardedPhase.DONE }?.balance ?: config.balance

    /**
     * Applies one finished round. [live]: the round was seen when it ended, so a stake decided now
     * can still be placed on the next round; for a round seen late the next round goes unstaked.
     */
    fun onRound(
        config: GuardedConfig,
        state: GuardedState,
        coefficient: Coefficient,
        threshold: Coefficient,
        live: Boolean = true,
    ): GuardedStep {
        val low = coefficient <= threshold
        val step = when (state.phase) {
            GuardedPhase.DONE -> GuardedStep(state, GuardedEvent.FINISHED, 0)
            GuardedPhase.WAITING -> waiting(config, state, low, threshold)
            GuardedPhase.ACTIVE -> active(config, state, low, threshold)
        }
        // A stake can only go on the next round if this one was seen in time to run the clicks.
        val placed = if (!live && step.state.stake != null) step.copy(state = step.state.copy(stake = null)) else step
        return placed.copy(state = placed.state.copy(balance = state.balance?.plus(step.change)))
    }

    private fun waiting(config: GuardedConfig, state: GuardedState, low: Boolean, threshold: Coefficient): GuardedStep {
        if (!low) return GuardedStep(state.copy(lowStreak = 0), GuardedEvent.RUN_BROKEN, 0)
        val streak = state.lowStreak + 1
        if (streak < config.lowsInRow) return GuardedStep(state.copy(lowStreak = streak), GuardedEvent.LOW_COUNTED, 0)
        val started = state.copy(
            phase = GuardedPhase.ACTIVE,
            lowStreak = streak,
            cycleLoss = 0,
            stake = stake(config, 0, threshold),
            runWins = 0,
        )
        return GuardedStep(started, GuardedEvent.STARTED, 0)
    }

    private fun active(config: GuardedConfig, state: GuardedState, low: Boolean, threshold: Coefficient): GuardedStep {
        val placed = state.stake
            ?: return GuardedStep(state.copy(stake = stake(config, state.cycleLoss, threshold)), GuardedEvent.NO_STAKE, 0)
        if (low) {
            val lost = state.cycleLoss + placed
            val next = state.copy(
                partProfit = state.partProfit - placed,
                totalProfit = state.totalProfit - placed,
                cycleLoss = lost,
                stake = stake(config, lost, threshold),
            )
            return GuardedStep(next, GuardedEvent.LOST, -placed)
        }
        val won = winOf(placed, threshold)
        val after = state.copy(
            partProfit = state.partProfit + won,
            totalProfit = state.totalProfit + won,
            cycleLoss = 0,
            runWins = state.runWins + 1,
        )
        val runDone = config.winsPerRun?.let { after.runWins >= it } == true
        return when {
            isPartMade(after.partProfit, config) -> partMade(config, after, won)
            runDone -> GuardedStep(after.copy(phase = GuardedPhase.WAITING, lowStreak = 0, stake = null, runWins = 0), GuardedEvent.RUN_DONE, won)
            else -> GuardedStep(after.copy(stake = stake(config, 0, threshold)), GuardedEvent.WON, won)
        }
    }

    /** The current part is made: the next one waits for a run of lows, or, after the last part, everything is done. */
    private fun partMade(config: GuardedConfig, state: GuardedState, change: Long): GuardedStep =
        if (state.part >= config.parts) {
            GuardedStep(state.copy(phase = GuardedPhase.DONE, stake = null, cycleLoss = 0), GuardedEvent.FINISHED, change)
        } else {
            GuardedStep(
                state.copy(phase = GuardedPhase.WAITING, lowStreak = 0, part = state.part + 1, partProfit = 0, stake = null, cycleLoss = 0, runWins = 0),
                GuardedEvent.PART_DONE,
                change,
            )
        }

    /**
     * The balance on the screen after a round is [screen], not the martingale's [GuardedState.balance]
     * (another stake was placed, a bet went wrong). Nothing stops: the screen is taken as it is, the
     * difference goes into the part's (and the total) profit, and the run goes on from there to the
     * target; if that already makes the part, it is made. Null when the balance is not checked, the
     * screen matches (differences below [BalanceCheck.TOLERANCE]) or everything is done already.
     */
    fun reconcile(config: GuardedConfig, state: GuardedState?, screen: Long): GuardedStep? {
        val expected = state?.balance ?: return null
        if (state.phase == GuardedPhase.DONE || BalanceCheck.matches(screen, expected)) return null
        val difference = screen - expected
        val corrected = state.copy(
            balance = screen,
            partProfit = state.partProfit + difference,
            totalProfit = state.totalProfit + difference,
        )
        if (isPartMade(corrected.partProfit, config)) return partMade(config, corrected, difference)
        return GuardedStep(corrected, GuardedEvent.BALANCE_CORRECTED, difference)
    }
}
