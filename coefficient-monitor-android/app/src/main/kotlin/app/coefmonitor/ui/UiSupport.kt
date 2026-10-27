package app.coefmonitor.ui

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.CreationExtras
import app.coefmonitor.AppContainer
import app.coefmonitor.CoefMonitorApp
import app.coefmonitor.appContainer
import app.coefmonitor.monitor.MonitorError
import app.coefmonitor.monitor.MonitorStatus
import app.coefmonitor.monitor.MonitoringService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

fun CreationExtras.container(): AppContainer =
    (this[ViewModelProvider.AndroidViewModelFactory.APPLICATION_KEY] as CoefMonitorApp).container

fun formatDateTime(ms: Long, locale: Locale): String =
    DateTimeFormatter.ofLocalizedDateTime(FormatStyle.SHORT, FormatStyle.MEDIUM)
        .withLocale(locale)
        .format(Instant.ofEpochMilli(ms).atZone(ZoneId.systemDefault()))

suspend fun writeText(context: Context, uri: Uri, text: String): Boolean = withContext(Dispatchers.IO) {
    runCatching {
        context.contentResolver.openOutputStream(uri, "wt")?.use { it.write(text.toByteArray(Charsets.UTF_8)) } != null
    }.getOrDefault(false)
}

/** Reads a user-picked file, refusing anything larger than [maxChars] characters. */
suspend fun readText(context: Context, uri: Uri, maxChars: Int): String? = withContext(Dispatchers.IO) {
    runCatching {
        context.contentResolver.openInputStream(uri)?.use { stream ->
            val reader = stream.bufferedReader(Charsets.UTF_8)
            val buffer = CharArray(maxChars + 1)
            var total = 0
            while (total <= maxChars) {
                val n = reader.read(buffer, total, buffer.size - total)
                if (n < 0) break
                total += n
                if (total == buffer.size) break
            }
            if (total > maxChars) null else String(buffer, 0, total)
        }
    }.getOrNull()
}

fun hasNotificationPermission(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

/**
 * Returns a function that asks for screen-capture consent (and, once, notification permission)
 * and then starts [MonitoringService]. Every capture session needs new consent.
 */
@Composable
fun rememberCaptureStarter(): () -> Unit {
    val context = LocalContext.current

    val consent = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val data = result.data
        if (result.resultCode == Activity.RESULT_OK && data != null) {
            MonitoringService.start(context, result.resultCode, data)
        } else {
            context.appContainer.runtime.update { it.copy(status = MonitorStatus.ERROR, error = MonitorError.CAPTURE_DENIED) }
        }
    }

    fun launchConsent() {
        val manager = context.getSystemService(MediaProjectionManager::class.java)
        consent.launch(manager.createScreenCaptureIntent())
    }

    val notificationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        launchConsent()
    }

    return {
        if (!hasNotificationPermission(context) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            launchConsent()
        }
    }
}

fun overlaySettingsIntent(context: Context): Intent =
    Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))

/** System Accessibility settings, where the user turns the auto-clicker service on. */
fun accessibilitySettingsIntent(): Intent = Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS)

fun appNotificationSettingsIntent(context: Context): Intent =
    Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
        .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, context.packageName)
