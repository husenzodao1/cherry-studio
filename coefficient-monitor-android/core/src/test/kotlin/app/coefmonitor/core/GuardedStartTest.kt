package app.coefmonitor.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GuardedStartTest {

    private fun money(text: String) = Money.parse(text)!!
    private fun x(text: String) = Coefficient.parseUserInput(text)!!
    private fun Long.text() = Money.format(this)

    /** The user's example: wait for 3 lows below 2.00x, 200 in 4 parts of 50, start stake 2. */
    private val example = GuardedConfig(lowsInRow = 3, amount = money("200"), parts = 4, startStake = money("2"))
    private val t2 = x("2.00")

    /** Plays [values] and returns every step. */
    private fun play(config: GuardedConfig, threshold: Coefficient, values: List<String>, from: GuardedState = GuardedState()): List<GuardedStep> {
        var state = from
        return values.map { value ->
            GuardedStart.onRound(config, state, x(value), threshold).also { state = it.state }
        }
    }

    @Test
    fun `stakes follow the threshold so that every win brings back the losses plus one cycle's profit`() {
        // 2.00x: doubling, +2 a win.
        assertEquals(listOf("2.00", "4.00", "8.00", "16.00", "32.00"), GuardedStart.stakeTable(example, t2, 5).map { it.text() })
        assertEquals("2.00", GuardedStart.cycleProfit(example, t2).text())
        // 3.00x: the stake grows by half, +4 a win; rounded up to a cent (10.125 → 10.13).
        assertEquals(listOf("2.00", "3.00", "4.50", "6.75", "10.13"), GuardedStart.stakeTable(example, x("3.00"), 5).map { it.text() })
        assertEquals("4.00", GuardedStart.cycleProfit(example, x("3.00")).text())
        // 1.50x: tripling, +1 a win.
        assertEquals(listOf("2.00", "6.00", "18.00", "54.00"), GuardedStart.stakeTable(example, x("1.50"), 4).map { it.text() })
        // Any start stake: 1.00 at 2.00x.
        assertEquals(listOf("1.00", "2.00", "4.00"), GuardedStart.stakeTable(example.copy(startStake = money("1")), t2, 3).map { it.text() })
    }

    @Test
    fun `a win on any algorithm makes at least one cycle's profit at any threshold`() {
        for (threshold in listOf("1.10", "1.25", "1.50", "1.73", "2.00", "2.35", "3.00", "5.00", "10.00").map(::x)) {
            for (start in listOf("0.50", "1", "2", "3.33", "10").map(::money)) {
                val config = example.copy(startStake = start)
                val profit = GuardedStart.cycleProfit(config, threshold)
                var lost = 0L
                GuardedStart.stakeTable(config, threshold, 12).forEachIndexed { i, stake ->
                    val net = GuardedStart.winOf(stake, threshold) - lost
                    assertTrue("$threshold start ${start.text()} algorithm ${i + 1}: net ${net.text()}", net >= profit)
                    // Rounding up to a cent adds less than a cent's win.
                    assertTrue("$threshold algorithm ${i + 1} overshoots", net - profit < threshold.hundredths)
                    lost += stake
                }
            }
        }
    }

    @Test
    fun `the user's example - three lows, then 2 + (2 - 2) + 2 = 4`() {
        val steps = play(example, t2, listOf("1.20x", "1.50x", "1.10x", "2.50x", "1.30x", "1.10x", "3.00x").map { it.removeSuffix("x") })
        assertEquals(
            listOf(
                GuardedEvent.LOW_COUNTED, GuardedEvent.LOW_COUNTED, GuardedEvent.STARTED,
                GuardedEvent.WON, GuardedEvent.LOST, GuardedEvent.LOST, GuardedEvent.WON,
            ),
            steps.map { it.event },
        )
        // Nothing is staked while waiting; Algorithm 1 stakes 2 on the 4th round.
        assertEquals(listOf(false, false, true), steps.take(3).map { it.stakesNext })
        assertEquals(listOf("0.00", "0.00", "0.00", "2.00", "-2.00", "-4.00", "8.00"), steps.map { it.change.text() })
        assertEquals(listOf("0.00", "0.00", "0.00", "2.00", "0.00", "-4.00", "4.00"), steps.map { it.state.partProfit.text() })
        assertEquals("2.00", steps.last().state.stake!!.text())
    }

    @Test
    fun `a high round breaks the run of lows`() {
        val steps = play(example, t2, listOf("1.20", "1.50", "2.01", "1.10", "1.90", "2.00"))
        assertEquals(
            listOf(
                GuardedEvent.LOW_COUNTED, GuardedEvent.LOW_COUNTED, GuardedEvent.RUN_BROKEN,
                GuardedEvent.LOW_COUNTED, GuardedEvent.LOW_COUNTED, GuardedEvent.STARTED,
            ),
            steps.map { it.event },
        )
        // Exactly the threshold counts as low.
        assertEquals(GuardedPhase.ACTIVE, steps.last().state.phase)
    }

    @Test
    fun `200 in 4 parts of 50 - 25 wins a part, waiting again between parts, then everything stops`() {
        assertEquals(25L, GuardedStart.winsPerPart(example, t2))
        var state = GuardedState()
        val events = mutableListOf<GuardedEvent>()
        repeat(4) { part ->
            val lows = play(example, t2, listOf("1.50", "1.50", "1.50"), state)
            state = lows.last().state
            assertEquals(GuardedEvent.STARTED, lows.last().event)
            assertEquals(part + 1, state.part)
            // 24 cycles of "lose, lose, win" (+2 each), then a 25th cycle that wins at once.
            repeat(24) {
                state = play(example, t2, listOf("1.20", "1.40", "2.50"), state).last().state
            }
            assertEquals("48.00", state.partProfit.text())
            val last = GuardedStart.onRound(example, state, x("2.50"), t2)
            events += last.event
            state = last.state
        }
        assertEquals(listOf(GuardedEvent.PART_DONE, GuardedEvent.PART_DONE, GuardedEvent.PART_DONE, GuardedEvent.FINISHED), events)
        assertEquals(GuardedPhase.DONE, state.phase)
        assertEquals("200.00", state.totalProfit.text())
        assertNull(state.stake)
        // Done stays done.
        assertEquals(GuardedEvent.FINISHED, GuardedStart.onRound(example, state, x("1.10"), t2).event)
    }

    @Test
    fun `after a part the next part starts from zero and waits for a new run of lows`() {
        val config = example.copy(amount = money("8"), parts = 2)
        val steps = play(config, t2, listOf("1.1", "1.1", "1.1", "2.5", "2.5", "1.1", "1.1", "2.5", "1.1", "1.1", "1.1"))
        assertEquals(GuardedEvent.PART_DONE, steps[4].event)
        assertEquals(2, steps[4].state.part)
        assertEquals(0L, steps[4].state.partProfit)
        assertFalse(steps[4].stakesNext)
        // 1.10x 1.10x then a high one: the run breaks; three new lows are needed.
        assertEquals(listOf(GuardedEvent.LOW_COUNTED, GuardedEvent.LOW_COUNTED, GuardedEvent.RUN_BROKEN), steps.subList(5, 8).map { it.event })
        assertEquals(GuardedEvent.STARTED, steps.last().event)
    }

    @Test
    fun `at 3_00x the stakes and wins change with the threshold`() {
        val t3 = x("3.00")
        // 50 a part at +4 a win: 13 wins (52), since 12 make only 48.
        assertEquals(13L, GuardedStart.winsPerPart(example, t3))
        val steps = play(example, t3, listOf("1.5", "2.9", "3.0", "1.2", "1.9", "4.0"))
        assertEquals(GuardedEvent.STARTED, steps[2].event)
        // Stakes 2, 3, 4.50: lose 2, lose 3, win 4.50 × 2 = 9 → 9 − 5 = +4.
        assertEquals(listOf("-2.00", "-3.00", "9.00"), steps.drop(3).map { it.change.text() })
        assertEquals("4.00", steps.last().state.partProfit.text())
    }

    @Test
    fun `parts that do not divide evenly are compared exactly`() {
        // 100 in 3 parts: 33.333… each; 16 wins of +2 = 32 is not enough, 17 = 34 is.
        val config = example.copy(amount = money("100"), parts = 3, lowsInRow = 1)
        assertEquals(17L, GuardedStart.winsPerPart(config, t2))
        var state = play(config, t2, listOf("1.5")).last().state
        repeat(16) { state = GuardedStart.onRound(config, state, x("2.5"), t2).state }
        assertEquals(GuardedPhase.ACTIVE, state.phase)
        assertEquals(GuardedEvent.PART_DONE, GuardedStart.onRound(config, state, x("2.5"), t2).event)
    }

    @Test
    fun `a round seen late leaves the next round unstaked, which then stakes again`() {
        var state = play(example.copy(lowsInRow = 1), t2, listOf("1.5")).last().state
        // Lost while out of view: counted, but its clicks did not run, so nothing is on the next round.
        val late = GuardedStart.onRound(example, state, x("1.2"), t2, live = false)
        assertEquals(GuardedEvent.LOST, late.event)
        assertNull(late.state.stake)
        state = late.state
        val unstaked = GuardedStart.onRound(example, state, x("5.0"), t2)
        assertEquals(GuardedEvent.NO_STAKE, unstaked.event)
        assertEquals(0L, unstaked.change)
        // The stake that wins the 2 back plus 2 goes on the next round.
        assertEquals("4.00", unstaked.state.stake!!.text())
        assertEquals("-2.00", unstaked.state.partProfit.text())
    }

    @Test
    fun `restart keeps the part, drops a broken-off cycle into its profit and waits for lows again`() {
        val running = GuardedState(phase = GuardedPhase.ACTIVE, part = 3, partProfit = money("10") - money("6"), cycleLoss = money("6"), stake = money("8"))
        val begun = GuardedStart.begin(running)
        assertEquals(GuardedState(phase = GuardedPhase.WAITING, part = 3, partProfit = money("4")), begun)
        assertEquals(GuardedState(), GuardedStart.begin(GuardedState(phase = GuardedPhase.DONE, part = 4)))
        assertEquals(GuardedState(), GuardedStart.begin(null))
    }

    @Test
    fun `money input and output`() {
        assertEquals(2 * Money.ONE, Money.parse("2"))
        assertEquals(250 * Money.ONE / 100, Money.parse("2,50"))
        assertNull(Money.parse("0"))
        assertNull(Money.parse("-1"))
        assertNull(Money.parse("1.234"))
        assertEquals("-4.00", (-4 * Money.ONE).text())
        assertEquals("10.13", 101_300L.text())
    }

    @Test
    fun `invalid settings are reported`() {
        assertNull(example.problem())
        assertTrue(example.copy(lowsInRow = 0).problem() != null)
        assertTrue(example.copy(parts = 0).problem() != null)
        assertTrue(example.copy(startStake = 0).problem() != null)
        assertTrue(example.copy(winsPerRun = 0).problem() != null)
        assertNull(example.copy(winsPerRun = 5).problem())
    }

    @Test
    fun `after 5 wins of a run the algorithms wait for a new run of lows, the part goes on`() {
        // Coefficient 2, start 2, five wins a run: 2+, 2-, 4+, ... until five wins, then wait.
        val config = example.copy(winsPerRun = 5)
        val steps = play(
            config, t2,
            listOf("1.5", "1.5", "1.5") + // run of lows: start
                listOf("2.5", "1.3", "3.0", "2.2", "1.1", "1.4", "5.0", "2.1") + // wins 1..5
                listOf("1.2", "2.5", "1.2", "1.3", "1.1"), // waiting: no stakes, run broken, new run
        )
        assertEquals(
            listOf(
                GuardedEvent.LOW_COUNTED, GuardedEvent.LOW_COUNTED, GuardedEvent.STARTED,
                GuardedEvent.WON, GuardedEvent.LOST, GuardedEvent.WON, GuardedEvent.WON,
                GuardedEvent.LOST, GuardedEvent.LOST, GuardedEvent.WON, GuardedEvent.RUN_DONE,
                GuardedEvent.LOW_COUNTED, GuardedEvent.RUN_BROKEN, GuardedEvent.LOW_COUNTED, GuardedEvent.LOW_COUNTED,
                GuardedEvent.STARTED,
            ),
            steps.map { it.event },
        )
        // 2+, 2-, 4+, 2+, 2-, 4-, 8+, 2+: five wins make 10; the part (50) goes on.
        val done = steps[10]
        assertEquals("10.00", done.state.partProfit.text())
        assertEquals(GuardedPhase.WAITING, done.state.phase)
        assertEquals(1, done.state.part)
        assertFalse(done.stakesNext)
        // Nothing is staked while waiting again; the new run starts counting wins from zero.
        assertEquals(listOf(0L, 0L, 0L, 0L, 0L), steps.subList(11, 16).map { it.change })
        assertEquals(0, steps.last().state.runWins)
        assertEquals("2.00", steps.last().state.stake!!.text())
    }

    @Test
    fun `a part made inside a run ends it, whatever the wins`() {
        val config = example.copy(amount = money("8"), parts = 2, winsPerRun = 5, lowsInRow = 1)
        // Parts of 4: two wins make one; the second part needs its own low first.
        val steps = play(config, t2, listOf("1.5", "2.5", "2.5", "1.5", "2.5", "2.5"))
        assertEquals(GuardedEvent.PART_DONE, steps[2].event)
        assertEquals(0, steps[2].state.runWins)
        assertEquals(GuardedEvent.FINISHED, steps.last().event)
    }

    @Test
    fun `a balance that is not the martingale's is taken as it is and the run goes on to the target`() {
        // The martingale says 16 of 50 made from 10000, so 10016; the screen shows 10024 after a stake went wrong.
        val config = example.copy(balance = money("10000"))
        val state = GuardedState(phase = GuardedPhase.ACTIVE, part = 1, partProfit = money("16"), totalProfit = money("16"), stake = money("2"), balance = money("10016"))
        val corrected = GuardedStart.reconcile(config, state, money("10024"))!!
        assertEquals(GuardedEvent.BALANCE_CORRECTED, corrected.event)
        assertEquals("8.00", corrected.change.text())
        assertEquals("24.00", corrected.state.partProfit.text())
        assertEquals("10024.00", corrected.state.balance!!.text())
        // It keeps staking: 13 more wins of +2 make the part (24 + 26 = 50).
        var running = corrected.state
        repeat(12) { running = GuardedStart.onRound(config, running, x("2.5"), t2).state }
        assertEquals(GuardedPhase.ACTIVE, running.phase)
        val last = GuardedStart.onRound(config, running, x("2.5"), t2)
        assertEquals(GuardedEvent.PART_DONE, last.event)
        assertEquals("10050.00", last.state.balance!!.text())
    }

    @Test
    fun `a lower balance means more wins, and a balance that already makes the part makes it`() {
        val config = example.copy(balance = money("10000"))
        val state = GuardedState(phase = GuardedPhase.ACTIVE, part = 2, partProfit = money("16"), totalProfit = money("66"), stake = money("2"), balance = money("10066"))
        val lower = GuardedStart.reconcile(config, state, money("10046"))!!
        assertEquals("-4.00", lower.state.partProfit.text())
        assertEquals(GuardedPhase.ACTIVE, lower.state.phase)
        val higher = GuardedStart.reconcile(config, state, money("10101"))!!
        assertEquals(GuardedEvent.PART_DONE, higher.event)
        assertEquals(3, higher.state.part)
        assertNull(higher.state.stake)
        // Matching (the last cent digit is not compared), not checked, or done: nothing to correct.
        assertNull(GuardedStart.reconcile(config, state, money("10066.07")))
        assertNull(GuardedStart.reconcile(config, state.copy(balance = null), money("10101")))
        assertNull(GuardedStart.reconcile(config, state.copy(phase = GuardedPhase.DONE), money("10101")))
    }
}
