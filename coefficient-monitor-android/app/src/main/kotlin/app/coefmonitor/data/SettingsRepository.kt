package app.coefmonitor.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.DelayPolicy
import app.coefmonitor.core.DetectorConfig
import app.coefmonitor.data.db.StorageJson
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.io.IOException

enum class ThemeMode { SYSTEM, LIGHT, DARK }

data class AppSettings(
    val threshold: Coefficient = Coefficient.DEFAULT_THRESHOLD,
    val detector: DetectorConfig = DetectorConfig(),
    val captureIntervalMs: Long = DEFAULT_CAPTURE_INTERVAL_MS,
    val globalDelayMs: Long = DelayPolicy.DEFAULT_GLOBAL_MS,
    val theme: ThemeMode = ThemeMode.SYSTEM,
    val logRejectedReadings: Boolean = true,
    val overlayEnabled: Boolean = false,
    val roundNotifications: Boolean = false,
    /** Tap the active algorithm's step points one by one after each round (needs the accessibility service). */
    val autoClickEnabled: Boolean = true,
    val activePresetId: Long? = null,
) {
    companion object {
        const val DEFAULT_CAPTURE_INTERVAL_MS = 300L
        const val MIN_CAPTURE_INTERVAL_MS = 100L
        const val MAX_CAPTURE_INTERVAL_MS = 2_000L
    }
}

val Context.settingsDataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

/** User preferences in DataStore. Malformed stored values fall back to defaults instead of crashing. */
class SettingsRepository(private val dataStore: DataStore<Preferences>) {

    private object Keys {
        val THRESHOLD = longPreferencesKey("threshold_hundredths")
        val DETECTOR = stringPreferencesKey("detector_json")
        val CAPTURE_INTERVAL = longPreferencesKey("capture_interval_ms")
        val GLOBAL_DELAY = longPreferencesKey("global_delay_ms")
        val THEME = stringPreferencesKey("theme")
        val LOG_REJECTED = booleanPreferencesKey("log_rejected")
        val OVERLAY = booleanPreferencesKey("overlay_enabled")
        val ROUND_NOTIFICATIONS = booleanPreferencesKey("round_notifications")
        val AUTO_CLICK = booleanPreferencesKey("auto_click")
        val ACTIVE_PRESET = longPreferencesKey("active_preset_id")
    }

    val settings: Flow<AppSettings> = dataStore.data
        .catch { error -> if (error is IOException) emit(emptyPreferences()) else throw error }
        .map { it.toSettings() }

    suspend fun current(): AppSettings = settings.first()

    suspend fun update(transform: (AppSettings) -> AppSettings) {
        dataStore.edit { prefs -> prefs.write(transform(prefs.toSettings())) }
    }

    private fun Preferences.toSettings(): AppSettings {
        val defaults = AppSettings()
        return AppSettings(
            threshold = this[Keys.THRESHOLD]?.let(::Coefficient)?.takeIf { Coefficient.isValidThreshold(it) } ?: defaults.threshold,
            detector = this[Keys.DETECTOR]?.let { json ->
                runCatching { StorageJson.decodeFromString(DetectorConfig.serializer(), json).sanitized() }.getOrNull()
            } ?: defaults.detector,
            captureIntervalMs = this[Keys.CAPTURE_INTERVAL]
                ?.coerceIn(AppSettings.MIN_CAPTURE_INTERVAL_MS, AppSettings.MAX_CAPTURE_INTERVAL_MS)
                ?: defaults.captureIntervalMs,
            globalDelayMs = this[Keys.GLOBAL_DELAY]?.takeIf(DelayPolicy::isValid) ?: defaults.globalDelayMs,
            theme = ThemeMode.entries.firstOrNull { it.name == this[Keys.THEME] } ?: defaults.theme,
            logRejectedReadings = this[Keys.LOG_REJECTED] ?: defaults.logRejectedReadings,
            overlayEnabled = this[Keys.OVERLAY] ?: defaults.overlayEnabled,
            roundNotifications = this[Keys.ROUND_NOTIFICATIONS] ?: defaults.roundNotifications,
            autoClickEnabled = this[Keys.AUTO_CLICK] ?: defaults.autoClickEnabled,
            activePresetId = this[Keys.ACTIVE_PRESET],
        )
    }

    private fun MutablePreferences.write(settings: AppSettings) {
        this[Keys.THRESHOLD] = settings.threshold.hundredths
        this[Keys.DETECTOR] = StorageJson.encodeToString(DetectorConfig.serializer(), settings.detector.sanitized())
        this[Keys.CAPTURE_INTERVAL] = settings.captureIntervalMs
        this[Keys.GLOBAL_DELAY] = settings.globalDelayMs
        this[Keys.THEME] = settings.theme.name
        this[Keys.LOG_REJECTED] = settings.logRejectedReadings
        this[Keys.OVERLAY] = settings.overlayEnabled
        this[Keys.ROUND_NOTIFICATIONS] = settings.roundNotifications
        this[Keys.AUTO_CLICK] = settings.autoClickEnabled
        val presetId = settings.activePresetId
        if (presetId == null) remove(Keys.ACTIVE_PRESET) else this[Keys.ACTIVE_PRESET] = presetId
    }
}
