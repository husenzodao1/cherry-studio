package app.coefmonitor.monitor

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import java.io.File

/** Holds the screenshot used for calibration (captured via MediaProjection or picked by the user). */
class CalibrationImageStore(private val context: Context) {
    private val file: File get() = File(File(context.filesDir, "calibration"), "screen.png")

    private val mutableVersion = MutableStateFlow(if (file.exists()) file.lastModified() else 0L)

    /** Changes whenever a new screenshot is stored; 0 when there is none. */
    val version: StateFlow<Long> = mutableVersion.asStateFlow()

    suspend fun save(bitmap: Bitmap) = withContext(Dispatchers.IO) {
        file.parentFile?.mkdirs()
        val tmp = File(file.parentFile, "screen.tmp")
        tmp.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        if (!tmp.renameTo(file)) {
            tmp.copyTo(file, overwrite = true)
            tmp.delete()
        }
        mutableVersion.value = file.lastModified().coerceAtLeast(mutableVersion.value + 1)
    }

    /** Copies a user-picked image; returns false if it is not a decodable image. */
    suspend fun importFrom(uri: Uri): Boolean = withContext(Dispatchers.IO) {
        val bitmap = runCatching {
            context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it) }
        }.getOrNull() ?: return@withContext false
        save(bitmap)
        bitmap.recycle()
        true
    }

    /** Decodes the stored screenshot at full resolution (normalised coordinates need the true size). */
    suspend fun load(): Bitmap? = withContext(Dispatchers.IO) {
        if (!file.exists()) return@withContext null
        runCatching { BitmapFactory.decodeFile(file.absolutePath) }.getOrNull()
    }
}
