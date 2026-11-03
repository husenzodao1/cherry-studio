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
import app.coefmonitor.core.BalanceControl
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.DelayPolicy
import app.coefmonitor.core.DetectorConfig
import app.coefmonitor.core.GameLink
import app.coefmonitor.core.GuardedConfig
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
    /** The same algorithm again (its amount still set): tap only its last click, the stake button. */
    val stakeButtonOnly: Boolean = true,
    val activePresetId: Long? = null,
    /** Guarded start ("Оғози монеадор"); null while it is off. */
    val guarded: GuardedConfig? = null,
    /** Balance management ("Идораи баланс"): internet speed and balance checks; null while it is off. */
    val balanceControl: BalanceControl? = null,
    /** The link "To the game" opens; null until one is saved. */
    val gameUrl: String? = null,
) {
    /** The guarded start as it runs: with the balance check of [balanceControl], if any. */
    val effectiveGuarded: GuardedConfig? get() = guarded?.copy(balance = balanceControl?.balance)

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
        val STAKE_BUTTON_ONLY = booleanPreferencesKey("stake_button_only")
        val ACTIVE_PRESET = longPreferencesKey("active_preset_id")
        val GUARDED = stringPreferencesKey("guarded_json")
        val BALANCE_CONTROL = stringPreferencesKey("balance_control_json")
        val GAME_URL = stringPreferencesKey("game_url")
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
            stakeButtonOnly = this[Keys.STAKE_BUTTON_ONLY] ?: defaults.stakeButtonOnly,
            activePresetId = this[Keys.ACTIVE_PRESET],
            guarded = this[Keys.GUARDED]?.let { json ->
                runCatching { StorageJson.decodeFromString(GuardedConfig.serializer(), json) }.getOrNull()?.takeIf { it.problem() == null }
                    // The balance belongs to the balance management now.
                    ?.copy(balance = null)
            },
            gameUrl = (this[Keys.GAME_URL]?.let(GameLink::parse) as? GameLink.Parsed.Valid)?.url,
            balanceControl = this[Keys.BALANCE_CONTROL]?.let { json ->
                runCatching { StorageJson.decodeFromString(BalanceControl.serializer(), json) }.getOrNull()?.takeIf { it.problem() == null }
            },
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
        this[Keys.STAKE_BUTTON_ONLY] = settings.stakeButtonOnly
        val presetId = settings.activePresetId
        if (presetId == null) remove(Keys.ACTIVE_PRESET) else this[Keys.ACTIVE_PRESET] = presetId
        val guarded = settings.guarded
        if (guarded == null) remove(Keys.GUARDED) else this[Keys.GUARDED] = StorageJson.encodeToString(GuardedConfig.serializer(), guarded)
        val gameUrl = settings.gameUrl
        if (gameUrl == null) remove(Keys.GAME_URL) else this[Keys.GAME_URL] = gameUrl
        val control = settings.balanceControl
        if (control == null) {
            remove(Keys.BALANCE_CONTROL)
        } else {
            this[Keys.BALANCE_CONTROL] = StorageJson.encodeToString(BalanceControl.serializer(), control)
        }
    }
}
