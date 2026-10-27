package app.coefmonitor.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Test I — calibration geometry, based on the 968x191 reference screenshot of the tile row. */
class ObservationRegionTest {

    // Reference screenshot: "?" tile spans x 42..205, first result tile 222..385, y 64..110.
    private val refW = 968
    private val refH = 191
    private val calibration = ObservationCalibration(
        tile = NormalizedRect(222f / refW, 64f / refH, 385f / refW, 110f / refH),
        placeholder = NormalizedPoint(123f / refW, 100f / refH),
        referenceWidth = refW,
        referenceHeight = refH,
    )

    @Test
    fun `valid calibration resolves to the tile right of the placeholder`() {
        assertNull(ObservationRegionManager.validate(calibration))
        val ready = ObservationRegionManager.resolve(calibration, refW, refH) as RegionResolution.Ready
        assertEquals(PixelRect(222, 64, 163, 46), ready.primary)
        // Neighbour = one tile pitch (placeholder centre → tile centre) to the right: the 1.53x tile.
        val neighbor = ready.neighbor!!
        assertTrue(neighbor.left in 395..410)
        assertEquals(ready.primary.width, neighbor.width)
    }

    @Test
    fun `normalised coordinates scale with resolution`() {
        val ready = ObservationRegionManager.resolve(calibration, refW * 2, refH * 2) as RegionResolution.Ready
        assertEquals(PixelRect(444, 128, 326, 92), ready.primary)
    }

    @Test
    fun `orientation or aspect ratio change requires recalibration`() {
        val rotated = ObservationRegionManager.resolve(calibration, refH, refW)
        assertEquals(RegionResolution.Invalid(CalibrationProblem.GEOMETRY_CHANGED), rotated)
        val resized = ObservationRegionManager.resolve(calibration, refW, refH + 40)
        assertEquals(RegionResolution.Invalid(CalibrationProblem.GEOMETRY_CHANGED), resized)
    }

    @Test
    fun `small aspect differences within tolerance are accepted`() {
        assertTrue(ObservationRegionManager.resolve(calibration, refW, refH + 2) is RegionResolution.Ready)
    }

    @Test
    fun `missing or invalid calibrations are reported, never guessed`() {
        assertEquals(RegionResolution.Invalid(CalibrationProblem.NOT_CALIBRATED), ObservationRegionManager.resolve(null, 1080, 2400))
        val outside = calibration.copy(tile = NormalizedRect(0.9f, 0.1f, 1.2f, 0.3f))
        assertEquals(CalibrationProblem.OUT_OF_BOUNDS, ObservationRegionManager.validate(outside))
        val inverted = calibration.copy(tile = NormalizedRect(0.5f, 0.5f, 0.4f, 0.6f))
        assertEquals(CalibrationProblem.OUT_OF_BOUNDS, ObservationRegionManager.validate(inverted))
        val tiny = calibration.copy(tile = NormalizedRect(0.5f, 0.5f, 0.505f, 0.6f))
        assertEquals(CalibrationProblem.TOO_SMALL, ObservationRegionManager.validate(tiny))
        val markerRight = calibration.copy(placeholder = NormalizedPoint(0.9f, 0.45f))
        assertEquals(CalibrationProblem.PLACEHOLDER_NOT_LEFT_OF_TILE, ObservationRegionManager.validate(markerRight))
        val markerOtherRow = calibration.copy(placeholder = NormalizedPoint(0.1f, 0.95f))
        assertEquals(CalibrationProblem.PLACEHOLDER_NOT_ON_TILE_ROW, ObservationRegionManager.validate(markerOtherRow))
        val noImage = calibration.copy(referenceWidth = 0)
        assertEquals(CalibrationProblem.INVALID_IMAGE, ObservationRegionManager.validate(noImage))
    }

    @Test
    fun `tile too small for OCR on a low resolution capture is rejected`() {
        assertEquals(
            RegionResolution.Invalid(CalibrationProblem.TOO_SMALL),
            ObservationRegionManager.resolve(calibration, 121, 24),
        )
    }

    @Test
    fun `neighbour is omitted when it would leave the image`() {
        val nearEdge = ObservationCalibration(
            tile = NormalizedRect(0.80f, 0.3f, 0.97f, 0.6f),
            placeholder = NormalizedPoint(0.70f, 0.45f),
            referenceWidth = refW,
            referenceHeight = refH,
        )
        val ready = ObservationRegionManager.resolve(nearEdge, refW, refH) as RegionResolution.Ready
        assertNull(ready.neighbor)
    }
}
