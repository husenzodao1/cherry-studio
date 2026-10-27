package app.coefmonitor.e2e

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Rect
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.DetectorConfig
import app.coefmonitor.core.ImageSignature
import app.coefmonitor.core.NormalizedPoint
import app.coefmonitor.core.NormalizedRect
import app.coefmonitor.core.ObservationCalibration
import app.coefmonitor.core.ObservationRegionManager
import app.coefmonitor.core.OcrReading
import app.coefmonitor.core.RegionResolution
import app.coefmonitor.e2e.TestEnv.log
import app.coefmonitor.monitor.CoefficientOcrEngine
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Real on-device ML Kit OCR against the user's screenshot of the result row
 * ("?" | 2.01x | 1.53x | 1.20x | 2.03x). Tile bounds were measured from the image.
 */
@RunWith(AndroidJUnit4::class)
class ReferenceScreenshotOcrTest {

    private val screenshot: Bitmap by lazy {
        InstrumentationRegistry.getInstrumentation().context.assets.open("reference_tiles.jpg").use(BitmapFactory::decodeStream)
    }

    private val tiles = listOf(
        Rect(42, 64, 205, 138), // "?"
        Rect(222, 64, 386, 138), // 2.01x (newest result, the observed tile)
        Rect(402, 64, 565, 138), // 1.53x
        Rect(582, 64, 745, 138), // 1.20x (fading)
        Rect(762, 64, 925, 138), // 2.03x (faded)
    )

    private fun crop(rect: Rect): Bitmap = Bitmap.createBitmap(screenshot, rect.left, rect.top, rect.width(), rect.height())

    @Test
    fun readsObservedTileAndNeighbour() = runBlocking {
        CoefficientOcrEngine().use { ocr ->
            val readings = tiles.map { ocr.read(crop(it)) }
            readings.forEachIndexed { i, reading -> log("reference tile $i -> $reading") }
            assertFalse("the \"?\" tile must never read as a coefficient", readings[0] is OcrReading.Valid)
            assertEquals(Coefficient(201), (readings[1] as OcrReading.Valid).value)
            assertEquals(Coefficient(153), (readings[2] as OcrReading.Valid).value)
            val confidence = (readings[1] as OcrReading.Valid).confidence
            log("confidence of 2.01x = $confidence (default minimum ${DetectorConfig().minConfidence})")
            assertTrue("confidence $confidence below default minimum", confidence == null || confidence >= DetectorConfig().minConfidence)
        }
    }

    @Test
    fun calibratedRegionReadsTheNewestValue() = runBlocking {
        val w = screenshot.width.toFloat()
        val h = screenshot.height.toFloat()
        val calibration = ObservationCalibration(
            tile = NormalizedRect(222 / w, 64 / h, 386 / w, 138 / h),
            placeholder = NormalizedPoint(123 / w, 100 / h),
            referenceWidth = screenshot.width,
            referenceHeight = screenshot.height,
        )
        val ready = ObservationRegionManager.resolve(calibration, screenshot.width, screenshot.height) as RegionResolution.Ready
        val neighbor = assertNotNullAndGet(ready.neighbor)
        log("observed=${ready.primary} neighbour=$neighbor")
        assertTrue("neighbour must be the 1.53x tile", neighbor.left in 395..410)
        CoefficientOcrEngine().use { ocr ->
            val primary = ocr.read(Bitmap.createBitmap(screenshot, ready.primary.left, ready.primary.top, ready.primary.width, ready.primary.height))
            val next = ocr.read(Bitmap.createBitmap(screenshot, neighbor.left, neighbor.top, neighbor.width, neighbor.height))
            assertEquals(Coefficient(201), (primary as OcrReading.Valid).value)
            assertEquals(Coefficient(153), (next as OcrReading.Valid).value)
        }
    }

    @Test
    fun autoDetectFindsTheTileRightOfPlaceholder() = runBlocking {
        val layout = CoefficientOcrEngine().use { it.detectLayout(screenshot) }
        assertNotNull("auto-detect found nothing", layout)
        layout!!
        log("auto-detect on reference: $layout")
        val w = screenshot.width
        val h = screenshot.height
        val centerX = layout.tile.centerX * w
        val centerY = layout.tile.centerY * h
        assertTrue("tile centre x=$centerX not on the 2.01x tile", centerX in 222f..386f)
        assertTrue("tile centre y=$centerY not on the row", centerY in 64f..138f)
        val markX = layout.placeholder.x * w
        assertTrue("\"?\" marker x=$markX not on the \"?\" tile", markX in 42f..205f)
        assertTrue(ObservationRegionManager.validate(ObservationCalibration(layout.tile, layout.placeholder, w, h)) == null)
    }

    @Test
    fun signaturesSeparateDifferentTiles() {
        val signatures = tiles.map { rect ->
            val bitmap = crop(rect)
            val pixels = IntArray(bitmap.width * bitmap.height)
            bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
            ImageSignature.fromArgb(pixels, bitmap.width, bitmap.height)
        }
        val same = DetectorConfig().sameTileSimilarity
        for (i in 1 until signatures.size) {
            for (j in i + 1 until signatures.size) {
                log("similarity tile$i vs tile$j = ${signatures[i].similarity(signatures[j])}")
            }
        }
        assertEquals(1f, signatures[1].similarity(signatures[1]), 0.0001f)
        assertTrue("2.01x and 1.53x must look different", signatures[1].similarity(signatures[2]) < same)
        assertTrue("1.53x and 1.20x must look different", signatures[2].similarity(signatures[3]) < same)
    }

    private fun <T> assertNotNullAndGet(value: T?): T {
        assertNotNull(value)
        return value!!
    }
}
