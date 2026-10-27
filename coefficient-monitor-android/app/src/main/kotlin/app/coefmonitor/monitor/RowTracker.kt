package app.coefmonitor.monitor

import android.graphics.Bitmap
import android.os.SystemClock
import app.coefmonitor.core.FrameSample
import app.coefmonitor.core.ImageSignature
import app.coefmonitor.core.NormalizedRect
import app.coefmonitor.core.OcrReading
import app.coefmonitor.core.PixelRect
import app.coefmonitor.core.RejectionReason
import app.coefmonitor.core.RowCells
import app.coefmonitor.core.RowLocator
import app.coefmonitor.core.TextBox

sealed interface PipelineStep {
    data object NoFrame : PipelineStep

    /** The row has not been found on the screen yet: nothing to read. */
    data object Searching : PipelineStep

    /**
     * One frame of the row. [anchored]: the row was found at a new place (first time, or it
     * moved), so pictures from before are not comparable. [lost]: the row is not where it was
     * and was not found elsewhere either; the sample carries an empty reading.
     */
    data class Sample(val sample: FrameSample, val anchored: Boolean, val lost: Boolean) : PipelineStep
}

/**
 * The monitor's eye: finds the result row on the live screen by itself and follows it.
 *
 * Until the row is known, the whole screen is read. Once it is, OCR reads only a strip around it
 * (cheap; it also follows the row when the game scrolls a little). When the row is not in the
 * strip, the whole screen is read in the same tick, so a row that moved is found again at once.
 * The cells of the newest tile and its neighbour stay put while the row does; their pictures feed
 * the detector's motion check, and OCR is skipped while the newest tile is moving.
 */
class RowTracker(
    private val ocr: CoefficientOcrEngine,
    /** Called before an OCR call starts (OCR can take noticeable time on slow devices). */
    private val onOcrStarted: () -> Unit = {},
    /** Called with the duration of each completed OCR call in milliseconds. */
    private val onOcrFinished: (Long) -> Unit = {},
    /** Called with the whole screen when the row was found there; the bitmap is recycled afterwards. */
    private val onRowFound: suspend (Bitmap, RowCells) -> Unit = { _, _ -> },
) {
    private class Grab(
        val generation: Long,
        val width: Int,
        val height: Int,
        val strip: PixelRect?,
        val stripPixels: IntArray?,
        val newest: ImageSignature?,
        val neighbor: ImageSignature?,
    )

    @Volatile
    private var forgetRequested = false

    /** The cells being followed, in frame pixels; null until the row was found. */
    @Volatile
    var cells: RowCells? = null
        private set
    private var frameWidth = 0
    private var frameHeight = 0
    private var lastNewest: ImageSignature? = null
    private var stripSignature: ImageSignature? = null
    private var stripWords: List<TextBox> = emptyList()
    private var lastFullSearchMs = 0L
    private var movingSinceMs: Long? = null

    /** The row's cells as a share of the screen (where the auto-clicker must not tap), while it is followed. */
    fun rowBand(): NormalizedRect? {
        val tracked = cells ?: return null
        if (frameWidth <= 0 || frameHeight <= 0) return null
        val w = frameWidth.toFloat()
        val h = frameHeight.toFloat()
        val right = (tracked.neighbor ?: tracked.newest).right
        return NormalizedRect(tracked.newest.left / w, tracked.newest.top / h, right / w, tracked.newest.bottom / h)
    }

    /** Looks for the row on the whole screen at the next frame (e.g. the user asked to find it). */
    fun forget() {
        forgetRequested = true
    }

    suspend fun next(capturer: ScreenCapturer, stableSimilarity: Float, nowMs: Long): PipelineStep {
        if (forgetRequested) {
            forgetRequested = false
            reset()
        }
        val grab = capturer.withLatestFrame(::grab) ?: return PipelineStep.NoFrame
        val tracked = cells ?: return fullSearch(capturer, near = null, nowMs = nowMs, force = true) ?: PipelineStep.Searching

        val newest = grab.newest!!
        val moving = lastNewest?.let { it.similarity(newest) < stableSimilarity } == true
        lastNewest = newest
        val now = SystemClock.elapsedRealtime()
        movingSinceMs = if (moving) movingSinceMs ?: now else null
        // The tile is animating or the screen is moving: nothing worth reading yet. If it keeps
        // changing (the row scrolled away and something animated is there now), look anyway.
        if (moving && now - movingSinceMs!! < MAX_MOVING_MS) {
            return PipelineStep.Sample(FrameSample(nowMs, newest, grab.neighbor, reading = null), anchored = false, lost = false)
        }

        val words = stripWords(grab)
        val located = RowLocator.locate(words, grab.width, grab.height, near = tracked)
        if (located == null) {
            // Not in the strip any more: look at the whole screen now.
            fullSearch(capturer, near = tracked, nowMs = nowMs, force = false)?.let { return it }
            return PipelineStep.Sample(
                FrameSample(nowMs, newest, grab.neighbor, OcrReading.Rejected("", RejectionReason.EMPTY)),
                anchored = false,
                lost = true,
            )
        }
        if (located.movedFrom(tracked)) return anchor(capturer, located, words, nowMs) ?: PipelineStep.NoFrame
        return PipelineStep.Sample(
            FrameSample(nowMs, newest, grab.neighbor, tracked.readNewest(words), tracked.readNeighbor(words)),
            anchored = false,
            lost = false,
        )
    }

    private fun reset() {
        cells = null
        lastNewest = null
        movingSinceMs = null
        stripSignature = null
        stripWords = emptyList()
    }

    /** Copies what this tick needs while the frame is locked: the strip and the two cells. */
    private fun grab(frame: FrameAccess): Grab {
        if (frame.width != frameWidth || frame.height != frameHeight) {
            // New frame size (rotation, split screen): the row has to be found again.
            frameWidth = frame.width
            frameHeight = frame.height
            reset()
        }
        val tracked = cells ?: return Grab(frame.generation, frame.width, frame.height, null, null, null, null)
        val strip = tracked.strip(frame.width, frame.height)
        return Grab(
            generation = frame.generation,
            width = frame.width,
            height = frame.height,
            strip = strip,
            stripPixels = frame.crop(strip),
            newest = signature(frame.crop(tracked.newest), tracked.newest),
            neighbor = tracked.neighbor?.let { signature(frame.crop(it), it) },
        )
    }

    /** Words in the strip, read again only when the strip's picture changed. */
    private suspend fun stripWords(grab: Grab): List<TextBox> {
        val strip = grab.strip!!
        val pixels = grab.stripPixels!!
        val signature = ImageSignature.fromArgb(pixels, strip.width, strip.height)
        val cached = stripSignature
        if (cached != null && cached.similarity(signature) >= REUSE_SIMILARITY) return stripWords
        val bitmap = Bitmap.createBitmap(pixels, strip.width, strip.height, Bitmap.Config.ARGB_8888)
        val words = timedOcr { ocr.readWords(bitmap, offsetY = strip.top) }
        // Only recycle after success: if the coroutine was cancelled, ML Kit may still be reading it.
        bitmap.recycle()
        stripSignature = signature
        stripWords = words
        return words
    }

    /**
     * Reads the whole screen and, if the row is there, follows it from now on. Returns null if it
     * was not found (or a search ran too recently while the row is lost, unless [force]).
     */
    private suspend fun fullSearch(capturer: ScreenCapturer, near: RowCells?, nowMs: Long, force: Boolean): PipelineStep? {
        val now = SystemClock.elapsedRealtime()
        if (!force && now - lastFullSearchMs < LOST_SEARCH_INTERVAL_MS) return null
        lastFullSearchMs = now
        val bitmap = capturer.withLatestFrame { it.toBitmap() } ?: return null
        val words = timedOcr { ocr.readWords(bitmap) }
        val found = RowLocator.locate(words, bitmap.width, bitmap.height, near)
        if (found == null) {
            bitmap.recycle()
            return null
        }
        onRowFound(bitmap, found)
        val sample = sampleAt(found, words, bitmap, nowMs)
        bitmap.recycle()
        val anchored = near == null || found.movedFrom(near)
        cells = found
        stripSignature = null
        return PipelineStep.Sample(sample, anchored = anchored, lost = false)
    }

    /** The row is in the strip but clearly somewhere else: follow it there. */
    private suspend fun anchor(capturer: ScreenCapturer, found: RowCells, words: List<TextBox>, nowMs: Long): PipelineStep? {
        cells = found
        stripSignature = null
        val signatures = capturer.withLatestFrame { frame ->
            signature(frame.crop(found.newest), found.newest) to found.neighbor?.let { signature(frame.crop(it), it) }
        } ?: return null
        lastNewest = signatures.first
        val sample = FrameSample(nowMs, signatures.first, signatures.second, found.readNewest(words), found.readNeighbor(words))
        return PipelineStep.Sample(sample, anchored = true, lost = false)
    }

    private fun sampleAt(found: RowCells, words: List<TextBox>, bitmap: Bitmap, nowMs: Long): FrameSample {
        val newest = signature(bitmap, found.newest)
        lastNewest = newest
        return FrameSample(nowMs, newest, found.neighbor?.let { signature(bitmap, it) }, found.readNewest(words), found.readNeighbor(words))
    }

    private suspend fun timedOcr(block: suspend () -> List<TextBox>): List<TextBox> {
        onOcrStarted()
        val startedAt = SystemClock.elapsedRealtime()
        val words = block()
        onOcrFinished(SystemClock.elapsedRealtime() - startedAt)
        return words
    }

    private fun signature(pixels: IntArray, rect: PixelRect): ImageSignature = ImageSignature.fromArgb(pixels, rect.width, rect.height)

    private fun signature(bitmap: Bitmap, rect: PixelRect): ImageSignature {
        val pixels = IntArray(rect.width * rect.height)
        bitmap.getPixels(pixels, 0, rect.width, rect.left, rect.top, rect.width, rect.height)
        return signature(pixels, rect)
    }

    private companion object {
        /** Practically pixel-identical: OCR would return the same words. */
        const val REUSE_SIMILARITY = 0.999f

        /** While the row is lost, the whole screen is read at most this often. */
        const val LOST_SEARCH_INTERVAL_MS = 700L

        /** A tile animation is over well within this; longer means something else is there now. */
        const val MAX_MOVING_MS = 1_500L
    }
}
