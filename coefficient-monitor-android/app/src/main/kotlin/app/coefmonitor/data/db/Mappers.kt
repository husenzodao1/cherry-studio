package app.coefmonitor.data.db

import app.coefmonitor.core.AlgorithmDefinition
import app.coefmonitor.core.AlgorithmStep
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.Continuity
import app.coefmonitor.core.DetectionReason
import app.coefmonitor.core.EventRecord
import app.coefmonitor.core.ProcessingStatus
import app.coefmonitor.core.SequenceState
import app.coefmonitor.core.TransitionReason
import app.coefmonitor.core.TransitionType
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

internal val StorageJson = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
}

private val stepListSerializer = ListSerializer(AlgorithmStep.serializer())

/** Malformed stored JSON yields no steps instead of crashing the list. */
fun decodeSteps(json: String): List<AlgorithmStep> =
    runCatching { StorageJson.decodeFromString(stepListSerializer, json) }.getOrDefault(emptyList())

fun encodeSteps(steps: List<AlgorithmStep>): String = StorageJson.encodeToString(stepListSerializer, steps)

fun AlgorithmEntity.toDefinition(): AlgorithmDefinition =
    AlgorithmDefinition(name = name, description = description, enabled = enabled, steps = decodeSteps(stepsJson))

fun AlgorithmDefinition.toEntity(position: Int, id: Long = 0): AlgorithmEntity = AlgorithmEntity(
    id = id,
    position = position,
    name = name.trim(),
    description = description,
    enabled = enabled,
    stepsJson = encodeSteps(steps),
)

inline fun <reified E : Enum<E>> enumOrDefault(name: String?, default: E): E =
    enumValues<E>().firstOrNull { it.name == name } ?: default

inline fun <reified E : Enum<E>> enumOrNull(name: String?): E? = enumValues<E>().firstOrNull { it.name == name }

fun MonitorStateEntity.toSequenceState(): SequenceState = SequenceState(
    activeIndex = activeIndex.coerceAtLeast(0),
    lastSequence = lastSequence.coerceAtLeast(0),
    lastAcceptedValue = lastAcceptedHundredths?.let(::Coefficient),
    lastObservedValue = lastObservedHundredths?.let(::Coefficient),
    lastEventAtMs = lastEventAtMs,
)

fun EventRecord.toEntity(newAlgorithmName: String?): EventEntity = EventEntity(
    timestampMs = timestampMs,
    roundId = roundId,
    sequence = sequence,
    coefficientHundredths = coefficientHundredths,
    coefficientText = coefficient.toString(),
    ocrConfidence = ocrConfidence,
    ocrValidation = ocrValidation,
    previousAlgorithm = previousAlgorithm,
    newAlgorithm = newAlgorithm,
    newAlgorithmName = newAlgorithmName,
    thresholdHundredths = thresholdHundredths,
    transitionType = transitionType.name,
    transitionReason = transitionReason.name,
    detectionReason = detectionReason.name,
    continuity = continuity.name,
    processingStatus = processingStatus.name,
    error = error,
)

fun EventEntity.toRecord(): EventRecord = EventRecord(
    timestampMs = timestampMs,
    roundId = roundId,
    sequence = sequence,
    coefficientHundredths = coefficientHundredths,
    ocrConfidence = ocrConfidence,
    ocrValidation = ocrValidation,
    previousAlgorithm = previousAlgorithm,
    newAlgorithm = newAlgorithm,
    thresholdHundredths = thresholdHundredths,
    transitionType = enumOrDefault(transitionType, TransitionType.NO_POSITION_CHANGE),
    transitionReason = enumOrDefault(transitionReason, TransitionReason.NO_ALGORITHMS),
    detectionReason = enumOrDefault(detectionReason, DetectionReason.VALUE_CHANGED),
    continuity = enumOrDefault(continuity, Continuity.UNKNOWN),
    processingStatus = enumOrDefault(processingStatus, ProcessingStatus.APPLIED),
    error = error,
)
