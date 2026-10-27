package app.coefmonitor.debug

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.hardware.display.DisplayManager
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.os.SystemClock
import android.util.DisplayMetrics
import android.util.TypedValue
import android.view.Display
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import app.coefmonitor.core.Coefficient
import app.coefmonitor.core.NormalizedPoint
import app.coefmonitor.core.NormalizedRect
import app.coefmonitor.core.ObservationCalibration
import java.lang.ref.WeakReference
import java.util.Locale
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.math.PI
import kotlin.math.sin

/** Shared board contents, so any activity instance (e.g. after an app switch) draws the same row. */
object SimulatorBoard {
    @Volatile
    var results: List<String> = emptyList()

    /** Every touch the simulator screen received, oldest first; lets tests check the auto-clicker. */
    val taps = CopyOnWriteArrayList<SimulatorTap>()
}

/** A touch on the simulator, normalised to the full display. */
data class SimulatorTap(val point: NormalizedPoint, val atMs: Long)

/**
 * Debug-only stand-in for a crash game screen, used by instrumented tests: a "?" tile followed by
 * result tiles that slide right when a result arrives (proportions and colours measured from a
 * real screenshot), plus a moving object and a running multiplier elsewhere on screen. It never
 * interacts with any real game or service.
 */
class SimulatorActivity : ComponentActivity() {

    lateinit var board: TileBoardView
        private set

    private var captureCallback: ((Int, Intent?) -> Unit)? = null
    private var ambientTick: Runnable? = null

    private val consent = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        captureCallback?.invoke(result.resultCode, result.data)
        captureCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val root = FrameLayout(this).apply { setBackgroundColor(BACKGROUND) }
        board = TileBoardView(this)
        root.addView(board, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        val multiplier = TextView(this).apply {
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 44f)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }
        root.addView(
            multiplier,
            FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = (resources.displayMetrics.heightPixels * 0.28f).toInt()
            },
        )
        val plane = View(this).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(PLANE)
            }
        }
        val size = (resources.displayMetrics.density * 28).toInt()
        root.addView(plane, FrameLayout.LayoutParams(size, size))
        setContentView(root)
        root.post { startAmbientAnimation(root, plane, multiplier) }
    }

    override fun onResume() {
        super.onResume()
        current = WeakReference(this)
    }

    override fun onDestroy() {
        ambientTick?.let { board.rootView.removeCallbacks(it) }
        super.onDestroy()
    }

    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        if (event.actionMasked == MotionEvent.ACTION_DOWN) {
            val (width, height) = displaySize()
            SimulatorBoard.taps += SimulatorTap(NormalizedPoint(event.rawX / width, event.rawY / height), SystemClock.uptimeMillis())
        }
        return super.dispatchTouchEvent(event)
    }

    /** Asks for screen-capture consent; [callback] receives the activity result. */
    fun requestCapture(callback: (Int, Intent?) -> Unit) {
        captureCallback = callback
        consent.launch(getSystemService(MediaProjectionManager::class.java).createScreenCaptureIntent())
    }

    /** Exact calibration of the first tile right of "?", in full-display coordinates. */
    fun calibration(): ObservationCalibration {
        val display = displaySize()
        val location = IntArray(2)
        board.getLocationOnScreen(location)
        val tile = board.tileRect(0).apply { offset(location[0].toFloat(), location[1].toFloat()) }
        val placeholder = board.placeholderRect().apply { offset(location[0].toFloat(), location[1].toFloat()) }
        val w = display.first.toFloat()
        val h = display.second.toFloat()
        return ObservationCalibration(
            tile = NormalizedRect(tile.left / w, tile.top / h, tile.right / w, tile.bottom / h),
            placeholder = NormalizedPoint(placeholder.centerX() / w, placeholder.centerY() / h),
            referenceWidth = display.first,
            referenceHeight = display.second,
        )
    }

    /** "?" tile bounds normalised to the display, for checking auto-detection. */
    fun placeholderBounds(): NormalizedRect = normalized(board.placeholderRect())

    fun tileBounds(index: Int): NormalizedRect = normalized(board.tileRect(index))

    private fun normalized(rect: RectF): NormalizedRect {
        val display = displaySize()
        val location = IntArray(2)
        board.getLocationOnScreen(location)
        rect.offset(location[0].toFloat(), location[1].toFloat())
        return NormalizedRect(
            rect.left / display.first,
            rect.top / display.second,
            rect.right / display.first,
            rect.bottom / display.second,
        )
    }

    @Suppress("DEPRECATION")
    private fun displaySize(): Pair<Int, Int> {
        val metrics = DisplayMetrics()
        getSystemService(DisplayManager::class.java).getDisplay(Display.DEFAULT_DISPLAY).getRealMetrics(metrics)
        return metrics.widthPixels to metrics.heightPixels
    }

    /**
     * Something keeps moving elsewhere on screen, like in a real game. Updated ~8 times per second
     * rather than every frame so a software-rendered emulator stays responsive.
     */
    private fun startAmbientAnimation(root: View, plane: View, multiplier: TextView) {
        val startedAt = SystemClock.uptimeMillis()
        val tick = object : Runnable {
            override fun run() {
                val cycle = ((SystemClock.uptimeMillis() - startedAt) % AMBIENT_PERIOD_MS) / AMBIENT_PERIOD_MS.toFloat()
                val t = if (cycle < 0.5f) cycle * 2f else (1f - cycle) * 2f
                plane.translationX = t * (root.width - plane.width)
                plane.translationY = root.height * 0.16f + sin(t * PI * 2).toFloat() * root.height * 0.05f
                multiplier.text = String.format(Locale.US, "%.2fx", 1f + t * 4f)
                root.postDelayed(this, AMBIENT_TICK_MS)
            }
        }
        ambientTick = tick
        root.post(tick)
    }

    companion object {
        const val BACKGROUND = 0xFF151027.toInt()
        private const val PLANE = 0xFFE5484D.toInt()
        private const val AMBIENT_PERIOD_MS = 5_000L
        private const val AMBIENT_TICK_MS = 120L

        @Volatile
        var current: WeakReference<SimulatorActivity>? = null
    }
}

/** Draws the "?" tile and the result history; new results slide in from the left. */
class TileBoardView(context: Context) : View(context) {
    private var incoming: String? = null
    private var progress = 1f
    private var animator: ValueAnimator? = null

    private val tilePaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        typeface = Typeface.DEFAULT_BOLD
        textAlign = Paint.Align.CENTER
    }
    private val pointer = Path()

    // Proportions measured from the reference screenshot: tile 163x73 px, pitch 180 px.
    private val tileWidth: Float get() = width * 0.151f
    private val tileHeight: Float get() = tileWidth / 2.23f
    private val pitch: Float get() = tileWidth * 1.104f
    private val rowTop: Float get() = height * 0.5f
    private val startX: Float get() = width * 0.04f

    private fun slot(index: Int): RectF {
        val left = startX + index * pitch
        return RectF(left, rowTop, left + tileWidth, rowTop + tileHeight)
    }

    fun placeholderRect(): RectF = slot(0)

    /** Result tile [index] (0 = newest, immediately right of "?"). */
    fun tileRect(index: Int): RectF = slot(index + 1)

    fun setHistory(values: List<String>) {
        animator?.cancel()
        SimulatorBoard.results = values
        incoming = null
        progress = 1f
        invalidate()
    }

    /** A new round result: the row shifts one tile to the right and [value] appears beside "?". */
    fun push(value: String, durationMs: Long = 700) {
        animator?.end()
        incoming = value
        progress = 0f
        animator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = durationMs
            interpolator = DecelerateInterpolator()
            addUpdateListener {
                progress = it.animatedValue as Float
                invalidate()
            }
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    SimulatorBoard.results = listOf(value) + SimulatorBoard.results
                    incoming = null
                    progress = 1f
                    invalidate()
                }
            })
            start()
        }
    }

    override fun onDraw(canvas: Canvas) {
        canvas.drawColor(SimulatorActivity.BACKGROUND)
        drawTile(canvas, placeholderRect(), BLUE, "?", 1f)
        drawPointer(canvas, placeholderRect())
        val sliding = incoming != null
        val shift = if (sliding) progress * pitch else 0f
        SimulatorBoard.results.take(VISIBLE_TILES).forEachIndexed { i, value ->
            val rect = tileRect(i).apply { offset(shift, 0f) }
            drawTile(canvas, rect, colorFor(value), value, fadeFor(i + if (sliding) progress else 0f))
        }
        incoming?.let { drawTile(canvas, tileRect(0), colorFor(it), it, progress) }
    }

    private fun drawTile(canvas: Canvas, rect: RectF, color: Int, text: String, alpha: Float) {
        val a = (alpha.coerceIn(0f, 1f) * 255).toInt()
        tilePaint.color = color
        tilePaint.alpha = a
        val radius = rect.height() * 0.19f
        canvas.drawRoundRect(rect, radius, radius, tilePaint)
        textPaint.textSize = rect.height() * 0.43f
        textPaint.alpha = a
        val metrics = textPaint.fontMetrics
        canvas.drawText(text, rect.centerX(), rect.centerY() - (metrics.ascent + metrics.descent) / 2f, textPaint)
    }

    private fun drawPointer(canvas: Canvas, rect: RectF) {
        val size = rect.height() * 0.18f
        pointer.reset()
        pointer.moveTo(rect.centerX(), rect.bottom - size)
        pointer.lineTo(rect.centerX() - size, rect.bottom + size * 0.2f)
        pointer.lineTo(rect.centerX() + size, rect.bottom + size * 0.2f)
        pointer.close()
        textPaint.alpha = 255
        canvas.drawPath(pointer, textPaint)
    }

    private fun colorFor(value: String): Int {
        val coefficient = Coefficient.parseUserInput(value)
        return if (coefficient != null && coefficient > Coefficient.DEFAULT_THRESHOLD) PURPLE else BLUE
    }

    /** Older tiles fade like in the game: positions 0–1 opaque, then dimmer. */
    private fun fadeFor(position: Float): Float = when {
        position <= 1f -> 1f
        position <= 2f -> 1f - (position - 1f) * 0.28f
        position <= 3f -> 0.72f - (position - 2f) * 0.27f
        else -> (0.45f - (position - 3f) * 0.15f).coerceAtLeast(0.2f)
    }

    private companion object {
        const val BLUE = 0xFF3E5BC1.toInt()
        const val PURPLE = 0xFF753DC2.toInt()
        const val VISIBLE_TILES = 6
    }
}
