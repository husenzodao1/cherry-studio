package app.coefmonitor.data.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/** One user-defined algorithm. [position] orders the list; the sequence uses enabled rows only. */
@Entity(tableName = "algorithms", indices = [Index("position")])
data class AlgorithmEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val position: Int,
    val name: String,
    val description: String,
    val enabled: Boolean,
    /** JSON list of AlgorithmStep. */
    val stepsJson: String,
)

/** Event log row. The unique sequence index is a database-level guard against double processing. */
@Entity(
    tableName = "events",
    indices = [Index(value = ["sequence"], unique = true), Index("timestampMs")],
)
data class EventEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val timestampMs: Long,
    val roundId: String,
    val sequence: Long,
    val coefficientHundredths: Long,
    /** Display form such as "1.70x", stored for searching. */
    val coefficientText: String,
    val ocrConfidence: Float?,
    val ocrValidation: String,
    val previousAlgorithm: Int,
    val newAlgorithm: Int,
    val newAlgorithmName: String?,
    val thresholdHundredths: Long,
    val transitionType: String,
    val transitionReason: String,
    val detectionReason: String,
    val continuity: String,
    val processingStatus: String,
    val error: String?,
)

/** Single row holding the sequence position and round de-duplication state. */
@Entity(tableName = "monitor_state")
data class MonitorStateEntity(
    @PrimaryKey val id: Int = SINGLETON_ID,
    val activeIndex: Int = 0,
    val lastSequence: Long = 0,
    val lastAcceptedHundredths: Long? = null,
    val lastObservedHundredths: Long? = null,
    val lastEventAtMs: Long? = null,
    val lastRoundId: String? = null,
    val lastTransitionType: String? = null,
    val lastTransitionReason: String? = null,
    val lastContinuity: String? = null,
    val updatedAtMs: Long = 0,
) {
    companion object {
        const val SINGLETON_ID = 0
    }
}

@Entity(tableName = "presets", indices = [Index(value = ["name"], unique = true)])
data class PresetEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    /** Full preset file JSON (same format as export). */
    val payloadJson: String,
    val includesAlgorithms: Boolean,
    val updatedAtMs: Long,
)

/** Troubleshooting log: rejected OCR readings, errors, manual actions. Trimmed to a fixed size. */
@Entity(tableName = "diagnostics", indices = [Index("timestampMs")])
data class DiagnosticEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val timestampMs: Long,
    val level: String,
    val category: String,
    val message: String,
)
