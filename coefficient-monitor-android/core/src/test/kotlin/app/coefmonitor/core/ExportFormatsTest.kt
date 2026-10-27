package app.coefmonitor.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ExportFormatsTest {

    private val algorithms = (1..120).map { i ->
        AlgorithmDefinition(
            name = "Algorithm $i",
            description = "desc $i",
            enabled = i % 7 != 0,
            steps = listOf(AlgorithmStep("step a"), AlgorithmStep("step b", delayMs = 500)),
        )
    }

    @Test
    fun `algorithms round-trip through JSON`() {
        val json = ExportFormats.algorithmsToJson(algorithms)
        val result = ExportFormats.algorithmsFromJson(json) as ImportResult.Success
        assertEquals(algorithms, result.value)
    }

    @Test
    fun `malformed or hostile algorithm files are rejected`() {
        fun failure(text: String) = ExportFormats.algorithmsFromJson(text) is ImportResult.Failure
        assertTrue(failure(""))
        assertTrue(failure("{not json"))
        assertTrue(failure("""{"format":"something-else","version":1,"algorithms":[{"name":"a"}]}"""))
        assertTrue(failure("""{"format":"coefficient-monitor/algorithms","version":99,"algorithms":[{"name":"a"}]}"""))
        assertTrue(failure("""{"format":"coefficient-monitor/algorithms","version":1,"algorithms":[]}"""))
        assertTrue(failure("""{"format":"coefficient-monitor/algorithms","version":1,"algorithms":[{"name":"  "}]}"""))
        assertTrue(
            failure(
                """{"format":"coefficient-monitor/algorithms","version":1,"algorithms":[{"name":"a","steps":[{"text":"x","delayMs":-5}]}]}""",
            ),
        )
        assertTrue(failure("x".repeat(ExportFormats.MAX_IMPORT_CHARS + 1)))
    }

    @Test
    fun `preset round-trip keeps calibration and settings`() {
        val payload = PresetPayload(
            thresholdHundredths = 210,
            detector = DetectorConfig(requiredStableFrames = 4),
            captureIntervalMs = 300,
            globalDelayMs = 100,
            calibration = ObservationCalibration(NormalizedRect(0.2f, 0.3f, 0.4f, 0.6f), NormalizedPoint(0.1f, 0.45f), 968, 191),
            algorithms = algorithms.take(3),
        )
        val parsed = ExportFormats.presetFromJson(ExportFormats.presetToJson("Evening", payload)) as ImportResult.Success
        assertEquals("Evening", parsed.value.first)
        assertEquals(payload, parsed.value.second)
    }

    @Test
    fun `preset with invalid threshold is rejected`() {
        val payload = PresetPayload(50, DetectorConfig(), 300, 100)
        assertTrue(ExportFormats.presetFromJson(ExportFormats.presetToJson("bad", payload)) is ImportResult.Failure)
    }

    @Test
    fun `events export as CSV with escaping and formula protection`() {
        val record = EventRecord(
            timestampMs = 1, roundId = "R-000001", sequence = 1, coefficientHundredths = 170, ocrConfidence = 0.9f,
            ocrValidation = "VALID", previousAlgorithm = 1, newAlgorithm = 2, thresholdHundredths = 200,
            transitionType = TransitionType.ADVANCE, transitionReason = TransitionReason.LOW_COEFFICIENT,
            detectionReason = DetectionReason.VALUE_CHANGED, continuity = Continuity.CONFIRMED,
            processingStatus = ProcessingStatus.APPLIED, error = "=cmd, \"quoted\"",
        )
        val lines = ExportFormats.eventsToCsv(listOf(record)).trim().lines()
        assertEquals(2, lines.size)
        assertTrue(lines[0].startsWith("timestamp_ms,round_id"))
        assertTrue(lines[1].contains("1.70,0.9,VALID,1,2,2.00,ADVANCE"))
        assertTrue(lines[1].endsWith("\"'=cmd, \"\"quoted\"\"\""))
        assertTrue(ExportFormats.eventsToJson(listOf(record)).contains("\"roundId\": \"R-000001\""))
    }
}
