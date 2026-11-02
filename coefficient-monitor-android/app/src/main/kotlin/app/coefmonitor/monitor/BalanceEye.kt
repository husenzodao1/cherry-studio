package app.coefmonitor.monitor

import android.graphics.Bitmap
import android.os.SystemClock
import app.coefmonitor.core.BalanceCheck
import app.coefmonitor.core.BalanceLocator
import app.coefmonitor.core.BalanceParser
import app.coefmonitor.core.PixelRect
import app.coefmonitor.core.RowCells
import app.coefmonitor.core.TextBox
import kotlinx.coroutines.delay

/**
 * Reads the game balance from the screen.
 *
 * The balance is found among the words of a whole-screen read (the nearest amount above the result
 * row, see [BalanceLocator]); after that only a small crop around it is read, which is quick. If
 * the crop no longer shows an amount (the game scrolled), the whole screen is read once to find it
 * again.
 */
class BalanceEye(private val ocr: CoefficientOcrEngine) {

    /** Where the balance is, in frame pixels; null until it was found. */
    @Volatile
    var region: PixelRect? = null
        private set

    /** Remembers where the balance is on a screen whose words were read; returns its value, or null if it is not there. */
    fun locate(words: List<TextBox>, row: RowCells, frameWidth: Int, frameHeight: Int): Long? {
        val spot = BalanceLocator.locate(words, row, frameWidth, frameHeight) ?: return null
        region = spot.region
        return spot.value
    }

    /** One look at the balance; null if it cannot be read now. [row]: where the result row is, to find the balance again. */
    suspend fun read(capturer: ScreenCapturer, row: RowCells?): Long? {
        readCrop(capturer)?.let { return it }
        if (row == null) return null
        val screen = capturer.withLatestFrame { it.toBitmap() } ?: return null
        return try {
            locate(ocr.readWords(screen), row, screen.width, screen.height)
        } finally {
            screen.recycle()
        }
    }

    /**
     * Looks until the balance is [expected] (one look is enough), or until two looks in a row show
     * the same other amount, so a reading taken while the number changes is never trusted. Gives up
     * after [timeoutMs] with the last amount read, or null if none could be read.
     */
    suspend fun readSettled(capturer: ScreenCapturer, row: RowCells?, expected: Long?, timeoutMs: Long, intervalMs: Long): Long? {
        val deadline = SystemClock.elapsedRealtime() + timeoutMs
        var last: Long? = null
        while (true) {
            val value = read(capturer, row)
            if (value != null) {
                if (expected != null && BalanceCheck.matches(value, expected)) return value
                if (last != null && BalanceCheck.matches(value, last)) return value
                last = value
            }
            if (SystemClock.elapsedRealtime() >= deadline) return last
            delay(intervalMs)
        }
    }

    private suspend fun readCrop(capturer: ScreenCapturer): Long? {
        val rect = region ?: return null
        val pixels = capturer.withLatestFrame { frame ->
            if (rect.right <= frame.width && rect.bottom <= frame.height) frame.crop(rect) else null
        } ?: return null
        val crop = Bitmap.createBitmap(pixels, rect.width, rect.height, Bitmap.Config.ARGB_8888)
        return try {
            BalanceParser.parse(ocr.readText(crop))
        } finally {
            crop.recycle()
        }
    }
}
