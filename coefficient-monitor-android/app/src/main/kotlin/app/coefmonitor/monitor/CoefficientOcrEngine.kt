package app.coefmonitor.monitor

import android.graphics.Bitmap
import app.coefmonitor.core.CoefficientParser
import app.coefmonitor.core.OcrReading
import app.coefmonitor.core.TextBox
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.tasks.await
import java.io.Closeable

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
     * Every word on [image] with its box, shifted down by [offsetY] (when [image] is a strip of
     * the frame) so boxes are in frame pixels. Confidence is the word's line confidence.
     */
    suspend fun readWords(image: Bitmap, offsetY: Int = 0): List<TextBox> {
        val text = recognizer.process(InputImage.fromBitmap(image, 0)).await()
        return text.textBlocks.flatMap { it.lines }.flatMap { line ->
            line.elements.mapNotNull { element ->
                element.boundingBox?.let { box ->
                    TextBox(element.text.trim(), box.left, box.top + offsetY, box.right, box.bottom + offsetY, line.confidence)
                }
            }
        }
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
