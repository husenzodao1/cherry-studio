package app.coefmonitor.monitor

import android.content.Context
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.os.Handler
import android.os.HandlerThread
import android.util.DisplayMetrics
import android.view.Display
import app.coefmonitor.core.PixelRect

/**
 * Mirrors the screen into an [ImageReader] through the user-approved [MediaProjection].
 *
 * The newest frame is kept open so crops can be taken at any time: a static screen produces no
 * new frames, and the detector still needs to look at it. Rotation is handled by resizing the
 * existing virtual display (Android 14 allows only one virtual display per projection).
 */
class ScreenCapturer(
    context: Context,
    private val projection: MediaProjection,
    private val onStopped: () -> Unit,
) {
    private data class DisplaySize(val width: Int, val height: Int, val dpi: Int)

    private val thread = HandlerThread("screen-capture").apply { start() }
    private val handler = Handler(thread.looper)
    private val displayManager = context.getSystemService(DisplayManager::class.java)
    private val lock = Any()

    private var reader: ImageReader? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var current: Image? = null
    private var size = DisplaySize(0, 0, 0)
    private var generation = 0L
    private var released = false

    private val projectionCallback = object : MediaProjection.Callback() {
        override fun onStop() = onStopped()
    }

    private val displayListener = object : DisplayManager.DisplayListener {
        override fun onDisplayAdded(displayId: Int) = Unit
        override fun onDisplayRemoved(displayId: Int) = Unit
        override fun onDisplayChanged(displayId: Int) {
            if (displayId == Display.DEFAULT_DISPLAY) resizeIfNeeded()
        }
    }

    /** Throws if the projection token is no longer usable. */
    fun start() {
        // Android 14+ requires the callback before the virtual display is created.
        projection.registerCallback(projectionCallback, handler)
        synchronized(lock) {
            size = readDisplaySize()
            val newReader = newReader(size)
            reader = newReader
            virtualDisplay = projection.createVirtualDisplay(
                "coefficient-monitor",
                size.width,
                size.height,
                size.dpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                newReader.surface,
                null,
                handler,
            )
        }
        displayManager.registerDisplayListener(displayListener, handler)
    }

    /** Runs [block] with the newest frame while it is locked; returns null if no frame exists yet. */
    fun <T> withLatestFrame(block: (FrameAccess) -> T): T? = synchronized(lock) {
        if (released) return null
        val activeReader = reader ?: return null
        val newer = try {
            activeReader.acquireLatestImage()
        } catch (e: IllegalStateException) {
            null
        }
        if (newer != null) {
            current?.close()
            current = newer
            generation++
        }
        val image = current ?: return null
        block(FrameAccess(image, generation))
    }

    fun release() {
        synchronized(lock) {
            if (released) return
            released = true
            current?.close()
            current = null
            virtualDisplay?.release()
            virtualDisplay = null
            reader?.close()
            reader = null
        }
        displayManager.unregisterDisplayListener(displayListener)
        projection.unregisterCallback(projectionCallback)
        projection.stop()
        thread.quitSafely()
    }

    private fun resizeIfNeeded() {
        val newSize = readDisplaySize()
        synchronized(lock) {
            if (released || newSize == size) return
            val display = virtualDisplay ?: return
            val newReader = newReader(newSize)
            display.resize(newSize.width, newSize.height, newSize.dpi)
            display.surface = newReader.surface
            current?.close()
            current = null
            reader?.close()
            reader = newReader
            size = newSize
            generation++
        }
    }

    private fun newReader(s: DisplaySize): ImageReader =
        // 3 buffers: one kept as "current", the rest for acquireLatestImage().
        ImageReader.newInstance(s.width, s.height, PixelFormat.RGBA_8888, 3)

    @Suppress("DEPRECATION")
    private fun readDisplaySize(): DisplaySize {
        val metrics = DisplayMetrics()
        displayManager.getDisplay(Display.DEFAULT_DISPLAY).getRealMetrics(metrics)
        return DisplaySize(metrics.widthPixels, metrics.heightPixels, metrics.densityDpi)
    }
}

/** Read access to one captured frame; only valid inside [ScreenCapturer.withLatestFrame]. */
class FrameAccess internal constructor(private val image: Image, val generation: Long) {
    val width: Int get() = image.width
    val height: Int get() = image.height

    /** Copies only the requested rectangle as packed ARGB pixels. */
    fun crop(rect: PixelRect): IntArray {
        val plane = image.planes[0]
        val buffer = plane.buffer
        val pixelStride = plane.pixelStride
        val rowStride = plane.rowStride
        val out = IntArray(rect.width * rect.height)
        for (y in 0 until rect.height) {
            val rowStart = (rect.top + y) * rowStride + rect.left * pixelStride
            for (x in 0 until rect.width) {
                val i = rowStart + x * pixelStride
                val r = buffer.get(i).toInt() and 0xFF
                val g = buffer.get(i + 1).toInt() and 0xFF
                val b = buffer.get(i + 2).toInt() and 0xFF
                out[y * rect.width + x] = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
            }
        }
        return out
    }

    /** Full-frame copy, used only for calibration screenshots. */
    fun toBitmap(): Bitmap {
        val plane = image.planes[0]
        val paddedWidth = plane.rowStride / plane.pixelStride
        val padded = Bitmap.createBitmap(paddedWidth, image.height, Bitmap.Config.ARGB_8888)
        plane.buffer.rewind()
        padded.copyPixelsFromBuffer(plane.buffer)
        if (paddedWidth == image.width) return padded
        val exact = Bitmap.createBitmap(padded, 0, 0, image.width, image.height)
        padded.recycle()
        return exact
    }
}
