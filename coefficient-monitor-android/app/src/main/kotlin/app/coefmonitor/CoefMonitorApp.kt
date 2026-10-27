package app.coefmonitor

import android.app.Application
import android.content.Context
import android.content.res.Configuration
import android.os.LocaleList
import androidx.appcompat.app.AppCompatDelegate
import app.coefmonitor.data.AlgorithmRepository
import app.coefmonitor.data.EventRepository
import app.coefmonitor.data.MonitorRepository
import app.coefmonitor.data.PresetRepository
import app.coefmonitor.data.SettingsRepository
import app.coefmonitor.data.db.AppDatabase
import app.coefmonitor.data.settingsDataStore
import app.coefmonitor.monitor.AutoClicker
import app.coefmonitor.monitor.MonitorRuntime
import app.coefmonitor.monitor.ScreenImageStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

class CoefMonitorApp : Application() {
    val container: AppContainer by lazy { AppContainer(this) }
}

/** Manual dependency wiring; everything is created lazily on first use. */
class AppContainer(context: Context) {
    private val appContext = context.applicationContext

    val database: AppDatabase by lazy { AppDatabase.build(appContext) }
    val settings: SettingsRepository by lazy { SettingsRepository(appContext.settingsDataStore) }
    val events: EventRepository by lazy { EventRepository(database) }
    val algorithms: AlgorithmRepository by lazy { AlgorithmRepository(database) }
    val monitor: MonitorRepository by lazy { MonitorRepository(database, events) }
    val presets: PresetRepository by lazy { PresetRepository(database, settings, algorithms) }
    val screenImages: ScreenImageStore by lazy { ScreenImageStore(appContext) }
    val runtime = MonitorRuntime()

    /** Lives as long as the process; used by work that outlives a single service, like the auto-clicker. */
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    val autoClicker: AutoClicker by lazy { AutoClicker(this, appScope) }
}

val Context.appContainer: AppContainer get() = (applicationContext as CoefMonitorApp).container

/**
 * Services and notifications do not get the per-app language automatically before Android 13,
 * so they resolve strings through this context.
 */
fun Context.withAppLocale(): Context {
    val locales = AppCompatDelegate.getApplicationLocales()
    if (locales.isEmpty) return this
    val config = Configuration(resources.configuration)
    config.setLocales(LocaleList.forLanguageTags(locales.toLanguageTags()))
    return createConfigurationContext(config)
}
