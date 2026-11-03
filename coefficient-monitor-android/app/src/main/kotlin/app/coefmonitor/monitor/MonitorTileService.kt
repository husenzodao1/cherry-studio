package app.coefmonitor.monitor

import android.app.PendingIntent
import android.app.StatusBarManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Build
import android.provider.Settings
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import androidx.annotation.RequiresApi
import app.coefmonitor.R
import app.coefmonitor.appContainer
import app.coefmonitor.ui.CaptureConsentActivity
import app.coefmonitor.ui.Labels
import app.coefmonitor.ui.MainActivity
import app.coefmonitor.withAppLocale
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/**
 * The app's tile in the phone's quick settings (the top panel). Tap: monitoring starts with the
 * floating window, like the dashboard's Start but without opening the game; tap again: it stops.
 * Lit while a monitoring session runs; the subtitle is the status.
 */
class MonitorTileService : TileService() {
    private var watching: Job? = null

    override fun onStartListening() {
        watching?.cancel()
        watching = appContainer.appScope.launch { appContainer.runtime.state.collect(::show) }
    }

    override fun onStopListening() {
        watching?.cancel()
        watching = null
    }

    override fun onClick() {
        if (appContainer.runtime.state.value.captureActive) {
            MonitoringService.command(this, MonitoringService.ACTION_STOP)
        } else if (isLocked) {
            unlockAndRun(::start)
        } else {
            start()
        }
    }

    /** Without "display over other apps" there is no floating window: the app opens and shows how to allow it. */
    private fun start() {
        val intent = if (Settings.canDrawOverlays(this)) {
            CaptureConsentActivity.withFloatingWindow(this)
        } else {
            Intent(this, MainActivity::class.java)
        }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startActivityAndCollapse(PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(intent)
        }
    }

    private fun show(state: RuntimeState) {
        val tile = qsTile ?: return
        tile.state = if (state.captureActive) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) tile.subtitle = Labels.status(withAppLocale(), state.status)
        tile.updateTile()
    }

    companion object {
        /** Asks Android to put the tile in the top panel; [onAdded] runs once it is there (also if it already was). */
        @RequiresApi(Build.VERSION_CODES.TIRAMISU)
        fun requestAdd(context: Context, onAdded: () -> Unit) {
            context.getSystemService(StatusBarManager::class.java).requestAddTileService(
                ComponentName(context, MonitorTileService::class.java),
                context.getString(R.string.app_name),
                Icon.createWithResource(context, R.drawable.ic_tile),
                context.mainExecutor,
            ) { result ->
                if (result == StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_ADDED ||
                    result == StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_ALREADY_ADDED
                ) {
                    onAdded()
                }
            }
        }
    }
}
