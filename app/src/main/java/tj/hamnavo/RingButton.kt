package tj.hamnavo

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.os.SystemClock
import android.view.MotionEvent
import android.view.View

/**
 * The one control of the screen: a thin ring (idle), a turning arc (waiting), or a filled disc
 * with a soft halo that follows the sound level (playing).
 */
class RingButton(context: Context) : View(context) {
    enum class Mode { IDLE, WAITING, ACTIVE }

    var mode = Mode.IDLE
        set(value) {
            if (field != value) {
                field = value
                invalidate()
            }
        }

    /** 0..1, smoothed while drawing. */
    var level = 0f

    var color = 0
    var faintColor = 0

    private val density = resources.displayMetrics.density
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val arc = RectF()
    private var shown = 0f

    init {
        isClickable = true
        isFocusable = true
    }

    override fun onDraw(canvas: Canvas) {
        val cx = width / 2f
        val cy = height / 2f
        val halo = 14 * density
        val r = minOf(width, height) / 2f - halo - 2 * density
        val stroke = 1.5f * density
        shown += (level - shown) * 0.25f

        when (mode) {
            Mode.IDLE -> {
                paint.style = Paint.Style.STROKE
                paint.strokeWidth = stroke
                paint.color = color
                canvas.drawCircle(cx, cy, r, paint)
            }
            Mode.WAITING -> {
                paint.style = Paint.Style.STROKE
                paint.strokeWidth = stroke
                paint.color = faintColor
                canvas.drawCircle(cx, cy, r, paint)
                paint.color = color
                paint.strokeWidth = stroke * 1.6f
                arc.set(cx - r, cy - r, cx + r, cy + r)
                val angle = (SystemClock.uptimeMillis() % 1600) / 1600f * 360f
                canvas.drawArc(arc, angle, 50f, false, paint)
                postInvalidateOnAnimation()
            }
            Mode.ACTIVE -> {
                paint.style = Paint.Style.STROKE
                paint.strokeWidth = stroke
                paint.color = faintColor
                canvas.drawCircle(cx, cy, r + 3 * density + shown.coerceIn(0f, 1f) * (halo - 3 * density), paint)
                paint.style = Paint.Style.FILL
                paint.color = color
                canvas.drawCircle(cx, cy, r, paint)
                if (kotlin.math.abs(level - shown) > 0.005f) postInvalidateOnAnimation()
            }
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> alpha = 0.6f
            MotionEvent.ACTION_UP -> {
                alpha = 1f
                performClick()
            }
            MotionEvent.ACTION_CANCEL -> alpha = 1f
        }
        return true
    }

    override fun performClick(): Boolean = super.performClick()
}
