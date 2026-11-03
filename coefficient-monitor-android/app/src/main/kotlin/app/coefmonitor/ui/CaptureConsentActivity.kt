package app.coefmonitor.ui

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import app.coefmonitor.appContainer
import app.coefmonitor.monitor.FloatingPanelService
import app.coefmonitor.monitor.MonitorError
import app.coefmonitor.monitor.MonitorStatus
import app.coefmonitor.monitor.MonitoringService
import kotlinx.coroutines.launch

/**
 * Invisible activity behind the floating panel's Start button and the quick settings tile: shows
 * the system screen-capture consent dialog (only an activity can) and starts monitoring, then
 * closes, so the user stays in the app they were using.
 */
class CaptureConsentActivity : ComponentActivity() {

    private val consent = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        lifecycleScope.launch {
            val data = result.data
            if (result.resultCode == Activity.RESULT_OK && data != null) {
                MonitoringService.start(this@CaptureConsentActivity, result.resultCode, data)
                if (intent.getBooleanExtra(EXTRA_FLOATING_WINDOW, false)) {
                    appContainer.settings.update { it.copy(overlayEnabled = true) }
                    FloatingPanelService.sync(this@CaptureConsentActivity, enabled = true)
                }
            } else {
                appContainer.runtime.update { it.copy(status = MonitorStatus.ERROR, error = MonitorError.CAPTURE_DENIED) }
            }
            finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState == null) {
            consent.launch(getSystemService(MediaProjectionManager::class.java).createScreenCaptureIntent())
        }
    }

    companion object {
        private const val EXTRA_FLOATING_WINDOW = "app.coefmonitor.extra.FLOATING_WINDOW"

        /** Also turns floating mode on, as the dashboard's Start does. */
        fun withFloatingWindow(context: Context): Intent =
            Intent(context, CaptureConsentActivity::class.java).putExtra(EXTRA_FLOATING_WINDOW, true)
    }
}
