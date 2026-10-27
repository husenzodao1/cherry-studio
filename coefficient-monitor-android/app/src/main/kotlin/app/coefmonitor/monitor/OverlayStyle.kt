package app.coefmonitor.monitor

import android.content.Context
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.widget.TextView
import androidx.core.content.res.ResourcesCompat
import app.coefmonitor.R

/**
 * The look of the floating windows, matching the app: graphite surface with a hairline, Inter,
 * pill-shaped buttons, one violet accent.
 */
internal class OverlayStyle(private val context: Context) {
    val regular: Typeface = font(R.font.inter_regular, Typeface.DEFAULT)
    val medium: Typeface = font(R.font.inter_medium, Typeface.DEFAULT)
    val semibold: Typeface = font(R.font.inter_semibold, Typeface.DEFAULT_BOLD)

    fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()

    /** The window's card: translucent graphite, rounded, hairline border. */
    fun card(radiusDp: Int): GradientDrawable = GradientDrawable().apply {
        cornerRadius = dp(radiusDp).toFloat()
        setColor(BACKGROUND)
        setStroke(dp(1), HAIRLINE)
    }

    fun pill(color: Int): GradientDrawable = GradientDrawable().apply {
        cornerRadius = dp(100).toFloat()
        setColor(color)
    }

    fun text(sizeSp: Float, color: Int, typeface: Typeface = regular) = TextView(context).apply {
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
        setTextColor(color)
        this.typeface = typeface
        includeFontPadding = false
    }

    /** A pill button; [primary] ones are filled with the accent. */
    fun button(label: String, primary: Boolean = false, onClick: () -> Unit) = text(12f, if (primary) ON_ACCENT else TEXT, medium).apply {
        text = label
        setPadding(dp(12), dp(7), dp(12), dp(7))
        minHeight = dp(32)
        gravity = Gravity.CENTER
        maxLines = 1
        background = pill(if (primary) ACCENT else CHIP)
        isClickable = true
        setOnClickListener { onClick() }
    }

    private fun font(id: Int, fallback: Typeface): Typeface =
        runCatching { ResourcesCompat.getFont(context, id) }.getOrNull() ?: fallback

    companion object {
        const val BACKGROUND = 0xF215171C.toInt()
        const val HAIRLINE = 0xFF2C3039.toInt()
        const val TEXT = 0xFFECEEF2.toInt()
        const val MUTED = 0xFF8D939E.toInt()
        const val CHIP = 0xFF23262D.toInt()
        const val CHIP_SELECTED = 0xFF333743.toInt()
        const val TRACK = 0xFF0F1115.toInt()
        const val ACCENT = 0xFF9D8FFF.toInt()
        const val ACCENT_SOFT = 0x339D8FFF
        const val ACCENT_DEEP = 0xFF6E5FEA.toInt()
        const val ON_ACCENT = 0xFF0C0D10.toInt()
        const val WARNING = 0xFFF5B94A.toInt()
        const val DANGER = 0xFFFF6B6B.toInt()
        const val STOPPED = 0xFF3A3E47.toInt()
    }
}
