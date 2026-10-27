package app.coefmonitor.monitor

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/** Holds the screen monitoring last found the coefficient row on; step points are picked on it in the app. */
class ScreenImageStore(private val context: Context) {
    private val file: File get() = File(File(context.filesDir, "calibration"), "screen.png")

    suspend fun save(bitmap: Bitmap) = withContext(Dispatchers.IO) {
        file.parentFile?.mkdirs()
        val tmp = File(file.parentFile, "screen.tmp")
        tmp.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        if (!tmp.renameTo(file)) {
            tmp.copyTo(file, overwrite = true)
            tmp.delete()
        }
    }

    /** Decodes the stored screenshot at full resolution (normalised coordinates need the true size). */
    suspend fun load(): Bitmap? = withContext(Dispatchers.IO) {
        if (!file.exists()) return@withContext null
        runCatching { BitmapFactory.decodeFile(file.absolutePath) }.getOrNull()
    }
}
