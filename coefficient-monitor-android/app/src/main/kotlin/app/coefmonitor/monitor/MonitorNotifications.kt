package app.coefmonitor.monitor

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import app.coefmonitor.R
import app.coefmonitor.ui.MainActivity
import app.coefmonitor.withAppLocale

class MonitorNotifications(private val context: Context) {

    private val manager = NotificationManagerCompat.from(context)
    private val strings: Context get() = context.withAppLocale()

    fun ensureChannels() {
        val nm = context.getSystemService(NotificationManager::class.java)
        val s = strings
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_MONITOR, s.getString(R.string.channel_monitor), NotificationManager.IMPORTANCE_LOW),
        )
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ALERTS, s.getString(R.string.channel_alerts), NotificationManager.IMPORTANCE_HIGH),
        )
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ROUNDS, s.getString(R.string.channel_rounds), NotificationManager.IMPORTANCE_DEFAULT),
        )
    }

    fun monitoring(title: String, text: String, paused: Boolean, controls: Boolean): Notification {
        val s = strings
        val builder = NotificationCompat.Builder(context, CHANNEL_MONITOR)
            .setSmallIcon(R.drawable.ic_stat_monitor)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(openApp(null))
        if (controls) {
            builder.addAction(
                0,
                s.getString(if (paused) R.string.action_resume else R.string.action_pause),
                serviceIntent(if (paused) MonitoringService.ACTION_RESUME else MonitoringService.ACTION_PAUSE, 1),
            )
            builder.addAction(0, s.getString(R.string.action_stop), serviceIntent(MonitoringService.ACTION_STOP, 2))
        }
        return builder.build()
    }

    fun updateMonitoring(notification: Notification) = post(ID_MONITOR, notification)

    fun alert(id: Int, title: String, text: String, target: String? = null) {
        post(
            id,
            NotificationCompat.Builder(context, CHANNEL_ALERTS)
                .setSmallIcon(R.drawable.ic_stat_monitor)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(NotificationCompat.BigTextStyle().bigText(text))
                .setAutoCancel(true)
                .setContentIntent(openApp(target))
                .build(),
        )
    }

    fun round(title: String, text: String) {
        post(
            ID_ROUND,
            NotificationCompat.Builder(context, CHANNEL_ROUNDS)
                .setSmallIcon(R.drawable.ic_stat_monitor)
                .setContentTitle(title)
                .setContentText(text)
                .setOnlyAlertOnce(false)
                .setAutoCancel(true)
                .setContentIntent(openApp(null))
                .build(),
        )
    }

    private fun post(id: Int, notification: Notification) {
        val allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        if (!allowed) return
        try {
            manager.notify(id, notification)
        } catch (e: SecurityException) {
            // Permission revoked between the check and the call; nothing else to do.
        }
    }

    private fun openApp(target: String?): PendingIntent {
        val intent = Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(MainActivity.EXTRA_OPEN, target)
        return PendingIntent.getActivity(
            context,
            target?.hashCode() ?: 0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }

    private fun serviceIntent(action: String, requestCode: Int): PendingIntent = PendingIntent.getService(
        context,
        requestCode,
        Intent(context, MonitoringService::class.java).setAction(action),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    companion object {
        const val CHANNEL_MONITOR = "monitoring"
        const val CHANNEL_ALERTS = "alerts"
        const val CHANNEL_ROUNDS = "rounds"
        const val ID_MONITOR = 1001
        const val ID_END_OF_SEQUENCE = 1002
        const val ID_CAPTURE_STOPPED = 1003
        const val ID_SNAPSHOT = 1004
        const val ID_ROUND = 1005
        const val ID_NO_ALGORITHMS = 1006
    }
}
