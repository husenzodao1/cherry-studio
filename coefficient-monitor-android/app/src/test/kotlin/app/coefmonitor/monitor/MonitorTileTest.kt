package app.coefmonitor.monitor

import android.app.Activity
import android.app.Application
import android.content.Intent
import android.os.Looper
import android.service.quicksettings.Tile
import androidx.test.core.app.ApplicationProvider
import app.coefmonitor.appContainer
import app.coefmonitor.ui.CaptureConsentActivity
import app.coefmonitor.ui.MainActivity
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowSettings

/** The quick settings tile. Android 13: Robolectric records the tile's activity start only up to that version. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class MonitorTileTest {
    private lateinit var app: Application

    @Before
    fun setUp() {
        app = ApplicationProvider.getApplicationContext()
        ShadowSettings.setCanDrawOverlays(true)
    }

    private fun idle() = shadowOf(Looper.getMainLooper()).idle()

    @Test
    fun `tap while stopped starts monitoring with the floating window and without the game link`() {
        runBlocking { app.appContainer.settings.update { it.copy(overlayEnabled = false, gameUrl = "https://example.com/game") } }
        Robolectric.setupService(MonitorTileService::class.java).onClick()

        val started = shadowOf(app).nextStartedActivity
        assertEquals(CaptureConsentActivity::class.java.name, started.component?.className)
        assertNull(shadowOf(app).nextStartedActivity) // the game link is not opened

        // Android's screen-capture consent comes back (or is skipped after the computer command).
        val activity = Robolectric.buildActivity(CaptureConsentActivity::class.java, started).setup().get()
        val consent = shadowOf(activity).nextStartedActivityForResult
        shadowOf(activity).receiveResult(consent.intent, Activity.RESULT_OK, Intent())
        val deadline = System.currentTimeMillis() + 5_000
        while (!activity.isFinishing && System.currentTimeMillis() < deadline) {
            idle()
            Thread.sleep(10)
        }

        assertTrue(activity.isFinishing)
        val monitoring = shadowOf(app).nextStartedService
        assertEquals(MonitoringService::class.java.name, monitoring.component?.className)
        assertEquals(MonitoringService.ACTION_START, monitoring.action)
        assertEquals(FloatingPanelService::class.java.name, shadowOf(app).nextStartedService.component?.className)
        assertTrue(runBlocking { app.appContainer.settings.current() }.overlayEnabled)
    }

    @Test
    fun `tap while monitoring stops it`() {
        app.appContainer.runtime.update { it.copy(status = MonitorStatus.MONITORING, captureActive = true) }
        Robolectric.setupService(MonitorTileService::class.java).onClick()

        assertEquals(MonitoringService.ACTION_STOP, shadowOf(app).nextStartedService.action)
        assertNull(shadowOf(app).nextStartedActivity)
    }

    @Test
    fun `without display over other apps the tile opens the app`() {
        ShadowSettings.setCanDrawOverlays(false)
        Robolectric.setupService(MonitorTileService::class.java).onClick()

        assertEquals(MainActivity::class.java.name, shadowOf(app).nextStartedActivity.component?.className)
    }

    @Test
    fun `the tile is lit while monitoring runs`() {
        val service = Robolectric.setupService(MonitorTileService::class.java)
        service.onStartListening()
        idle()
        assertEquals(Tile.STATE_INACTIVE, service.qsTile.state)
        assertEquals("Stopped", service.qsTile.subtitle)

        app.appContainer.runtime.update { it.copy(status = MonitorStatus.MONITORING, captureActive = true) }
        idle()
        assertEquals(Tile.STATE_ACTIVE, service.qsTile.state)
        assertEquals("Monitoring", service.qsTile.subtitle)

        service.onStopListening()
        app.appContainer.runtime.update { it.copy(status = MonitorStatus.STOPPED, captureActive = false) }
        idle()
        assertEquals(Tile.STATE_ACTIVE, service.qsTile.state) // not watched while the panel is closed
    }
}
