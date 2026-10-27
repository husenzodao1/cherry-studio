package app.coefmonitor.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RoundProcessorTest {

    private val threshold = Coefficient.DEFAULT_THRESHOLD

    private fun event(sequence: Long, hundredths: Long) =
        RoundEvent(sequence, Coefficient(hundredths), 0.9f, 1_000L * sequence, DetectionReason.VALUE_CHANGED, Continuity.CONFIRMED)

    @Test
    fun `J - each applied round yields one record matching the state change`() {
        var state = SequenceState()
        val records = mutableListOf<EventRecord>()
        listOf(170L, 160L, 120L, 210L, 230L).forEachIndexed { i, value ->
            val result = RoundProcessor.process(state, event(i + 1L, value), algorithmCount = 25, threshold = threshold)
            result as ProcessResult.Applied
            assertEquals(result.state.activeIndex + 1, result.record.newAlgorithm)
            assertEquals(state.activeIndex + 1, result.record.previousAlgorithm)
            state = result.state
            records += result.record
        }
        assertEquals(5, records.size)
        assertEquals(
            listOf(
                "1.70x — ADVANCE — Algorithm 1 → Algorithm 2",
                "1.60x — ADVANCE — Algorithm 2 → Algorithm 3",
                "1.20x — ADVANCE — Algorithm 3 → Algorithm 4",
                "2.10x — RESET_TO_FIRST — Algorithm 4 → Algorithm 1",
                "2.30x — NO_POSITION_CHANGE — Algorithm 1 remains active",
            ),
            records.map { it.summary() },
        )
        assertEquals(listOf("R-000001", "R-000002", "R-000003", "R-000004", "R-000005"), records.map { it.roundId })
    }

    @Test
    fun `duplicate or older sequence numbers are ignored`() {
        val first = RoundProcessor.process(SequenceState(), event(1, 150), 25, threshold) as ProcessResult.Applied
        val again = RoundProcessor.process(first.state, event(1, 150), 25, threshold)
        val older = RoundProcessor.process(first.state, event(0, 150), 25, threshold)
        assertTrue(again is ProcessResult.Duplicate)
        assertTrue(older is ProcessResult.Duplicate)
        assertEquals(1, first.state.activeIndex)
    }

    @Test
    fun `H - persisted state restarts the detector without replaying`() {
        val applied = RoundProcessor.process(SequenceState(), event(7, 150), 25, threshold) as ProcessResult.Applied
        val baseline = applied.state.toBaseline()
        assertEquals(7L, baseline.lastSequence)
        assertEquals(Coefficient(150), baseline.lastObservedValue)
        val d = FrameDriver(NewRoundDetector(DetectorConfig(firstRoundPolicy = FirstRoundPolicy.PROCESS_FIRST), baseline))
        d.still("1.50x", "2.01x", frames = 20)
        assertEquals(0, d.newRounds.size)
    }

    @Test
    fun `clamping after deleting algorithms keeps the position instead of resetting`() {
        assertEquals(9, RoundProcessor.clampIndex(30, 10))
        assertEquals(4, RoundProcessor.clampIndex(4, 10))
        assertEquals(0, RoundProcessor.clampIndex(4, 0))
    }

    /** End-to-end: synthetic screen frames → detector → processor, using the specification's example. */
    @Test
    fun `A+C+J - full pipeline over the specification example`() {
        val values = listOf("1.70x", "1.60x", "1.20x", "2.10x", "2.30x", "1.50x", "1.70x", "1.90x", "2.50x")
        val d = FrameDriver(NewRoundDetector(DetectorConfig()))
        var state = SequenceState()
        val active = mutableListOf<Int>()
        val records = mutableListOf<EventRecord>()

        var previous = "3.33x"
        var older = "1.11x"
        d.still(previous, older)
        for (value in values) {
            d.waitMs(8_000)
            val before = d.results.size
            d.shiftTo(value, oldText = previous, newNeighbor = previous)
            d.still(value, previous, frames = 30)
            for (result in d.results.drop(before)) {
                if (result is DetectorResult.NewRound) {
                    val applied = RoundProcessor.process(state, result.event, 25, threshold) as ProcessResult.Applied
                    state = applied.state
                    records += applied.record
                    active += state.activeIndex + 1
                }
            }
            older = previous
            previous = value
        }
        assertEquals(listOf(2, 3, 4, 1, 1, 2, 3, 4, 1), active)
        assertEquals(9, records.size)
        assertEquals(values.map { Coefficient.parseUserInput(it)!!.hundredths }, records.map { it.coefficientHundredths })
        assertTrue(records.all { it.continuity == Continuity.CONFIRMED })
    }
}
