package app.coefmonitor.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ClickPlanTest {

    @Test
    fun `steps run in order with their delays and steps without a point are pauses`() {
        val steps = listOf(
            AlgorithmStep("Bet", delayMs = 250, point = NormalizedPoint(0.5f, 0.8f)),
            AlgorithmStep("wait for the button"),
            AlgorithmStep("", point = NormalizedPoint(0.7f, 0.9f)),
            AlgorithmStep("Fast", delayMs = 50, point = NormalizedPoint(0.3f, 0.85f)),
        )
        val plan = ClickPlan.plan(steps, globalDelayMs = 1_000, readingBand = null)
        assertEquals(listOf(1, 2, 3, 4), plan.map { it.stepNumber })
        assertEquals(listOf(250L, 1_000L, 1_000L, 50L), plan.map { it.delayMs })
        assertEquals(listOf(NormalizedPoint(0.5f, 0.8f), null, NormalizedPoint(0.7f, 0.9f), NormalizedPoint(0.3f, 0.85f)), plan.map { it.point })
    }

    @Test
    fun `an algorithm without points has nothing to run`() {
        assertTrue(ClickPlan.plan(listOf(AlgorithmStep("note", delayMs = 500)), globalDelayMs = 250, readingBand = null).isEmpty())
        assertTrue(ClickPlan.plan(emptyList(), globalDelayMs = 250, readingBand = null).isEmpty())
    }

    @Test
    fun `taps on the row being read are refused but the step still waits`() {
        // The newest tile and its neighbour, as followed by the monitor.
        val band = NormalizedRect(0.20f, 0.10f, 0.50f, 0.14f)
        assertFalse(ClickPlan.isAllowed(NormalizedPoint(0.27f, 0.12f), band))
        assertFalse(ClickPlan.isAllowed(NormalizedPoint(0.45f, 0.12f), band))
        assertTrue(ClickPlan.isAllowed(NormalizedPoint(0.27f, 0.50f), band))
        val plan = ClickPlan.plan(
            listOf(
                AlgorithmStep(delayMs = 300, point = NormalizedPoint(0.27f, 0.12f)),
                AlgorithmStep(point = NormalizedPoint(0.5f, 0.9f)),
            ),
            globalDelayMs = 250,
            readingBand = band,
        )
        assertNull(plan[0].point)
        assertEquals(300L, plan[0].delayMs)
        assertEquals(NormalizedPoint(0.5f, 0.9f), plan[1].point)
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
