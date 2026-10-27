package app.coefmonitor.monitor

import android.graphics.Bitmap
import android.os.SystemClock
import app.coefmonitor.core.CalibrationProblem
import app.coefmonitor.core.FrameSample
import app.coefmonitor.core.ImageSignature
import app.coefmonitor.core.ObservationCalibration
import app.coefmonitor.core.ObservationRegionManager
import app.coefmonitor.core.OcrReading
import app.coefmonitor.core.PixelRect
import app.coefmonitor.core.RegionResolution

sealed interface PipelineStep {
    data object NoFrame : PipelineStep
    data class InvalidRegion(val problem: CalibrationProblem) : PipelineStep
    data class Sample(val sample: FrameSample) : PipelineStep
}

/**
 * Frame → [FrameSample]: crops the calibrated tile (and its neighbour), builds image signatures and
 * runs OCR only when needed. OCR is skipped while the tile is moving and reused while the picture
 * is pixel-identical, so a static screen costs almost nothing.
 */
class FramePipeline(
    private val ocr: CoefficientOcrEngine,
    /** Called before an OCR call starts (OCR can take noticeable time on slow devices). */
    private val onOcrStarted: () -> Unit = {},
    /** Called with the duration of each completed OCR call in milliseconds. */
    private val onOcrFinished: (Long) -> Unit = {},
) {

    private class Crop(val pixels: IntArray, val rect: PixelRect)
    private class CachedReading(val signature: ImageSignature, val reading: OcrReading)

    private sealed interface FrameRead {
        data object Unchanged : FrameRead
        data class Invalid(val problem: CalibrationProblem) : FrameRead
        class Cropped(val primary: Crop, val neighbor: Crop?) : FrameRead
    }

    private var lastGeneration = -1L
    private var lastCalibration: ObservationCalibration? = null
    private var lastSample: FrameSample? = null
    private var lastCrops: FrameRead.Cropped? = null
    private var primaryCache: CachedReading? = null
    private var neighborCache: CachedReading? = null

    fun reset() {
        lastGeneration = -1L
        lastCalibration = null
        lastSample = null
        lastCrops = null
        primaryCache = null
        neighborCache = null
    }

    suspend fun next(
        capturer: ScreenCapturer,
        calibration: ObservationCalibration?,
        stableSimilarity: Float,
        nowMs: Long,
    ): PipelineStep {
        val read = capturer.withLatestFrame { frame -> readFrame(frame, calibration) } ?: return PipelineStep.NoFrame
        return when (read) {
            is FrameRead.Invalid -> {
                lastSample = null
                lastCrops = null
                PipelineStep.InvalidRegion(read.problem)
            }
            FrameRead.Unchanged -> PipelineStep.Sample(unchangedSample(nowMs))
            is FrameRead.Cropped -> {
                lastCrops = read
                val sample = analyze(read, stableSimilarity, nowMs)
                lastSample = sample
                PipelineStep.Sample(sample)
            }
        }
    }

    private fun readFrame(frame: FrameAccess, calibration: ObservationCalibration?): FrameRead {
        if (lastSample != null && frame.generation == lastGeneration && calibration == lastCalibration) {
            return FrameRead.Unchanged
        }
        return when (val resolution = ObservationRegionManager.resolve(calibration, frame.width, frame.height)) {
            is RegionResolution.Invalid -> FrameRead.Invalid(resolution.problem)
            is RegionResolution.Ready -> {
                lastGeneration = frame.generation
                lastCalibration = calibration
                FrameRead.Cropped(
                    primary = Crop(frame.crop(resolution.primary), resolution.primary),
                    neighbor = resolution.neighbor?.let { Crop(frame.crop(it), it) },
                )
            }
        }
    }

    /** Same picture as last time. If the last frame was skipped as "moving", read it now. */
    private suspend fun unchangedSample(nowMs: Long): FrameSample {
        val previous = lastSample!!
        val crops = lastCrops
        if (previous.reading != null || crops == null) return previous.copy(timestampMs = nowMs)
        val reading = readCached(crops.primary, previous.primary, isNeighbor = false)
        val filled = previous.copy(
            timestampMs = nowMs,
            reading = reading,
            neighborReading = if (reading !is OcrReading.Valid) {
                null
            } else {
                crops.neighbor?.let { crop -> previous.neighbor?.let { readCached(crop, it, isNeighbor = true) } }
            },
        )
        lastSample = filled
        return filled
    }

    private suspend fun analyze(read: FrameRead.Cropped, stableSimilarity: Float, nowMs: Long): FrameSample {
        val primarySignature = signatureOf(read.primary)
        val neighborSignature = read.neighbor?.let(::signatureOf)
        val previous = lastSample?.primary
        val moving = previous != null && previous.similarity(primarySignature) < stableSimilarity
        val reading = if (moving) null else readCached(read.primary, primarySignature, isNeighbor = false)
        // The neighbour only matters next to a valid reading; skipping it otherwise halves OCR work.
        val neighborReading = if (reading !is OcrReading.Valid || read.neighbor == null || neighborSignature == null) {
            null
        } else {
            readCached(read.neighbor, neighborSignature, isNeighbor = true)
        }
        return FrameSample(nowMs, primarySignature, neighborSignature, reading, neighborReading)
    }

    private suspend fun readCached(crop: Crop, signature: ImageSignature, isNeighbor: Boolean): OcrReading {
        val cache = if (isNeighbor) neighborCache else primaryCache
        if (cache != null && cache.signature.similarity(signature) >= REUSE_SIMILARITY) return cache.reading
        val bitmap = Bitmap.createBitmap(crop.pixels, crop.rect.width, crop.rect.height, Bitmap.Config.ARGB_8888)
        onOcrStarted()
        val startedAt = SystemClock.elapsedRealtime()
        val reading = ocr.read(bitmap)
        onOcrFinished(SystemClock.elapsedRealtime() - startedAt)
        // Only recycle after success: if the coroutine was cancelled, ML Kit may still be reading it.
        bitmap.recycle()
        val fresh = CachedReading(signature, reading)
        if (isNeighbor) neighborCache = fresh else primaryCache = fresh
        return reading
    }

    private fun signatureOf(crop: Crop): ImageSignature =
        ImageSignature.fromArgb(crop.pixels, crop.rect.width, crop.rect.height)

    private companion object {
        /** Practically pixel-identical: OCR would return the same text. */
        const val REUSE_SIMILARITY = 0.999f
    }
}
