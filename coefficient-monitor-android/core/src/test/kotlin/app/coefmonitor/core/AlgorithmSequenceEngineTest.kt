package app.coefmonitor.core

import org.junit.Assert.assertEquals
import org.junit.Test

class AlgorithmSequenceEngineTest {

    private val threshold = Coefficient.DEFAULT_THRESHOLD

    private fun run(values: List<String>, count: Int, start: Int = 0): List<Int> {
        var index = start
        return values.map { text ->
            val value = Coefficient.parseUserInput(text)!!
            index = AlgorithmSequenceEngine.next(index, count, value, threshold).newIndex
            index + 1
        }
    }

    @Test
    fun `A - standard sequence matches the specification`() {
        val input = listOf("1.70", "1.60", "1.20", "2.10", "2.30", "1.50", "1.70", "1.90", "2.50")
        assertEquals(listOf(2, 3, 4, 1, 1, 2, 3, 4, 1), run(input, count = 25))
    }

    @Test
    fun `A - transition types match the specification`() {
        val types = mutableListOf<TransitionType>()
        var index = 0
        for (text in listOf("1.70", "1.60", "1.20", "2.10", "2.30")) {
            val t = AlgorithmSequenceEngine.next(index, 25, Coefficient.parseUserInput(text)!!, threshold)
            types += t.type
            index = t.newIndex
        }
        assertEquals(
            listOf(
                TransitionType.ADVANCE, TransitionType.ADVANCE, TransitionType.ADVANCE,
                TransitionType.RESET_TO_FIRST, TransitionType.NO_POSITION_CHANGE,
            ),
            types,
        )
    }

    @Test
    fun `B - threshold boundaries`() {
        fun at(text: String) = AlgorithmSequenceEngine.next(4, 25, Coefficient.parseUserInput(text)!!, threshold)
        assertEquals(5, at("1.99").newIndex)
        assertEquals(TransitionType.ADVANCE, at("1.99").type)
        assertEquals(5, at("2.00").newIndex)
        assertEquals(TransitionType.ADVANCE, at("2.00").type)
        assertEquals(0, at("2.01").newIndex)
        assertEquals(TransitionType.RESET_TO_FIRST, at("2.01").type)
    }

    @Test
    fun `B - custom threshold is respected`() {
        val custom = Coefficient.parseUserInput("1.50")!!
        val low = AlgorithmSequenceEngine.next(0, 10, Coefficient.parseUserInput("1.50")!!, custom)
        val high = AlgorithmSequenceEngine.next(3, 10, Coefficient.parseUserInput("1.51")!!, custom)
        assertEquals(TransitionType.ADVANCE, low.type)
        assertEquals(TransitionType.RESET_TO_FIRST, high.type)
    }

    @Test
    fun `F - repeated high coefficients keep algorithm 1`() {
        assertEquals(listOf(1, 1, 1, 1), run(listOf("2.30", "5.00", "2.01", "100.00"), count = 25))
        val t = AlgorithmSequenceEngine.next(0, 25, Coefficient.parseUserInput("3.00")!!, threshold)
        assertEquals(TransitionType.NO_POSITION_CHANGE, t.type)
        assertEquals(TransitionReason.ALREADY_AT_FIRST, t.reason)
    }

    @Test
    fun `G - progression works through 100+ algorithms without a 20 item limit`() {
        val count = 150
        var index = 0
        repeat(count - 1) {
            index = AlgorithmSequenceEngine.next(index, count, Coefficient(150), threshold).newIndex
        }
        assertEquals(count - 1, index)
        // Algorithms 20, 25 and 50 are not special.
        assertEquals(20, AlgorithmSequenceEngine.next(19, count, Coefficient(150), threshold).newIndex)
        assertEquals(25, AlgorithmSequenceEngine.next(24, count, Coefficient(150), threshold).newIndex)
        assertEquals(50, AlgorithmSequenceEngine.next(49, count, Coefficient(150), threshold).newIndex)
        assertEquals(0, AlgorithmSequenceEngine.next(120, count, Coefficient(201), threshold).newIndex)
    }

    @Test
    fun `K - last configured algorithm holds position instead of wrapping`() {
        val t = AlgorithmSequenceEngine.next(24, 25, Coefficient(150), threshold)
        assertEquals(24, t.newIndex)
        assertEquals(TransitionType.NO_POSITION_CHANGE, t.type)
        assertEquals(TransitionReason.END_OF_SEQUENCE, t.reason)
        // After the user adds algorithm 26, progression resumes normally.
        assertEquals(25, AlgorithmSequenceEngine.next(24, 26, Coefficient(150), threshold).newIndex)
        // A high value still resets from the last position.
        assertEquals(0, AlgorithmSequenceEngine.next(24, 25, Coefficient(250), threshold).newIndex)
    }

    @Test
    fun `no algorithms configured never crashes`() {
        val t = AlgorithmSequenceEngine.next(3, 0, Coefficient(150), threshold)
        assertEquals(TransitionReason.NO_ALGORITHMS, t.reason)
        assertEquals(TransitionType.NO_POSITION_CHANGE, t.type)
    }

    @Test
    fun `out of range stored index is clamped not reset`() {
        val t = AlgorithmSequenceEngine.next(40, 10, Coefficient(150), threshold)
        assertEquals(9, t.previousIndex)
        assertEquals(TransitionReason.END_OF_SEQUENCE, t.reason)
    }
}
