package app.coefmonitor.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NewRoundDetectorTest {

    private fun driver(
        policy: FirstRoundPolicy = FirstRoundPolicy.INITIALIZE_ONLY,
        baseline: DetectorBaseline = DetectorBaseline(),
        config: DetectorConfig = DetectorConfig(firstRoundPolicy = policy, minRoundIntervalMs = 1_000),
    ) = FrameDriver(NewRoundDetector(config, baseline))

    @Test
    fun `first visible round only initialises by default`() {
        val d = driver()
        d.still("2.01x", "1.53x")
        assertTrue(d.results.any { it is DetectorResult.Initialized })
        assertEquals(0, d.newRounds.size)
    }

    @Test
    fun `first visible round is processed when the user opts in`() {
        val d = driver(policy = FirstRoundPolicy.PROCESS_FIRST)
        d.still("2.01x", "1.53x", frames = 10)
        assertEquals(1, d.newRounds.size)
        assertEquals(DetectionReason.FIRST_OBSERVATION, d.newRounds.single().reason)
        assertEquals(201L, d.newRounds.single().value.hundredths)
    }

    @Test
    fun `C - repeated OCR frames of one round produce exactly one event`() {
        val d = driver()
        d.still("2.01x", "1.53x")
        d.shiftTo("1.70x", oldText = "2.01x", newNeighbor = "2.01x")
        d.still("1.70x", "2.01x", frames = 200)
        assertEquals(1, d.newRounds.size)
        assertEquals(170L, d.newRounds.single().value.hundredths)
        assertEquals(DetectionReason.VALUE_CHANGED, d.newRounds.single().reason)
        assertEquals(1L, d.newRounds.single().sequence)
    }

    @Test
    fun `value must be stable for the configured number of frames`() {
        val d = driver()
        d.still("2.01x", "1.53x")
        d.frame("1.70x", offsetX = 40, reading = null)
        // Arriving frame still differs from the previous (moving) one, so it is not counted.
        assertEquals(DetectorResult.Transitioning, d.frame("1.70x", "2.01x"))
        d.frame("1.70x", "2.01x")
        d.frame("1.70x", "2.01x")
        assertEquals(0, d.newRounds.size)
        d.frame("1.70x", "2.01x")
        assertEquals(1, d.newRounds.size)
    }

    @Test
    fun `D - equal coefficients in separate rounds are both processed (row shift via neighbour)`() {
        val d = driver()
        d.still("1.70x", "1.53x")
        d.waitMs(5_000)
        d.shiftTo("1.70x", oldText = "1.70x", newNeighbor = "1.70x")
        assertEquals(1, d.newRounds.size)
        assertEquals(DetectionReason.SAME_VALUE_ROW_SHIFT, d.newRounds.last().reason)
    }

    @Test
    fun `D - equal coefficients detected by motion when no neighbour is available`() {
        val d = driver()
        d.still("1.70x")
        d.waitMs(5_000)
        d.shiftTo("1.70x", oldText = "1.70x")
        d.waitMs(5_000)
        d.shiftTo("1.70x", oldText = "1.70x")
        assertEquals(2, d.newRounds.size)
        assertTrue(d.newRounds.all { it.reason == DetectionReason.SAME_VALUE_MOTION })
        assertEquals(listOf(1L, 2L), d.newRounds.map { it.sequence })
    }

    @Test
    fun `D - three equal values in a row still count via motion`() {
        val d = driver()
        d.still("1.00x", "1.00x")
        d.waitMs(5_000)
        d.shiftTo("1.00x", oldText = "1.00x", newNeighbor = "1.00x")
        assertEquals(1, d.newRounds.size)
    }

    @Test
    fun `switching to another app and back does not create a round`() {
        val d = driver()
        d.still("1.70x", "1.53x")
        // Another app covers the region: different picture, unreadable text, for several seconds.
        d.frame("Settings", "Wi-Fi")
        d.still("Settings", "Wi-Fi", frames = 10)
        d.frame("1.70x", "1.53x")
        d.still("1.70x", "1.53x", frames = 10)
        assertEquals(0, d.newRounds.size)
    }

    @Test
    fun `switching away and back without neighbour does not create a round`() {
        val d = driver()
        d.still("1.70x")
        d.frame("Settings")
        d.still("Settings", frames = 10)
        d.frame("1.70x")
        d.still("1.70x", frames = 10)
        assertEquals(0, d.newRounds.size)
    }

    @Test
    fun `E - invalid OCR never produces events`() {
        val d = driver(policy = FirstRoundPolicy.PROCESS_FIRST)
        val bad = listOf(
            OcrReading.Rejected("", RejectionReason.EMPTY),
            CoefficientParser.parse("2.0"),
            CoefficientParser.parse("2.O1x"),
            CoefficientParser.parse("?"),
            CoefficientParser.parse("1.53x", confidence = 0.2f),
        )
        for (reading in bad) {
            repeat(10) { d.frame("1.53x", "1.20x", reading = reading) }
        }
        assertEquals(0, d.newRounds.size)
        assertTrue(d.results.filterIsInstance<DetectorResult.Rejected>().size >= 40)
        val lowConfidence = d.results.filterIsInstance<DetectorResult.Rejected>().last().reading
        assertEquals(RejectionReason.LOW_CONFIDENCE, (lowConfidence as OcrReading.Rejected).reason)
    }

    @Test
    fun `E - a flickering reading never reaches the stability requirement`() {
        val d = driver(policy = FirstRoundPolicy.PROCESS_FIRST)
        repeat(20) { i ->
            d.frame("1.53x", "1.20x", reading = CoefficientParser.parse(if (i % 2 == 0) "1.53x" else "1.58x", 0.9f))
        }
        assertEquals(0, d.newRounds.size)
    }

    @Test
    fun `transitions are ignored while the tile is moving`() {
        val d = driver()
        d.still("2.01x", "1.53x")
        repeat(6) { i -> d.frame("1.70x", offsetX = (i + 1) * 12) }
        assertEquals(0, d.newRounds.size)
        assertTrue(d.results.takeLast(6).all { it is DetectorResult.Transitioning })
    }

    @Test
    fun `changes inside the cooldown are treated as corrections`() {
        val d = driver(config = DetectorConfig(minRoundIntervalMs = 10_000))
        d.still("2.01x", "1.53x")
        d.shiftTo("1.70x", oldText = "2.01x", newNeighbor = "2.01x")
        d.shiftTo("1.76x", oldText = "1.70x", newNeighbor = "1.70x")
        assertEquals(1, d.newRounds.size)
        assertTrue(d.results.any { it is DetectorResult.SuppressedByCooldown })
    }

    @Test
    fun `continuity is confirmed when the previous tile moved one slot right`() {
        val d = driver()
        d.still("2.01x", "1.53x")
        d.shiftTo("1.70x", oldText = "2.01x", newNeighbor = "2.01x")
        assertEquals(Continuity.CONFIRMED, d.newRounds.single().continuity)
    }

    @Test
    fun `a gap is flagged when the neighbour is not the previous tile`() {
        val d = driver()
        d.still("2.01x", "1.53x")
        // Two rounds happened between frames: the neighbour shows 3.40x, not 2.01x.
        d.shiftTo("1.70x", oldText = "2.01x", newNeighbor = "3.40x")
        assertEquals(Continuity.GAP_SUSPECTED, d.newRounds.single().continuity)
    }

    @Test
    fun `L - restart with the same visible round does not replay it`() {
        val baseline = DetectorBaseline(lastObservedValue = Coefficient(170), lastSequence = 5, lastEventAtMs = 0)
        val d = driver(policy = FirstRoundPolicy.PROCESS_FIRST, baseline = baseline)
        d.still("1.70x", "2.01x", frames = 20)
        assertEquals(0, d.newRounds.size)
        assertTrue(d.results.any { it is DetectorResult.Initialized })
    }

    @Test
    fun `L - restart continues sequence numbering`() {
        val baseline = DetectorBaseline(lastObservedValue = Coefficient(170), lastSequence = 5, lastEventAtMs = 0)
        val d = driver(baseline = baseline)
        d.still("1.70x", "2.01x")
        d.shiftTo("2.50x", oldText = "1.70x", newNeighbor = "1.70x")
        assertEquals(6L, d.newRounds.single().sequence)
    }

    @Test
    fun `L - OCR interruption followed by the same round does not create an event`() {
        val d = driver()
        d.still("1.70x", "2.01x")
        repeat(10) { d.frame("1.70x", "2.01x", reading = OcrReading.Rejected("", RejectionReason.EMPTY)) }
        d.still("1.70x", "2.01x", frames = 10)
        assertEquals(0, d.newRounds.size)
    }

    @Test
    fun `L - blank capture after revocation is ignored`() {
        val d = driver()
        d.still("1.70x", "2.01x")
        val blank = ImageSignature.fromLuminance(FloatArray(100) { 0f }, 10, 10)
        repeat(10) {
            d.detector.onFrame(FrameSample(d.now + 1, blank, blank, OcrReading.Rejected("", RejectionReason.EMPTY)))
        }
        assertEquals(0, d.newRounds.size)
    }
}
