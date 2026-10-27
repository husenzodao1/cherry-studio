package app.coefmonitor.monitor

import android.graphics.Bitmap
import android.graphics.Rect
import app.coefmonitor.core.CoefficientParser
import app.coefmonitor.core.NormalizedPoint
import app.coefmonitor.core.NormalizedRect
import app.coefmonitor.core.OcrReading
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.tasks.await
import java.io.Closeable
import kotlin.math.abs

/** Suggested calibration from [CoefficientOcrEngine.detectLayout]. */
data class DetectedLayout(
    val placeholder: NormalizedPoint,
    val tile: NormalizedRect,
    /** True when "?" was not recognised and its position was estimated. */
    val placeholderGuessed: Boolean,
)

/**
 * On-device OCR (ML Kit bundled Latin model: no network, no download at runtime).
 * Only recognises text; validation is done by [CoefficientParser].
 */
class CoefficientOcrEngine : Closeable {
    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    suspend fun read(crop: Bitmap): OcrReading {
        val input = upscaleIfSmall(crop)
        val text = recognizer.process(InputImage.fromBitmap(input, 0)).await()
        if (input !== crop) input.recycle()
        val lines = text.textBlocks.flatMap { it.lines }
        val raw = lines.joinToString(" ") { it.text }
        // Weakest line decides; ML Kit reports confidence per line in [0, 1].
        val confidence = lines.map { it.confidence }.minOrNull()
        return CoefficientParser.parse(raw, confidence)
    }

    /**
     * Calibration helper: finds a "?" with a coefficient immediately to its right on a full
     * screenshot. If no "?" is recognised, falls back to the leftmost coefficient of the longest
     * row of coefficients and guesses "?" one tile to its left. The user always reviews the result.
     */
    suspend fun detectLayout(screen: Bitmap): DetectedLayout? {
        val text = recognizer.process(InputImage.fromBitmap(screen, 0)).await()
        val elements = text.textBlocks.flatMap { it.lines }.flatMap { it.elements }
            .mapNotNull { element -> element.boundingBox?.let { element.text.trim() to it } }
        val coefficients = elements.filter { (value, _) -> CoefficientParser.parse(value) is OcrReading.Valid }.map { it.second }
        // "?" is sometimes read together with the pointer under it (e.g. "?^"), so allow one extra symbol.
        val marks = elements.filter { (value, _) -> value.startsWith("?") && value.length <= 2 }.map { it.second }
        for (mark in marks.sortedBy { it.top }) {
            val next = coefficients
                .filter { it.left > mark.right && it.centerY() in mark.top..mark.bottom }
                .minByOrNull { it.left } ?: continue
            return layout(mark.exactCenterX(), mark.exactCenterY(), next, screen.width, screen.height, guessed = false)
        }
        val row = coefficients
            .map { anchor -> coefficients.filter { abs(it.centerY() - anchor.centerY()) <= anchor.height() / 2 }.sortedBy { it.left } }
            .filter { it.size >= 2 }
            .maxByOrNull { it.size } ?: return null
        val pitch = row[1].exactCenterX() - row[0].exactCenterX()
        return layout(row[0].exactCenterX() - pitch, row[0].exactCenterY(), row[0], screen.width, screen.height, guessed = true)
    }

    private fun layout(markX: Float, markY: Float, tile: Rect, width: Int, height: Int, guessed: Boolean): DetectedLayout {
        val pitch = tile.exactCenterX() - markX
        // Cover ~90% of one tile pitch so wider values (e.g. 123.45x) still fit inside the region.
        val halfWidth = maxOf(pitch * 0.45f, tile.width() * 0.75f)
        val halfHeight = tile.height() * 1.1f
        val cx = tile.exactCenterX()
        val cy = tile.exactCenterY()
        return DetectedLayout(
            placeholder = NormalizedPoint((markX / width).coerceIn(0f, 1f), (markY / height).coerceIn(0f, 1f)),
            tile = NormalizedRect(
                ((cx - halfWidth) / width).coerceIn(0f, 1f),
                ((cy - halfHeight) / height).coerceIn(0f, 1f),
                ((cx + halfWidth) / width).coerceIn(0f, 1f),
                ((cy + halfHeight) / height).coerceIn(0f, 1f),
            ),
            placeholderGuessed = guessed,
        )
    }

    override fun close() = recognizer.close()

    /** ML Kit needs characters roughly 16+ px tall; tiles on small screens are upscaled. */
    private fun upscaleIfSmall(bitmap: Bitmap): Bitmap {
        if (bitmap.height >= MIN_HEIGHT_PX) return bitmap
        val factor = (MIN_HEIGHT_PX + bitmap.height - 1) / bitmap.height
        return Bitmap.createScaledBitmap(bitmap, bitmap.width * factor, bitmap.height * factor, true)
    }

    private companion object {
        const val MIN_HEIGHT_PX = 64
    }
}
