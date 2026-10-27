package app.coefmonitor.core

import kotlin.math.sqrt

/**
 * A tiny, brightness/contrast-normalised grayscale thumbnail of a tile.
 *
 * The round detector uses it for "did the picture change?" questions (motion, tile shift)
 * without running OCR on every frame. Similarity is normalised cross-correlation, so a tile
 * that only fades or dims keeps a high score, while different digits score lower.
 */
class ImageSignature private constructor(
    private val values: FloatArray,
    /** True when the crop is essentially one colour (blank screen, covered region). */
    val isFlat: Boolean,
) {

    /** 1.0 = identical pattern; values near 0 = unrelated. */
    fun similarity(other: ImageSignature): Float {
        if (isFlat || other.isFlat) return if (isFlat && other.isFlat) 1f else 0f
        if (values.size != other.values.size) return 0f
        var sum = 0.0
        for (i in values.indices) sum += values[i] * other.values[i]
        return (sum / values.size).toFloat().coerceIn(-1f, 1f)
    }

    companion object {
        const val WIDTH = 48
        const val HEIGHT = 16

        /** Below this standard deviation (in 0..255 luminance units) the crop counts as blank. */
        private const val FLAT_STD_DEV = 2.0

        /** Builds a signature from packed ARGB pixels (Android Bitmap.getPixels layout). */
        fun fromArgb(pixels: IntArray, width: Int, height: Int): ImageSignature {
            require(width > 0 && height > 0 && pixels.size >= width * height) { "Invalid pixel buffer" }
            val luminance = FloatArray(width * height) { i ->
                val p = pixels[i]
                val r = (p shr 16) and 0xFF
                val g = (p shr 8) and 0xFF
                val b = p and 0xFF
                0.299f * r + 0.587f * g + 0.114f * b
            }
            return fromLuminance(luminance, width, height)
        }

        fun fromLuminance(luminance: FloatArray, width: Int, height: Int): ImageSignature {
            require(width > 0 && height > 0 && luminance.size >= width * height) { "Invalid luminance buffer" }
            val cells = FloatArray(WIDTH * HEIGHT)
            for (cy in 0 until HEIGHT) {
                val y0 = cy * height / HEIGHT
                val y1 = maxOf(y0 + 1, (cy + 1) * height / HEIGHT)
                for (cx in 0 until WIDTH) {
                    val x0 = cx * width / WIDTH
                    val x1 = maxOf(x0 + 1, (cx + 1) * width / WIDTH)
                    var sum = 0f
                    for (y in y0 until minOf(y1, height)) {
                        val row = y * width
                        for (x in x0 until minOf(x1, width)) sum += luminance[row + x]
                    }
                    cells[cy * WIDTH + cx] = sum / ((minOf(y1, height) - y0) * (minOf(x1, width) - x0))
                }
            }
            val mean = cells.average()
            var variance = 0.0
            for (v in cells) variance += (v - mean) * (v - mean)
            val std = sqrt(variance / cells.size)
            if (std < FLAT_STD_DEV) return ImageSignature(FloatArray(cells.size), isFlat = true)
            val normalized = FloatArray(cells.size) { ((cells[it] - mean) / std).toFloat() }
            return ImageSignature(normalized, isFlat = false)
        }
    }
}
