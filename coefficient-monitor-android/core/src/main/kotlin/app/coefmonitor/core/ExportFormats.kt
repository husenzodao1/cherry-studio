package app.coefmonitor.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/** User-adjustable settings that a preset captures. */
@Serializable
data class PresetPayload(
    val thresholdHundredths: Long,
    val detector: DetectorConfig,
    val captureIntervalMs: Long,
    val globalDelayMs: Long,
    /** Null when the preset was saved without algorithm definitions. */
    val algorithms: List<AlgorithmDefinition>? = null,
)

@Serializable
private data class AlgorithmsFile(
    val format: String,
    val version: Int,
    val algorithms: List<AlgorithmDefinition>,
)

@Serializable
private data class EventsFile(
    val format: String,
    val version: Int,
    val events: List<EventRecord>,
)

@Serializable
private data class PresetFile(
    val format: String,
    val version: Int,
    val name: String,
    @SerialName("preset") val payload: PresetPayload,
)

sealed interface ImportResult<out T> {
    data class Success<T>(val value: T) : ImportResult<T>
    data class Failure(val reason: String) : ImportResult<Nothing>
}

object ExportFormats {
    const val ALGORITHMS_FORMAT = "coefficient-monitor/algorithms"
    const val EVENTS_FORMAT = "coefficient-monitor/events"
    const val PRESET_FORMAT = "coefficient-monitor/preset"
    const val VERSION = 1

    /** Imports larger than this are refused before parsing. */
    const val MAX_IMPORT_CHARS = 5_000_000

    val json = Json {
        prettyPrint = true
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    fun algorithmsToJson(algorithms: List<AlgorithmDefinition>): String =
        json.encodeToString(AlgorithmsFile(ALGORITHMS_FORMAT, VERSION, algorithms))

    fun algorithmsFromJson(text: String): ImportResult<List<AlgorithmDefinition>> {
        if (text.length > MAX_IMPORT_CHARS) return ImportResult.Failure("file is too large")
        val file = try {
            json.decodeFromString<AlgorithmsFile>(text)
        } catch (e: SerializationException) {
            return ImportResult.Failure("not a valid algorithms file: ${e.message?.take(200)}")
        } catch (e: IllegalArgumentException) {
            return ImportResult.Failure("not a valid algorithms file: ${e.message?.take(200)}")
        }
        if (file.format != ALGORITHMS_FORMAT) return ImportResult.Failure("unexpected format '${file.format}'")
        if (file.version > VERSION) return ImportResult.Failure("file version ${file.version} is newer than supported")
        if (file.algorithms.isEmpty()) return ImportResult.Failure("file contains no algorithms")
        if (file.algorithms.size > AlgorithmLimits.MAX_IMPORT_ALGORITHMS) {
            return ImportResult.Failure("more than ${AlgorithmLimits.MAX_IMPORT_ALGORITHMS} algorithms")
        }
        val cleaned = file.algorithms.map { it.copy(name = it.name.trim()) }
        cleaned.forEachIndexed { index, definition ->
            AlgorithmLimits.problemOf(definition)?.let { return ImportResult.Failure("algorithm ${index + 1}: $it") }
        }
        return ImportResult.Success(cleaned)
    }

    fun eventsToJson(events: List<EventRecord>): String = json.encodeToString(EventsFile(EVENTS_FORMAT, VERSION, events))

    fun presetToJson(name: String, payload: PresetPayload): String =
        json.encodeToString(PresetFile(PRESET_FORMAT, VERSION, name, payload))

    fun presetFromJson(text: String): ImportResult<Pair<String, PresetPayload>> {
        if (text.length > MAX_IMPORT_CHARS) return ImportResult.Failure("file is too large")
        val file = try {
            json.decodeFromString<PresetFile>(text)
        } catch (e: SerializationException) {
            return ImportResult.Failure("not a valid preset: ${e.message?.take(200)}")
        } catch (e: IllegalArgumentException) {
            return ImportResult.Failure("not a valid preset: ${e.message?.take(200)}")
        }
        if (file.format != PRESET_FORMAT) return ImportResult.Failure("unexpected format '${file.format}'")
        val payload = file.payload
        if (!Coefficient.isValidThreshold(Coefficient(payload.thresholdHundredths))) {
            return ImportResult.Failure("threshold out of range")
        }
        if (!DelayPolicy.isValid(payload.globalDelayMs)) return ImportResult.Failure("global delay out of range")
        payload.algorithms?.forEachIndexed { index, definition ->
            AlgorithmLimits.problemOf(definition)?.let { return ImportResult.Failure("algorithm ${index + 1}: $it") }
        }
        return ImportResult.Success(file.name to payload.copy(detector = payload.detector.sanitized()))
    }

    private val CSV_HEADER = listOf(
        "timestamp_ms", "round_id", "sequence", "coefficient", "ocr_confidence", "ocr_validation",
        "previous_algorithm", "new_algorithm", "threshold", "transition_type", "transition_reason",
        "detection_reason", "continuity", "processing_status", "error",
    )

    fun eventsToCsv(events: List<EventRecord>): String = buildString {
        appendLine(CSV_HEADER.joinToString(","))
        for (e in events) {
            val cells = listOf(
                e.timestampMs.toString(), e.roundId, e.sequence.toString(), e.coefficient.toPlainString(),
                e.ocrConfidence?.toString() ?: "", e.ocrValidation, e.previousAlgorithm.toString(),
                e.newAlgorithm.toString(), e.threshold.toPlainString(), e.transitionType.name,
                e.transitionReason.name, e.detectionReason.name, e.continuity.name, e.processingStatus.name,
                e.error ?: "",
            )
            appendLine(cells.joinToString(",") { csvCell(it) })
        }
    }

    private fun csvCell(value: String): String {
        // Leading = + - @ would be evaluated as formulas by spreadsheet apps.
        val safe = if (value.firstOrNull() in setOf('=', '+', '-', '@')) "'$value" else value
        return if (safe.any { it == ',' || it == '"' || it == '\n' || it == '\r' }) {
            "\"" + safe.replace("\"", "\"\"") + "\""
        } else {
            safe
        }
    }
}
