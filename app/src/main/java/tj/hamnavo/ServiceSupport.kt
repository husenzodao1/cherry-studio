package tj.hamnavo

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.wifi.WifiManager
import android.os.PowerManager

private const val CHANNEL_ID = "hamnavo"

fun Service.buildNotification(text: String, stopIntent: Intent): Notification {
    val nm = getSystemService(NotificationManager::class.java)
    nm.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, getString(R.string.notif_channel), NotificationManager.IMPORTANCE_LOW)
    )
    val open = PendingIntent.getActivity(
        this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE
    )
    val stop = PendingIntent.getService(
        this, 1, stopIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
    return Notification.Builder(this, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_notif)
        .setContentTitle(getString(R.string.app_name))
        .setContentText(text)
        .setContentIntent(open)
        .setOngoing(true)
        .addAction(Notification.Action.Builder(null, getString(R.string.btn_stop), stop).build())
        .build()
}

/** Partial wake lock + low-latency Wi-Fi lock so streaming continues with the screen off. */
class KeepAwake(context: Context, tag: String) {
    private val wake = context.getSystemService(PowerManager::class.java)
        .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "hamnavo:$tag").apply { setReferenceCounted(false) }
    private val wifi = context.applicationContext.getSystemService(WifiManager::class.java)
        .createWifiLock(WifiManager.WIFI_MODE_FULL_LOW_LATENCY, "hamnavo:$tag").apply { setReferenceCounted(false) }

    fun acquire() {
        wake.acquire()
        wifi.acquire()
    }

    fun release() {
        if (wake.isHeld) wake.release()
        if (wifi.isHeld) wifi.release()
    }
}
