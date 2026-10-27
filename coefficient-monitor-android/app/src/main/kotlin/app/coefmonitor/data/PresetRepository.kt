package app.coefmonitor.data

import androidx.room.withTransaction
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.ExportFormats
import app.coefmonitor.core.ImportResult
import app.coefmonitor.core.PresetPayload
import app.coefmonitor.data.db.AppDatabase
import app.coefmonitor.data.db.PresetEntity
import kotlinx.coroutines.flow.Flow

/**
 * Named snapshots of settings (and optionally the algorithm list). Loading a preset never
 * touches the round de-duplication state, so it cannot cause a round to be processed twice.
 */
class PresetRepository(
    private val db: AppDatabase,
    private val settings: SettingsRepository,
    private val algorithms: AlgorithmRepository,
) {
    private val dao = db.presetDao()

    val presets: Flow<List<PresetEntity>> = dao.observeAll()

    suspend fun findByName(name: String): PresetEntity? = dao.getByName(name.trim())

    /** Saves current settings under [name], replacing a preset with the same name. */
    suspend fun saveCurrent(name: String, includeAlgorithms: Boolean): Long {
        val current = settings.current()
        val payload = PresetPayload(
            thresholdHundredths = current.threshold.hundredths,
            detector = current.detector,
            captureIntervalMs = current.captureIntervalMs,
            globalDelayMs = current.globalDelayMs,
            calibration = current.calibration,
            algorithms = if (includeAlgorithms) algorithms.allDefinitions() else null,
        )
        return store(name.trim(), payload)
    }

    suspend fun load(id: Long): Boolean {
        val entity = dao.getById(id) ?: return false
        val parsed = ExportFormats.presetFromJson(entity.payloadJson) as? ImportResult.Success ?: return false
        val payload = parsed.value.second
        payload.algorithms?.let { algorithms.replaceAll(it) }
        settings.update {
            it.copy(
                threshold = Coefficient(payload.thresholdHundredths),
                detector = payload.detector,
                captureIntervalMs = payload.captureIntervalMs.coerceIn(
                    AppSettings.MIN_CAPTURE_INTERVAL_MS,
                    AppSettings.MAX_CAPTURE_INTERVAL_MS,
                ),
                globalDelayMs = payload.globalDelayMs,
                calibration = payload.calibration ?: it.calibration,
                activePresetId = id,
            )
        }
        return true
    }

    suspend fun delete(id: Long) {
        dao.delete(id)
        settings.update { if (it.activePresetId == id) it.copy(activePresetId = null) else it }
    }

    suspend fun exportJson(id: Long): String? = dao.getById(id)?.payloadJson

    suspend fun import(json: String): ImportResult<Long> =
        when (val parsed = ExportFormats.presetFromJson(json)) {
            is ImportResult.Failure -> parsed
            is ImportResult.Success -> ImportResult.Success(store(parsed.value.first.trim().ifEmpty { "Preset" }, parsed.value.second))
        }

    private suspend fun store(name: String, payload: PresetPayload): Long = db.withTransaction {
        val json = ExportFormats.presetToJson(name, payload)
        val now = System.currentTimeMillis()
        val existing = dao.getByName(name)
        if (existing != null) {
            dao.update(existing.copy(payloadJson = json, includesAlgorithms = payload.algorithms != null, updatedAtMs = now))
            existing.id
        } else {
            dao.insert(PresetEntity(name = name, payloadJson = json, includesAlgorithms = payload.algorithms != null, updatedAtMs = now))
        }
    }
}
