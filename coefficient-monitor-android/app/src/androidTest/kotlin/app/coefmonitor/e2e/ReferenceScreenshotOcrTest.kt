package app.coefmonitor.e2e

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Rect
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.DetectorConfig
import app.coefmonitor.core.ImageSignature
import app.coefmonitor.core.OcrReading
import app.coefmonitor.core.RowCells
import app.coefmonitor.core.RowLocator
import app.coefmonitor.core.TextBox
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
 * Real on-device ML Kit OCR against the user's screenshots of the game: the result row alone
 * ("?" | 2.01x | 1.53x | 1.20x | 2.03x; tile bounds measured from the image), and the row with the
 * floating panel over the game, as the monitor sees it.
 */
@RunWith(AndroidJUnit4::class)
class ReferenceScreenshotOcrTest {

    private fun asset(name: String): Bitmap =
        InstrumentationRegistry.getInstrumentation().context.assets.open(name).use(BitmapFactory::decodeStream)

    private val screenshot: Bitmap by lazy { asset("reference_tiles.jpg") }

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

    /** Finds the row on [image] the way monitoring does: every word on the screen, then [RowLocator]. */
    private suspend fun locate(image: Bitmap): Pair<RowCells, List<TextBox>> {
        val words = CoefficientOcrEngine().use { it.readWords(image) }
        log("words: ${words.joinToString { "${it.text}@${it.left},${it.top}" }}")
        val cells = RowLocator.locate(words, image.width, image.height)
        assertNotNull("row not found", cells)
        log("row: $cells")
        return cells!! to words
    }

    @Test
    fun findsTheRowAndReadsTheNewestValueAndItsNeighbour() = runBlocking {
        val (cells, words) = locate(screenshot)
        assertTrue("newest cell ${cells.newest} not on the 2.01x tile", (cells.newest.left + cells.newest.right) / 2 in 222..386)
        assertEquals(Coefficient(201), (cells.readNewest(words) as OcrReading.Valid).value)
        assertEquals(Coefficient(153), (cells.readNeighbor(words) as OcrReading.Valid).value)
    }

    @Test
    fun findsTheRowUnderTheFloatingPanel() = runBlocking {
        val (cells, words) = locate(asset("real_row_with_panel.jpg"))
        assertEquals(Coefficient(203), (cells.readNewest(words) as OcrReading.Valid).value)
        assertEquals(Coefficient(100), (cells.readNeighbor(words) as OcrReading.Valid).value)
        // Read again from the tracking strip only, as monitoring does once the row is known.
        val image = asset("real_row_with_panel.jpg")
        val strip = cells.strip(image.width, image.height)
        val stripWords = CoefficientOcrEngine().use {
            it.readWords(Bitmap.createBitmap(image, strip.left, strip.top, strip.width, strip.height), offsetY = strip.top)
        }
        val followed = RowLocator.locate(stripWords, image.width, image.height, near = cells)
        assertTrue("row lost or moved in the strip: $followed", followed != null && !followed.movedFrom(cells))
        assertEquals(Coefficient(203), (cells.readNewest(stripWords) as OcrReading.Valid).value)
    }

    @Test
    fun findsTheRowNextToALastValueInThePanel() = runBlocking {
        // The panel shows "17.35x" in big letters: a single value is never taken for the row.
        val (cells, words) = locate(asset("real_row_with_old_panel.jpg"))
        assertEquals(Coefficient(158), (cells.readNewest(words) as OcrReading.Valid).value)
        assertEquals(Coefficient(350), (cells.readNeighbor(words) as OcrReading.Valid).value)
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
}
