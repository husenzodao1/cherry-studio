package app.coefmonitor.core

import kotlinx.serialization.Serializable

/** Rectangle in coordinates normalised to the captured image (0..1 on both axes). */
@Serializable
data class NormalizedRect(val left: Float, val top: Float, val right: Float, val bottom: Float) {
    val width: Float get() = right - left
    val height: Float get() = bottom - top
    val centerX: Float get() = (left + right) / 2f
    val centerY: Float get() = (top + bottom) / 2f
}

@Serializable
data class NormalizedPoint(val x: Float, val y: Float)

data class PixelRect(val left: Int, val top: Int, val width: Int, val height: Int) {
    val right: Int get() = left + width
    val bottom: Int get() = top + height
}
