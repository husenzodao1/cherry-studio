package app.coefmonitor.ui

import android.app.Activity
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import app.coefmonitor.appContainer
import app.coefmonitor.monitor.MonitorError
import app.coefmonitor.monitor.MonitorStatus
import app.coefmonitor.monitor.MonitoringService

/**
 * Invisible activity behind the floating panel's Start button: shows the system screen-capture
 * consent dialog (only an activity can) and starts monitoring, then closes, so the user stays in
 * the app they were using.
 */
class CaptureConsentActivity : ComponentActivity() {

    private val consent = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val data = result.data
        if (result.resultCode == Activity.RESULT_OK && data != null) {
            MonitoringService.start(this, result.resultCode, data)
        } else {
            appContainer.runtime.update { it.copy(status = MonitorStatus.ERROR, error = MonitorError.CAPTURE_DENIED) }
        }
        finish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState == null) {
            consent.launch(getSystemService(MediaProjectionManager::class.java).createScreenCaptureIntent())
        }
    }
}
