package app.coefmonitor.core

import kotlinx.serialization.Serializable
import kotlin.math.abs
import kotlin.math.roundToInt

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

/**
 * What the user marked on a screenshot of the game:
 *  - [placeholder]: centre of the "?" tile (the round in progress);
 *  - [tile]: the first result tile immediately to the RIGHT of "?". This is the only place a
 *    new result appears; tiles further right are older history and are never read as new rounds.
 *
 * [referenceWidth]/[referenceHeight] record the screenshot size so a later capture with a
 * different aspect ratio (rotation, split screen) is detected instead of silently misreading.
 */
@Serializable
data class ObservationCalibration(
    val tile: NormalizedRect,
    val placeholder: NormalizedPoint,
    val referenceWidth: Int,
    val referenceHeight: Int,
)

data class PixelRect(val left: Int, val top: Int, val width: Int, val height: Int) {
    val right: Int get() = left + width
    val bottom: Int get() = top + height
}

enum class CalibrationProblem {
    NOT_CALIBRATED,
    OUT_OF_BOUNDS,
    TOO_SMALL,
    PLACEHOLDER_NOT_LEFT_OF_TILE,
    PLACEHOLDER_NOT_ON_TILE_ROW,
    GEOMETRY_CHANGED,
    INVALID_IMAGE,
}

sealed interface RegionResolution {
    /**
     * [neighbor] is the next-older tile (one tile pitch to the right). It is only used to
     * confirm that the row shifted; it is null when it would fall outside the image.
     */
    data class Ready(val primary: PixelRect, val neighbor: PixelRect?) : RegionResolution

    data class Invalid(val problem: CalibrationProblem) : RegionResolution
}

object ObservationRegionManager {
    /** Smallest tile crop that OCR can read reliably. */
    const val MIN_TILE_WIDTH_PX = 24
    const val MIN_TILE_HEIGHT_PX = 12

    /** Smallest tile size on the normalised calibration canvas (prevents accidental taps). */
    const val MIN_NORMALIZED_SIZE = 0.01f

    /** Relative aspect-ratio difference above which the screen geometry counts as changed. */
    const val ASPECT_TOLERANCE = 0.03f

    /** Geometry-independent checks, run when saving a calibration. */
    fun validate(calibration: ObservationCalibration): CalibrationProblem? {
        val tile = calibration.tile
        val point = calibration.placeholder
        if (calibration.referenceWidth <= 0 || calibration.referenceHeight <= 0) return CalibrationProblem.INVALID_IMAGE
        val inUnit = listOf(tile.left, tile.top, tile.right, tile.bottom, point.x, point.y).all { it in 0f..1f }
        if (!inUnit || tile.left >= tile.right || tile.top >= tile.bottom) return CalibrationProblem.OUT_OF_BOUNDS
        if (tile.width < MIN_NORMALIZED_SIZE || tile.height < MIN_NORMALIZED_SIZE) return CalibrationProblem.TOO_SMALL
        if (point.x >= tile.left) return CalibrationProblem.PLACEHOLDER_NOT_LEFT_OF_TILE
        if (point.y < tile.top || point.y > tile.bottom) return CalibrationProblem.PLACEHOLDER_NOT_ON_TILE_ROW
        return pixelSizeProblem(tile, calibration.referenceWidth, calibration.referenceHeight)
    }

    /** Converts a calibration to pixel rectangles for a captured frame of the given size. */
    fun resolve(calibration: ObservationCalibration?, imageWidth: Int, imageHeight: Int): RegionResolution {
        if (calibration == null) return RegionResolution.Invalid(CalibrationProblem.NOT_CALIBRATED)
        if (imageWidth <= 0 || imageHeight <= 0) return RegionResolution.Invalid(CalibrationProblem.INVALID_IMAGE)
        validate(calibration)?.let { return RegionResolution.Invalid(it) }

        val referenceAspect = calibration.referenceWidth.toFloat() / calibration.referenceHeight
        val currentAspect = imageWidth.toFloat() / imageHeight
        if (abs(currentAspect / referenceAspect - 1f) > ASPECT_TOLERANCE) {
            return RegionResolution.Invalid(CalibrationProblem.GEOMETRY_CHANGED)
        }
        pixelSizeProblem(calibration.tile, imageWidth, imageHeight)?.let { return RegionResolution.Invalid(it) }

        val primary = toPixels(calibration.tile, imageWidth, imageHeight)
        val pitch = ((calibration.tile.centerX - calibration.placeholder.x) * imageWidth).roundToInt()
        val neighbor = primary.copy(left = primary.left + pitch).takeIf { pitch > 0 && it.right <= imageWidth }
        return RegionResolution.Ready(primary, neighbor)
    }

    fun toPixels(rect: NormalizedRect, imageWidth: Int, imageHeight: Int): PixelRect {
        val left = (rect.left * imageWidth).roundToInt().coerceIn(0, imageWidth - 1)
        val top = (rect.top * imageHeight).roundToInt().coerceIn(0, imageHeight - 1)
        val right = (rect.right * imageWidth).roundToInt().coerceIn(left + 1, imageWidth)
        val bottom = (rect.bottom * imageHeight).roundToInt().coerceIn(top + 1, imageHeight)
        return PixelRect(left, top, right - left, bottom - top)
    }

    private fun pixelSizeProblem(tile: NormalizedRect, width: Int, height: Int): CalibrationProblem? {
        val px = toPixels(tile, width, height)
        return if (px.width < MIN_TILE_WIDTH_PX || px.height < MIN_TILE_HEIGHT_PX) CalibrationProblem.TOO_SMALL else null
    }
}
