package app.coefmonitor.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StepGuideTest {

    private val calibration = ObservationCalibration(
        tile = NormalizedRect(0.20f, 0.10f, 0.35f, 0.14f),
        placeholder = NormalizedPoint(0.11f, 0.12f),
        referenceWidth = 1080,
        referenceHeight = 2400,
    )

    @Test
    fun `point steps are shown in order with their delays`() {
        val steps = listOf(
            AlgorithmStep("Bet", delayMs = 250, point = NormalizedPoint(0.5f, 0.8f)),
            AlgorithmStep("note only"),
            AlgorithmStep("", point = NormalizedPoint(0.7f, 0.9f)),
            AlgorithmStep("Fast", delayMs = 50, point = NormalizedPoint(0.3f, 0.85f)),
        )
        val plan = StepGuide.plan(steps, globalDelayMs = 1_000, readingBand = null)
        assertEquals(listOf(1, 3, 4), plan.map { it.stepNumber })
        assertEquals(listOf(250L, 1_000L, 50L), plan.map { it.delayMs })
        assertEquals(listOf(StepGuide.MIN_VISIBLE_MS, 1_000L, StepGuide.MIN_VISIBLE_MS), plan.map { it.visibleMs })
    }

    @Test
    fun `points on the row being read are refused`() {
        val band = ObservationRegionManager.readingBand(calibration)
        // Observed tile and its neighbour (one pitch to the right) are covered, with a margin.
        assertFalse(StepGuide.isAllowed(NormalizedPoint(0.27f, 0.12f), band))
        assertFalse(StepGuide.isAllowed(NormalizedPoint(0.45f, 0.12f), band))
        assertTrue(StepGuide.isAllowed(NormalizedPoint(0.27f, 0.50f), band))
        val plan = StepGuide.plan(
            listOf(AlgorithmStep(point = NormalizedPoint(0.27f, 0.12f)), AlgorithmStep(point = NormalizedPoint(0.5f, 0.9f))),
            globalDelayMs = 250,
            readingBand = band,
        )
        assertEquals(listOf(2), plan.map { it.stepNumber })
    }

    @Test
    fun `step points round-trip through export and are validated`() {
        val definition = AlgorithmDefinition("A", steps = listOf(AlgorithmStep("Bet", 100, NormalizedPoint(0.5f, 0.75f))))
        val parsed = ExportFormats.algorithmsFromJson(ExportFormats.algorithmsToJson(listOf(definition))) as ImportResult.Success
        assertEquals(definition, parsed.value.single())
        val outside = definition.copy(steps = listOf(AlgorithmStep(point = NormalizedPoint(1.5f, 0.2f))))
        assertTrue(AlgorithmLimits.problemOf(outside) != null)
        // Old files without points still load.
        val old = """{"format":"coefficient-monitor/algorithms","version":1,"algorithms":[{"name":"B","steps":[{"text":"x","delayMs":5}]}]}"""
        val legacy = ExportFormats.algorithmsFromJson(old) as ImportResult.Success
        assertEquals(null, legacy.value.single().steps.single().point)
    }
}
