package app.coefmonitor.ui

import android.Manifest
import android.app.Activity
import android.app.AppOpsManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Process
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
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
fun rememberCaptureStarter(onStarted: () -> Unit = {}): () -> Unit {
    val context = LocalContext.current
    val started by rememberUpdatedState(onStarted)

    val consent = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val data = result.data
        if (result.resultCode == Activity.RESULT_OK && data != null) {
            MonitoringService.start(context, result.resultCode, data)
            started()
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

/**
 * Whether Android grants screen capture to this app without its dialog. Only a one-time command
 * from a computer does that ([screenCaptureCommand]); Android itself asks before every session.
 */
fun screenCaptureAllowedWithoutAsking(context: Context): Boolean = runCatching {
    val appOps = context.getSystemService(AppOpsManager::class.java)
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        appOps.unsafeCheckOpNoThrow(OP_PROJECT_MEDIA, Process.myUid(), context.packageName)
    } else {
        @Suppress("DEPRECATION")
        appOps.checkOpNoThrow(OP_PROJECT_MEDIA, Process.myUid(), context.packageName)
    }
    mode == AppOpsManager.MODE_ALLOWED
}.getOrDefault(false)

/** The command (USB or wireless debugging) after which Android no longer asks before screen capture. */
fun screenCaptureCommand(context: Context): String = "adb shell appops set ${context.packageName} PROJECT_MEDIA allow"

private const val OP_PROJECT_MEDIA = "android:project_media"

/** Opens [url] in the app that handles it (the game's app, or the browser); false if none can. */
fun openLink(context: Context, url: String): Boolean = try {
    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    true
} catch (e: ActivityNotFoundException) {
    false
}

fun overlaySettingsIntent(context: Context): Intent =
    Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))

/** System Accessibility settings, where the user turns the auto-clicker service on. */
fun accessibilitySettingsIntent(): Intent = Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS)

fun appNotificationSettingsIntent(context: Context): Intent =
    Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
        .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, context.packageName)
