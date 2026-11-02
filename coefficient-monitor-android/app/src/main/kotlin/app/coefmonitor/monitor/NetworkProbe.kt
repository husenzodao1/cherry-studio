package app.coefmonitor.monitor

import android.os.SystemClock
import app.coefmonitor.core.kbpsOf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Measures the internet speed the way a live game feels it: downloads a small static file
 * (about 13 KB, served by Google's CDN) and divides its size by the whole request time, delay
 * included. The connection is kept alive between measurements, so each one is a single request.
 */
class NetworkProbe(private val url: URL = URL(PROBE_URL)) {

    /** Speed in kbit/s, or null if the request failed. A download that takes longer than [timeoutMs] is cut there. */
    suspend fun measureKbps(timeoutMs: Int): Int? = withContext(Dispatchers.IO) {
        val started = SystemClock.elapsedRealtime()
        val connection = try {
            url.openConnection() as HttpURLConnection
        } catch (e: IOException) {
            return@withContext null
        }
        try {
            connection.connectTimeout = timeoutMs
            connection.readTimeout = timeoutMs
            connection.useCaches = false
            connection.setRequestProperty("Cache-Control", "no-cache")
            if (connection.responseCode !in 200..299) {
                connection.disconnect()
                return@withContext null
            }
            var bytes = 0L
            connection.inputStream.use { input ->
                val buffer = ByteArray(BUFFER_BYTES)
                while (SystemClock.elapsedRealtime() - started < timeoutMs) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    bytes += read
                }
            }
            kbpsOf(bytes, SystemClock.elapsedRealtime() - started)
        } catch (e: IOException) {
            connection.disconnect()
            null
        }
    }

    companion object {
        const val PROBE_URL = "https://www.gstatic.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png"
        private const val BUFFER_BYTES = 8_192
    }
}
